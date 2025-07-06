const Asset = require('../models/Asset');
const User = require('../models/User');
const Organization = require('../models/Organization');
const assetService = require('../services/assetService');
const mageritService = require('../services/mageritService');
const { body, validationResult } = require('express-validator');

/**
 * @desc    Crear nuevo activo
 * @route   POST /api/assets
 * @access  Private (admin, analyst)
 */
const createAsset = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Datos de entrada inválidos',
        errors: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const {
      name,
      code,
      description,
      type,
      subtype,
      valuation,
      economicValue,
      sectoralFactor,
      owner,
      custodian,
      location,
      metadata
    } = req.body;

    // Verificar si el código ya existe en la organización
    const existingAsset = await Asset.findOne({
      organization: req.user.organization,
      code: code.toUpperCase()
    });

    if (existingAsset) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un activo con este código en la organización',
        timestamp: new Date().toISOString()
      });
    }

    // Validar subtipo con tipo
    if (!Asset.validateSubtype(type, subtype)) {
      return res.status(400).json({
        status: 'error',
        message: 'El subtipo no es válido para el tipo de activo seleccionado',
        timestamp: new Date().toISOString()
      });
    }

    // Validar que el propietario existe y pertenece a la organización
    const ownerUser = await User.findOne({
      _id: owner.userId,
      organization: req.user.organization,
      isActive: true
    });

    if (!ownerUser) {
      return res.status(404).json({
        status: 'error',
        message: 'El usuario propietario no existe o no pertenece a la organización',
        timestamp: new Date().toISOString()
      });
    }

    // Crear el activo
    const asset = new Asset({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description: description?.trim(),
      type,
      subtype,
      valuation: {
        confidentiality: valuation?.confidentiality || 0,
        integrity: valuation?.integrity || 0,
        availability: valuation?.availability || 0,
        authenticity: valuation?.authenticity || 0,
        traceability: valuation?.traceability || 0
      },
      economicValue: economicValue || 0,
      sectoralFactor: sectoralFactor || 1.0,
      owner: {
        userId: ownerUser._id,
        name: ownerUser.profile.firstName + ' ' + ownerUser.profile.lastName,
        email: ownerUser.email,
        department: owner.department || ''
      },
      location: location || {},
      metadata: metadata || {},
      organization: req.user.organization
    });

    // Si hay custodio, validarlo
    if (custodian?.userId) {
      const custodianUser = await User.findOne({
        _id: custodian.userId,
        organization: req.user.organization,
        isActive: true
      });

      if (custodianUser) {
        asset.custodian = {
          userId: custodianUser._id,
          name: custodianUser.profile.firstName + ' ' + custodianUser.profile.lastName,
          email: custodianUser.email,
          department: custodian.department || ''
        };
      }
    }

    await asset.save();

    // Poblar referencias para la respuesta
    await asset.populate([
      { path: 'owner.userId', select: 'profile email' },
      { path: 'custodian.userId', select: 'profile email' }
    ]);

    res.status(201).json({
      status: 'success',
      message: 'Activo creado exitosamente',
      data: {
        asset
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al crear el activo',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Obtener lista de activos con filtros y paginación
 * @route   GET /api/assets
 * @access  Private (admin, analyst, viewer)
 */
const getAssets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      type,
      subtype,
      status,
      criticality,
      owner,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Construir filtros
    const filters = { organization: req.user.organization };

    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (type) filters.type = type;
    if (subtype) filters.subtype = subtype;
    if (status) filters.status = status;
    if (criticality) filters['criticality.level'] = criticality;
    if (owner) filters['owner.userId'] = owner;

    // Configurar ordenamiento
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Ejecutar consulta con paginación
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [assets, totalAssets] = await Promise.all([
      Asset.find(filters)
        .populate('owner.userId', 'profile email')
        .populate('custodian.userId', 'profile email')
        .populate('dependencies.assetId', 'name code type')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Asset.countDocuments(filters)
    ]);

    // Calcular estadísticas
    const stats = await Asset.aggregate([
      { $match: { organization: req.user.organization } },
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          byType: {
            $push: {
              type: '$type',
              criticality: '$criticality.level'
            }
          },
          avgCriticality: { $avg: '$criticality.score' },
          totalEconomicValue: { $sum: '$economicValue' }
        }
      }
    ]);

    const typeDistribution = {};
    const criticalityDistribution = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      VERY_LOW: 0
    };

    if (stats.length > 0) {
      stats[0].byType.forEach(item => {
        typeDistribution[item.type] = (typeDistribution[item.type] || 0) + 1;
        criticalityDistribution[item.criticality]++;
      });
    }

    res.json({
      status: 'success',
      data: {
        assets,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalAssets / limitNum),
          totalAssets,
          hasNextPage: pageNum < Math.ceil(totalAssets / limitNum),
          hasPrevPage: pageNum > 1,
          limit: limitNum
        },
        stats: {
          totalAssets,
          typeDistribution,
          criticalityDistribution,
          avgCriticality: stats.length > 0 ? Math.round(stats[0].avgCriticality * 100) / 100 : 0,
          totalEconomicValue: stats.length > 0 ? stats[0].totalEconomicValue : 0
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al obtener los activos',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Obtener activo por ID
 * @route   GET /api/assets/:id
 * @access  Private (admin, analyst, viewer)
 */
const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      organization: req.user.organization
    })
      .populate('owner.userId', 'profile email')
      .populate('custodian.userId', 'profile email')
      .populate({
        path: 'dependencies.assetId',
        select: 'name code type subtype criticality valuation',
        populate: {
          path: 'owner.userId',
          select: 'profile email'
        }
      });

    if (!asset) {
      return res.status(404).json({
        status: 'error',
        message: 'Activo no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    // Obtener activos que dependen de este
    const dependentAssets = await Asset.find({
      organization: req.user.organization,
      'dependencies.assetId': asset._id
    }).select('name code type criticality').lean();

    res.json({
      status: 'success',
      data: {
        asset,
        dependentAssets,
        formattedValuation: asset.getFormattedValuation(),
        typeInfo: asset.typeInfo
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al obtener el activo',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Actualizar activo
 * @route   PUT /api/assets/:id
 * @access  Private (admin, analyst)
 */
const updateAsset = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Datos de entrada inválidos',
        errors: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const asset = await Asset.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!asset) {
      return res.status(404).json({
        status: 'error',
        message: 'Activo no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    const {
      name,
      description,
      type,
      subtype,
      valuation,
      economicValue,
      sectoralFactor,
      owner,
      custodian,
      location,
      status,
      metadata
    } = req.body;

    // Validar subtipo con tipo si se actualizan
    if ((type && type !== asset.type) || (subtype && subtype !== asset.subtype)) {
      const finalType = type || asset.type;
      const finalSubtype = subtype || asset.subtype;
      
      if (!Asset.validateSubtype(finalType, finalSubtype)) {
        return res.status(400).json({
          status: 'error',
          message: 'El subtipo no es válido para el tipo de activo seleccionado',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Validar propietario si se actualiza
    if (owner?.userId && owner.userId !== asset.owner.userId.toString()) {
      const ownerUser = await User.findOne({
        _id: owner.userId,
        organization: req.user.organization,
        isActive: true
      });

      if (!ownerUser) {
        return res.status(404).json({
          status: 'error',
          message: 'El usuario propietario no existe o no pertenece a la organización',
          timestamp: new Date().toISOString()
        });
      }

      asset.owner = {
        userId: ownerUser._id,
        name: ownerUser.profile.firstName + ' ' + ownerUser.profile.lastName,
        email: ownerUser.email,
        department: owner.department || ''
      };
    }

    // Validar custodio si se actualiza
    if (custodian?.userId) {
      const custodianUser = await User.findOne({
        _id: custodian.userId,
        organization: req.user.organization,
        isActive: true
      });

      if (custodianUser) {
        asset.custodian = {
          userId: custodianUser._id,
          name: custodianUser.profile.firstName + ' ' + custodianUser.profile.lastName,
          email: custodianUser.email,
          department: custodian.department || ''
        };
      }
    }

    // Actualizar campos
    if (name) asset.name = name.trim();
    if (description !== undefined) asset.description = description?.trim();
    if (type) asset.type = type;
    if (subtype) asset.subtype = subtype;
    if (economicValue !== undefined) asset.economicValue = economicValue;
    if (sectoralFactor !== undefined) asset.sectoralFactor = sectoralFactor;
    if (location) asset.location = { ...asset.location, ...location };
    if (status) asset.status = status;
    if (metadata) asset.metadata = { ...asset.metadata, ...metadata };

    // Actualizar valoración si se proporciona
    if (valuation) {
      asset.valuation = {
        confidentiality: valuation.confidentiality ?? asset.valuation.confidentiality,
        integrity: valuation.integrity ?? asset.valuation.integrity,
        availability: valuation.availability ?? asset.valuation.availability,
        authenticity: valuation.authenticity ?? asset.valuation.authenticity,
        traceability: valuation.traceability ?? asset.valuation.traceability
      };
    }

    // Agregar entrada de auditoría
    asset.auditTrail.push({
      action: 'UPDATED',
      performedBy: req.user._id,
      details: {
        updatedFields: Object.keys(req.body),
        previousCriticality: asset.criticality.level
      }
    });

    await asset.save();

    // Poblar referencias para la respuesta
    await asset.populate([
      { path: 'owner.userId', select: 'profile email' },
      { path: 'custodian.userId', select: 'profile email' }
    ]);

    res.json({
      status: 'success',
      message: 'Activo actualizado exitosamente',
      data: {
        asset
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al actualizar el activo',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Eliminar activo (soft delete)
 * @route   DELETE /api/assets/:id
 * @access  Private (admin)
 */
const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!asset) {
      return res.status(404).json({
        status: 'error',
        message: 'Activo no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar si otros activos dependen de este
    const dependentAssets = await Asset.countDocuments({
      organization: req.user.organization,
      'dependencies.assetId': asset._id
    });

    if (dependentAssets > 0) {
      return res.status(409).json({
        status: 'error',
        message: `No se puede eliminar el activo porque ${dependentAssets} activo(s) dependen de él. Elimine las dependencias primero.`,
        timestamp: new Date().toISOString()
      });
    }

    // Soft delete - cambiar estado a RETIRED
    asset.status = 'RETIRED';
    asset.auditTrail.push({
      action: 'DELETED',
      performedBy: req.user._id,
      details: {
        deletedAt: new Date(),
        reason: req.body.reason || 'No especificada'
      }
    });

    await asset.save();

    res.json({
      status: 'success',
      message: 'Activo eliminado exitosamente',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al eliminar el activo',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Valorar activo según metodología MAGERIT
 * @route   POST /api/assets/:id/valuate
 * @access  Private (admin, analyst)
 */
const valuateAsset = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Datos de valoración inválidos',
        errors: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const asset = await Asset.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!asset) {
      return res.status(404).json({
        status: 'error',
        message: 'Activo no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    const { valuation, economicValue, justification } = req.body;

    // Aplicar nueva valoración
    const previousValuation = { ...asset.valuation };
    asset.valuation = {
      confidentiality: valuation.confidentiality,
      integrity: valuation.integrity,
      availability: valuation.availability,
      authenticity: valuation.authenticity,
      traceability: valuation.traceability
    };

    if (economicValue !== undefined) {
      asset.economicValue = economicValue;
    }

    // Calcular valor sectorial si no está definido
    if (!asset.sectoralFactor || asset.sectoralFactor === 1.0) {
      const organization = await Organization.findById(req.user.organization);
      if (organization?.mageritConfig?.defaultSectoralFactor) {
        asset.sectoralFactor = organization.mageritConfig.defaultSectoralFactor;
      }
    }

    // Registrar auditoría de valoración
    asset.auditTrail.push({
      action: 'VALUED',
      performedBy: req.user._id,
      details: {
        previousValuation,
        newValuation: asset.valuation,
        previousCriticality: asset.criticality.level,
        justification: justification || ''
      }
    });

    await asset.save();

    // Usar servicio MAGERIT para análisis adicional
    const mageritAnalysis = await mageritService.analyzeAssetValuation(asset);

    res.json({
      status: 'success',
      message: 'Activo valorado exitosamente',
      data: {
        asset,
        mageritAnalysis,
        formattedValuation: asset.getFormattedValuation()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error valuating asset:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al valorar el activo',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Calcular dependencias entre activos
 * @route   POST /api/assets/:id/dependencies
 * @access  Private (admin, analyst)
 */
const calculateDependencies = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!asset) {
      return res.status(404).json({
        status: 'error',
        message: 'Activo no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    const { dependencies } = req.body;

    // Validar que los activos de dependencia existen
    const dependencyAssetIds = dependencies.map(dep => dep.assetId);
    const existingAssets = await Asset.find({
      _id: { $in: dependencyAssetIds },
      organization: req.user.organization
    }).select('_id name code');

    const existingAssetIds = existingAssets.map(a => a._id.toString());
    const invalidDependencies = dependencyAssetIds.filter(id => 
      !existingAssetIds.includes(id)
    );

    if (invalidDependencies.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Algunos activos de dependencia no existen',
        invalidAssetIds: invalidDependencies,
        timestamp: new Date().toISOString()
      });
    }

    // Limpiar dependencias existentes
    asset.dependencies = [];

    // Agregar nuevas dependencias
    dependencies.forEach(dep => {
      asset.addDependency(
        dep.assetId,
        dep.dependencyType,
        dep.description,
        dep.impactFactor
      );
    });

    await asset.save();

    // Obtener información completa de dependencias
    await asset.populate({
      path: 'dependencies.assetId',
      select: 'name code type criticality valuation'
    });

    // Calcular análisis de dependencias
    const dependencyAnalysis = await assetService.analyzeDependencies(asset);

    res.json({
      status: 'success',
      message: 'Dependencias calculadas exitosamente',
      data: {
        asset,
        dependencyAnalysis,
        totalImpact: asset.calculateDependencyImpact()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error calculating dependencies:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al calcular dependencias',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Obtener activos por tipo
 * @route   GET /api/assets/by-type/:type
 * @access  Private (admin, analyst, viewer)
 */
const getAssetsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { subtype, status = 'ACTIVE' } = req.query;

    const filters = {
      organization: req.user.organization,
      type
    };

    if (subtype) filters.subtype = subtype;
    if (status !== 'ALL') filters.status = status;

    const assets = await Asset.find(filters)
      .populate('owner.userId', 'profile email')
      .select('name code subtype criticality valuation economicValue owner status')
      .sort({ 'criticality.score': -1, name: 1 })
      .lean();

    // Obtener información del tipo
    const typeInfo = Asset.getAssetTypes();
    const selectedType = Object.values(typeInfo).find(t => t.code === type);

    if (!selectedType) {
      return res.status(404).json({
        status: 'error',
        message: 'Tipo de activo no válido',
        timestamp: new Date().toISOString()
      });
    }

    // Estadísticas por subtipo
    const subtypeStats = {};
    assets.forEach(asset => {
      if (!subtypeStats[asset.subtype]) {
        subtypeStats[asset.subtype] = {
          count: 0,
          totalEconomicValue: 0,
          criticalityDistribution: {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0,
            VERY_LOW: 0
          }
        };
      }
      
      subtypeStats[asset.subtype].count++;
      subtypeStats[asset.subtype].totalEconomicValue += asset.economicValue || 0;
      subtypeStats[asset.subtype].criticalityDistribution[asset.criticality.level]++;
    });

    res.json({
      status: 'success',
      data: {
        assets,
        typeInfo: selectedType,
        subtypeStats,
        totalAssets: assets.length,
        totalEconomicValue: assets.reduce((sum, asset) => sum + (asset.economicValue || 0), 0)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching assets by type:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al obtener activos por tipo',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Obtener activos por organización
 * @route   GET /api/assets/by-organization
 * @access  Private (admin, analyst, viewer)
 */
const getAssetsByOrganization = async (req, res) => {
  try {
    // Resumen ejecutivo de activos
    const summary = await Asset.aggregate([
      { $match: { organization: req.user.organization } },
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalEconomicValue: { $sum: '$economicValue' },
          avgCriticalityScore: { $avg: '$criticality.score' },
          assetsByType: {
            $push: {
              type: '$type',
              criticality: '$criticality.level',
              economicValue: '$economicValue',
              status: '$status'
            }
          }
        }
      }
    ]);

    const typeDistribution = {};
    const criticalityDistribution = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      VERY_LOW: 0
    };
    const statusDistribution = {};

    if (summary.length > 0) {
      summary[0].assetsByType.forEach(asset => {
        // Distribución por tipo
        typeDistribution[asset.type] = (typeDistribution[asset.type] || 0) + 1;
        
        // Distribución por criticidad
        criticalityDistribution[asset.criticality]++;
        
        // Distribución por estado
        statusDistribution[asset.status] = (statusDistribution[asset.status] || 0) + 1;
      });
    }

    // Top 10 activos más críticos
    const topCriticalAssets = await Asset.find({
      organization: req.user.organization,
      status: 'ACTIVE'
    })
      .populate('owner.userId', 'profile email')
      .select('name code type criticality valuation economicValue')
      .sort({ 'criticality.score': -1 })
      .limit(10)
      .lean();

    // Activos con dependencias complejas
    const complexDependencies = await Asset.find({
      organization: req.user.organization,
      $expr: { $gte: [{ $size: '$dependencies' }, 3] }
    })
      .select('name code dependencies criticality')
      .populate('dependencies.assetId', 'name code')
      .lean();

    res.json({
      status: 'success',
      data: {
        summary: summary.length > 0 ? {
          totalAssets: summary[0].totalAssets,
          totalEconomicValue: summary[0].totalEconomicValue,
          avgCriticalityScore: Math.round(summary[0].avgCriticalityScore * 100) / 100
        } : {
          totalAssets: 0,
          totalEconomicValue: 0,
          avgCriticalityScore: 0
        },
        distributions: {
          byType: typeDistribution,
          byCriticality: criticalityDistribution,
          byStatus: statusDistribution
        },
        topCriticalAssets,
        complexDependencies: complexDependencies.length,
        assetTypes: Asset.getAssetTypes()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching assets by organization:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al obtener activos de la organización',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Duplicar configuración de activo
 * @route   POST /api/assets/:id/duplicate
 * @access  Private (admin, analyst)
 */
const duplicateAsset = async (req, res) => {
  try {
    const sourceAsset = await Asset.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!sourceAsset) {
      return res.status(404).json({
        status: 'error',
        message: 'Activo origen no encontrado',
        timestamp: new Date().toISOString()
      });
    }

    const { name, code } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        status: 'error',
        message: 'Nombre y código son requeridos para la duplicación',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar que el código no exista
    const existingAsset = await Asset.findOne({
      organization: req.user.organization,
      code: code.toUpperCase()
    });

    if (existingAsset) {
      return res.status(409).json({
        status: 'error',
        message: 'Ya existe un activo con este código',
        timestamp: new Date().toISOString()
      });
    }

    // Crear nuevo activo basado en el original
    const duplicatedAsset = new Asset({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description: `Duplicado de: ${sourceAsset.name}`,
      type: sourceAsset.type,
      subtype: sourceAsset.subtype,
      valuation: { ...sourceAsset.valuation },
      economicValue: sourceAsset.economicValue,
      sectoralFactor: sourceAsset.sectoralFactor,
      owner: sourceAsset.owner,
      custodian: sourceAsset.custodian,
      location: { ...sourceAsset.location },
      metadata: { ...sourceAsset.metadata },
      organization: req.user.organization,
      status: 'PLANNED'
    });

    await duplicatedAsset.save();

    res.status(201).json({
      status: 'success',
      message: 'Activo duplicado exitosamente',
      data: {
        originalAsset: {
          id: sourceAsset._id,
          name: sourceAsset.name,
          code: sourceAsset.code
        },
        duplicatedAsset
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error duplicating asset:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al duplicar el activo',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * @desc    Exportar listado de activos
 * @route   GET /api/assets/export
 * @access  Private (admin, analyst)
 */
const exportAssets = async (req, res) => {
  try {
    const { format = 'json', type, status } = req.query;

    const filters = { organization: req.user.organization };
    if (type) filters.type = type;
    if (status && status !== 'ALL') filters.status = status;

    const assets = await Asset.find(filters)
      .populate('owner.userId', 'profile email')
      .populate('custodian.userId', 'profile email')
      .sort({ 'criticality.score': -1, name: 1 })
      .lean();

    if (format === 'csv') {
      // Implementar exportación CSV
      const csvData = await assetService.exportToCsv(assets);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=activos-sigrisk.csv');
      return res.send(csvData);
    }

    if (format === 'excel') {
      // Implementar exportación Excel
      const excelBuffer = await assetService.exportToExcel(assets);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=activos-sigrisk.xlsx');
      return res.send(excelBuffer);
    }

    // Formato JSON por defecto
    res.json({
      status: 'success',
      data: {
        assets,
        exportInfo: {
          totalAssets: assets.length,
          exportedAt: new Date().toISOString(),
          format: 'json',
          filters: filters
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error exporting assets:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor al exportar activos',
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  valuateAsset,
  calculateDependencies,
  getAssetsByType,
  getAssetsByOrganization,
  duplicateAsset,
  exportAssets
};