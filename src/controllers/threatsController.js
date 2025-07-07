const { validationResult } = require('express-validator');
const Threat = require('../models/Threat');

/**
 * Controlador para gestión completa de amenazas MAGERIT
 */
class ThreatsController {

  /**
   * @desc    Listar amenazas con filtros
   * @route   GET /api/threats
   * @access  Private
   */
  static async getThreats(req, res) {
    try {
      const organizationId = req.user.organization;
      const {
        page = 1,
        limit = 25,
        category,
        isStandard,
        search,
        sortBy = 'mageritCode',
        sortOrder = 'asc'
      } = req.query;

      // Construir filtros
      const filters = { organization: organizationId };
      
      if (category) {
        filters.category = category;
      }
      
      if (isStandard !== undefined) {
        filters.isStandard = isStandard === 'true';
      }
      
      if (search) {
        filters.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { mageritCode: { $regex: search, $options: 'i' } }
        ];
      }

      // Configurar ordenamiento
      const sortConfig = {};
      sortConfig[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Ejecutar consulta
      const [threats, totalCount] = await Promise.all([
        Threat.find(filters)
          .populate('createdBy', 'firstName lastName')
          .populate('updatedBy', 'firstName lastName')
          .sort(sortConfig)
          .skip(skip)
          .limit(parseInt(limit)),
        Threat.countDocuments(filters)
      ]);

      const response = {
        status: 'success',
        data: {
          threats: threats.map(threat => ({
            id: threat._id,
            mageritCode: threat.mageritCode,
            name: threat.name,
            description: threat.description,
            category: threat.category,
            baseProbability: threat.baseProbability,
            probabilityLevel: threat.probabilityLevel,
            affectedDimensions: threat.affectedDimensions,
            susceptibleAssetTypes: threat.susceptibleAssetTypes,
            impactMultiplier: threat.impactMultiplier,
            temporalFactor: threat.temporalFactor,
            geographicFactor: threat.geographicFactor,
            cveIntegration: threat.cveIntegration,
            isStandard: threat.isStandard,
            status: threat.status,
            version: threat.version,
            createdBy: threat.createdBy,
            createdAt: threat.createdAt,
            updatedAt: threat.updatedAt,
            riskLevel: threat.riskLevel // Virtual
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / parseInt(limit))
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error listando amenazas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo lista de amenazas',
        error: error.message
      });
    }
  }

  /**
   * @desc    Obtener amenaza específica
   * @route   GET /api/threats/:id
   * @access  Private
   */
  static async getThreatById(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization;

      const threat = await Threat.findOne({
        _id: id,
        organization: organizationId
      })
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .populate('customization.originalThreatId');

      if (!threat) {
        return res.status(404).json({
          status: 'error',
          message: 'Amenaza no encontrada'
        });
      }

      // Obtener CVEs relacionados activos si la integración está habilitada
      let activeCVEs = [];
      if (threat.cveIntegration.enabled) {
        activeCVEs = threat.getActiveCVEs();
      }

      const response = {
        status: 'success',
        data: {
          threat: {
            ...threat.toObject(),
            activeCVEs,
            adjustedProbability: threat.calculateAdjustedProbability()
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error obteniendo amenaza:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo detalle de amenaza',
        error: error.message
      });
    }
  }

  /**
   * @desc    Crear nueva amenaza personalizada
   * @route   POST /api/threats
   * @access  Private (admin, analyst)
   */
  static async createThreat(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const organizationId = req.user.organization;
      const userId = req.user.id;

      // Verificar que el código MAGERIT no exista para la organización
      const existingThreat = await Threat.findOne({
        mageritCode: req.body.mageritCode,
        organization: organizationId
      });

      if (existingThreat) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe una amenaza con este código MAGERIT en la organización'
        });
      }

      const threatData = {
        ...req.body,
        organization: organizationId,
        createdBy: userId,
        isStandard: false // Las amenazas creadas por usuarios son personalizadas
      };

      const newThreat = new Threat(threatData);
      await newThreat.save();

      const response = {
        status: 'success',
        message: 'Amenaza creada exitosamente',
        data: {
          threat: {
            id: newThreat._id,
            mageritCode: newThreat.mageritCode,
            name: newThreat.name,
            category: newThreat.category,
            baseProbability: newThreat.baseProbability,
            probabilityLevel: newThreat.probabilityLevel
          }
        }
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error creando amenaza:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error creando amenaza',
        error: error.message
      });
    }
  }

  /**
   * @desc    Actualizar amenaza personalizada
   * @route   PUT /api/threats/:id
   * @access  Private (admin, analyst)
   */
  static async updateThreat(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const organizationId = req.user.organization;
      const userId = req.user.id;

      const threat = await Threat.findOne({
        _id: id,
        organization: organizationId
      });

      if (!threat) {
        return res.status(404).json({
          status: 'error',
          message: 'Amenaza no encontrada'
        });
      }

      // No permitir editar amenazas estándar directamente
      if (threat.isStandard) {
        return res.status(403).json({
          status: 'error',
          message: 'No se pueden editar amenazas estándar. Cree una personalización en su lugar.'
        });
      }

      // Campos actualizables
      const allowedUpdates = [
        'name',
        'description',
        'baseProbability',
        'affectedDimensions',
        'susceptibleAssetTypes',
        'impactMultiplier',
        'temporalFactor',
        'geographicFactor',
        'cveIntegration'
      ];

      // Aplicar actualizaciones
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          threat[field] = req.body[field];
        }
      });

      threat.updatedBy = userId;
      await threat.save();

      const response = {
        status: 'success',
        message: 'Amenaza actualizada exitosamente',
        data: {
          threat: {
            id: threat._id,
            mageritCode: threat.mageritCode,
            name: threat.name,
            baseProbability: threat.baseProbability,
            probabilityLevel: threat.probabilityLevel,
            updatedAt: threat.updatedAt
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error actualizando amenaza:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error actualizando amenaza',
        error: error.message
      });
    }
  }

  /**
   * @desc    Cargar catálogo estándar MAGERIT
   * @route   POST /api/threats/load-standard-catalog
   * @access  Private (admin)
   */
  static async loadStandardCatalog(req, res) {
    try {
      const organizationId = req.user.organization;
      const userId = req.user.id;

      // Verificar si ya existen amenazas estándar
      const existingStandard = await Threat.countDocuments({
        organization: organizationId,
        isStandard: true
      });

      if (existingStandard > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'El catálogo estándar ya ha sido cargado para esta organización'
        });
      }

      // Cargar catálogo estándar
      const result = await Threat.loadStandardCatalog(organizationId, userId);

      const response = {
        status: 'success',
        message: `Catálogo estándar MAGERIT cargado exitosamente`,
        data: {
          threatsLoaded: result.count
        }
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error cargando catálogo estándar:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error cargando catálogo estándar',
        error: error.message
      });
    }
  }

  /**
   * @desc    Personalizar amenaza estándar
   * @route   POST /api/threats/:id/customize
   * @access  Private (admin, analyst)
   */
  static async customizeThreat(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const organizationId = req.user.organization;
      const userId = req.user.id;

      const originalThreat = await Threat.findOne({
        _id: id,
        organization: organizationId,
        isStandard: true
      });

      if (!originalThreat) {
        return res.status(404).json({
          status: 'error',
          message: 'Amenaza estándar no encontrada'
        });
      }

      // Crear nueva amenaza personalizada basada en la estándar
      const customThreatData = {
        ...originalThreat.toObject(),
        _id: undefined,
        mageritCode: req.body.mageritCode || `${originalThreat.mageritCode}_CUSTOM`,
        name: req.body.name || `${originalThreat.name} (Personalizada)`,
        description: req.body.description || originalThreat.description,
        baseProbability: req.body.baseProbability || originalThreat.baseProbability,
        isStandard: false,
        customization: {
          originalThreatId: originalThreat._id,
          customFields: req.body.customFields || {}
        },
        createdBy: userId,
        updatedBy: userId
      };

      // Aplicar personalizaciones específicas
      if (req.body.affectedDimensions) {
        customThreatData.affectedDimensions = req.body.affectedDimensions;
      }
      if (req.body.susceptibleAssetTypes) {
        customThreatData.susceptibleAssetTypes = req.body.susceptibleAssetTypes;
      }
      if (req.body.impactMultiplier) {
        customThreatData.impactMultiplier = req.body.impactMultiplier;
      }
      if (req.body.temporalFactor) {
        customThreatData.temporalFactor = req.body.temporalFactor;
      }
      if (req.body.geographicFactor) {
        customThreatData.geographicFactor = req.body.geographicFactor;
      }

      const customThreat = new Threat(customThreatData);
      await customThreat.save();

      const response = {
        status: 'success',
        message: 'Amenaza personalizada creada exitosamente',
        data: {
          customThreat: {
            id: customThreat._id,
            mageritCode: customThreat.mageritCode,
            name: customThreat.name,
            baseProbability: customThreat.baseProbability,
            originalThreat: {
              id: originalThreat._id,
              mageritCode: originalThreat.mageritCode,
              name: originalThreat.name
            }
          }
        }
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error personalizando amenaza:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error creando personalización de amenaza',
        error: error.message
      });
    }
  }

  /**
   * @desc    Obtener estadísticas de amenazas
   * @route   GET /api/threats/statistics
   * @access  Private
   */
  static async getStatistics(req, res) {
    try {
      const organizationId = req.user.organization;

      // Estadísticas por categoría
      const categoryStats = await Threat.aggregate([
        { $match: { organization: organizationId } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]);

      // Estadísticas por nivel de probabilidad
      const probabilityStats = await Threat.aggregate([
        { $match: { organization: organizationId } },
        { $group: { _id: '$probabilityLevel', count: { $sum: 1 } } }
      ]);

      // Estadísticas estándar vs personalizada
      const typeStats = await Threat.aggregate([
        { $match: { organization: organizationId } },
        { $group: { _id: '$isStandard', count: { $sum: 1 } } }
      ]);

      // Amenazas con integración CVE habilitada
      const cveIntegrationCount = await Threat.countDocuments({
        organization: organizationId,
        'cveIntegration.enabled': true
      });

      // Total de amenazas
      const totalThreats = await Threat.countDocuments({
        organization: organizationId
      });

      const response = {
        status: 'success',
        data: {
          totalThreats,
          categoryDistribution: categoryStats,
          probabilityDistribution: probabilityStats,
          typeDistribution: typeStats.map(stat => ({
            type: stat._id ? 'standard' : 'custom',
            count: stat.count
          })),
          cveIntegrationEnabled: cveIntegrationCount,
          generatedAt: new Date()
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error obteniendo estadísticas de amenazas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo estadísticas de amenazas',
        error: error.message
      });
    }
  }

  /**
   * @desc    Buscar amenazas por activo compatible
   * @route   GET /api/threats/by-asset/:assetId
   * @access  Private
   */
  static async getThreatsByAsset(req, res) {
    try {
      const { assetId } = req.params;
      const organizationId = req.user.organization;

      // Obtener el activo para conocer su tipo
      const Asset = require('../models/Asset');
      const asset = await Asset.findOne({
        _id: assetId,
        organization: organizationId
      });

      if (!asset) {
        return res.status(404).json({
          status: 'error',
          message: 'Activo no encontrado'
        });
      }

      // Buscar amenazas que apliquen a este tipo de activo
      const applicableThreats = await Threat.find({
        organization: organizationId,
        $or: [
          { susceptibleAssetTypes: asset.type },
          { susceptibleAssetTypes: { $size: 0 } } // Amenazas que aplican a todos los tipos
        ],
        status: 'active'
      })
      .sort({ baseProbability: -1, mageritCode: 1 });

      // Calcular probabilidad ajustada para cada amenaza
      const threatsWithAdjustedProbability = applicableThreats.map(threat => ({
        id: threat._id,
        mageritCode: threat.mageritCode,
        name: threat.name,
        description: threat.description,
        category: threat.category,
        baseProbability: threat.baseProbability,
        adjustedProbability: threat.calculateAdjustedProbability(),
        probabilityLevel: threat.probabilityLevel,
        affectedDimensions: threat.affectedDimensions,
        impactMultiplier: threat.impactMultiplier,
        isStandard: threat.isStandard,
        applicabilityScore: threat.susceptibleAssetTypes.includes(asset.type) ? 1.0 : 0.5
      }));

      const response = {
        status: 'success',
        data: {
          asset: {
            id: asset._id,
            name: asset.name,
            type: asset.type
          },
          applicableThreats: threatsWithAdjustedProbability,
          totalApplicable: threatsWithAdjustedProbability.length
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error obteniendo amenazas por activo:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo amenazas aplicables al activo',
        error: error.message
      });
    }
  }

  /**
   * @desc    Exportar catálogo de amenazas
   * @route   GET /api/threats/export
   * @access  Private
   */
  static async exportThreats(req, res) {
    try {
      const organizationId = req.user.organization;
      const { format = 'json', includeCustom = 'true' } = req.query;

      const filters = { organization: organizationId };
      
      if (includeCustom === 'false') {
        filters.isStandard = true;
      }

      const threats = await Threat.find(filters)
        .select('-organization -createdBy -updatedBy -__v')
        .sort({ mageritCode: 1 });

      if (format === 'csv') {
        // Generar CSV
        const csvData = this.generateCSV(threats);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="amenazas_magerit.csv"');
        res.send(csvData);
        
      } else {
        // Formato JSON por defecto
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="amenazas_magerit.json"');
        
        const exportData = {
          exportDate: new Date(),
          organization: organizationId,
          totalThreats: threats.length,
          format: 'MAGERIT v3.0',
          threats: threats
        };
        
        res.json(exportData);
      }

    } catch (error) {
      console.error('Error exportando amenazas:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error exportando catálogo de amenazas',
        error: error.message
      });
    }
  }

  /**
   * @desc    Eliminar amenaza personalizada
   * @route   DELETE /api/threats/:id
   * @access  Private (admin)
   */
  static async deleteThreat(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization;

      const threat = await Threat.findOne({
        _id: id,
        organization: organizationId
      });

      if (!threat) {
        return res.status(404).json({
          status: 'error',
          message: 'Amenaza no encontrada'
        });
      }

      // No permitir eliminar amenazas estándar
      if (threat.isStandard) {
        return res.status(403).json({
          status: 'error',
          message: 'No se pueden eliminar amenazas estándar de MAGERIT'
        });
      }

      // Verificar si la amenaza está siendo utilizada en riesgos
      const Risk = require('../models/Risk');
      const risksUsingThreat = await Risk.countDocuments({
        threat: id,
        organization: organizationId
      });

      if (risksUsingThreat > 0) {
        return res.status(409).json({
          status: 'error',
          message: `No se puede eliminar la amenaza porque está siendo utilizada en ${risksUsingThreat} riesgo(s)`
        });
      }

      await Threat.findByIdAndDelete(id);

      res.json({
        status: 'success',
        message: 'Amenaza eliminada exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando amenaza:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error eliminando amenaza',
        error: error.message
      });
    }
  }

  /**
   * @desc    Sincronizar CVEs para amenazas con integración habilitada
   * @route   POST /api/threats/sync-cve
   * @access  Private (admin)
   */
  static async syncCVEIntegration(req, res) {
    try {
      const organizationId = req.user.organization;

      // Obtener amenazas con integración CVE habilitada
      const threatsWithCVE = await Threat.find({
        organization: organizationId,
        'cveIntegration.enabled': true
      });

      if (threatsWithCVE.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'No hay amenazas con integración CVE habilitada'
        });
      }

      const results = {
        processed: 0,
        updated: 0,
        errors: []
      };

      // Proceso de sincronización para cada amenaza
      for (const threat of threatsWithCVE) {
        try {
          // Buscar CVEs relacionados basado en patrones
          const CVE = require('../models/CVE');
          
          if (threat.cveIntegration.cvePatterns && threat.cveIntegration.cvePatterns.length > 0) {
            const relatedCVEs = await CVE.find({
              $or: threat.cveIntegration.cvePatterns.map(pattern => ({
                description: { $regex: pattern, $options: 'i' }
              }))
            })
            .sort({ publishedDate: -1 })
            .limit(10);

            // Actualizar CVEs relacionados en la amenaza
            threat.cveIntegration.relatedCves = relatedCVEs.map(cve => ({
              cveId: cve.cveId,
              cvssScore: cve.cvssV3?.baseScore || 0,
              dateFound: new Date()
            }));

            threat.cveIntegration.lastCveSync = new Date();
            await threat.save();

            results.updated++;
          }

          results.processed++;

        } catch (error) {
          results.errors.push({
            threatId: threat._id,
            mageritCode: threat.mageritCode,
            error: error.message
          });
        }
      }

      const response = {
        status: 'success',
        message: `Sincronización CVE completada: ${results.updated} amenazas actualizadas`,
        data: results
      };

      res.json(response);

    } catch (error) {
      console.error('Error sincronizando integración CVE:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error sincronizando integración CVE',
        error: error.message
      });
    }
  }

  // Método auxiliar para generar CSV
  static generateCSV(threats) {
    const headers = [
      'Código MAGERIT',
      'Nombre',
      'Descripción',
      'Categoría',
      'Probabilidad Base',
      'Nivel Probabilidad',
      'Confidencialidad',
      'Integridad',
      'Disponibilidad',
      'Autenticidad',
      'Trazabilidad',
      'Tipos de Activos',
      'Es Estándar',
      'Estado'
    ];

    const csvRows = [headers.join(',')];

    threats.forEach(threat => {
      const row = [
        threat.mageritCode,
        `"${threat.name}"`,
        `"${threat.description.replace(/"/g, '""')}"`,
        threat.category,
        threat.baseProbability,
        threat.probabilityLevel,
        threat.affectedDimensions.confidentiality,
        threat.affectedDimensions.integrity,
        threat.affectedDimensions.availability,
        threat.affectedDimensions.authenticity,
        threat.affectedDimensions.traceability,
        `"${threat.susceptibleAssetTypes.join(', ')}"`,
        threat.isStandard,
        threat.status
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }
}

module.exports = ThreatsController;