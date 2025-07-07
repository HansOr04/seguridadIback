const Control = require('../models/Control');
const Treatment = require('../models/Treatment');
const { validationResult } = require('express-validator');

// Crear control
exports.createControl = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const controlData = {
      ...req.body,
      organization: req.user.organization
    };

    const control = new Control(controlData);
    await control.save();

    await control.populate([
      { path: 'threats', select: 'name type severity' },
      { path: 'vulnerabilities', select: 'name severity' },
      { path: 'assets', select: 'name type value' },
      { path: 'responsible', select: 'name email' },
      { path: 'owner', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Control creado exitosamente',
      data: control
    });
  } catch (error) {
    console.error('Error al crear control:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener todos los controles
exports.getControls = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      type,
      status,
      maturityLevel,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { organization: req.user.organization, isActive: true };

    if (category) filter.category = category;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (maturityLevel) filter.maturityLevel = parseInt(maturityLevel);

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const controls = await Control.find(filter)
      .populate([
        { path: 'threats', select: 'name type severity' },
        { path: 'vulnerabilities', select: 'name severity' },
        { path: 'assets', select: 'name type value' },
        { path: 'responsible', select: 'name email' },
        { path: 'owner', select: 'name email' }
      ])
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Control.countDocuments(filter);

    res.json({
      success: true,
      data: controls,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error al obtener controles:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener control por ID
exports.getControlById = async (req, res) => {
  try {
    const control = await Control.findOne({
      _id: req.params.id,
      organization: req.user.organization
    }).populate([
      { path: 'threats', select: 'name type severity' },
      { path: 'vulnerabilities', select: 'name severity' },
      { path: 'assets', select: 'name type value' },
      { path: 'responsible', select: 'name email' },
      { path: 'owner', select: 'name email' },
      { path: 'dependencies', select: 'name type status' }
    ]);

    if (!control) {
      return res.status(404).json({
        success: false,
        message: 'Control no encontrado'
      });
    }

    res.json({
      success: true,
      data: control
    });
  } catch (error) {
    console.error('Error al obtener control:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Actualizar control
exports.updateControl = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const control = await Control.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'threats', select: 'name type severity' },
      { path: 'vulnerabilities', select: 'name severity' },
      { path: 'assets', select: 'name type value' },
      { path: 'responsible', select: 'name email' },
      { path: 'owner', select: 'name email' }
    ]);

    if (!control) {
      return res.status(404).json({
        success: false,
        message: 'Control no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Control actualizado exitosamente',
      data: control
    });
  } catch (error) {
    console.error('Error al actualizar control:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar control
exports.deleteControl = async (req, res) => {
  try {
    const control = await Control.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { isActive: false },
      { new: true }
    );

    if (!control) {
      return res.status(404).json({
        success: false,
        message: 'Control no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Control eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar control:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Agregar resultado de prueba
exports.addTestResult = async (req, res) => {
  try {
    const { result, score, notes } = req.body;
    
    const control = await Control.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!control) {
      return res.status(404).json({
        success: false,
        message: 'Control no encontrado'
      });
    }

    await control.addTestResult(result, score, notes, req.user.id);

    res.json({
      success: true,
      message: 'Resultado de prueba agregado exitosamente',
      data: control
    });
  } catch (error) {
    console.error('Error al agregar resultado de prueba:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener catálogo ISO 27002
exports.getISO27002Catalog = async (req, res) => {
  try {
    const catalog = [
      {
        id: 'A.5',
        name: 'Políticas de Seguridad de la Información',
        controls: [
          {
            id: 'A.5.1.1',
            name: 'Políticas para la seguridad de la información',
            objective: 'Proporcionar orientación y apoyo de la dirección para la seguridad de la información'
          },
          {
            id: 'A.5.1.2',
            name: 'Revisión de las políticas para la seguridad de la información',
            objective: 'Asegurar que las políticas se mantengan actualizadas y apropiadas'
          }
        ]
      },
      {
        id: 'A.6',
        name: 'Organización de la Seguridad de la Información',
        controls: [
          {
            id: 'A.6.1.1',
            name: 'Roles y responsabilidades para la seguridad de la información',
            objective: 'Asegurar que las responsabilidades estén claramente definidas'
          },
          {
            id: 'A.6.1.2',
            name: 'Segregación de deberes',
            objective: 'Reducir las oportunidades de modificación no autorizada'
          }
        ]
      },
      {
        id: 'A.7',
        name: 'Seguridad de los Recursos Humanos',
        controls: [
          {
            id: 'A.7.1.1',
            name: 'Investigación de antecedentes',
            objective: 'Asegurar que los empleados sean adecuados para sus roles'
          },
          {
            id: 'A.7.2.1',
            name: 'Términos y condiciones del empleo',
            objective: 'Asegurar que se entiendan las responsabilidades de seguridad'
          }
        ]
      },
      {
        id: 'A.8',
        name: 'Gestión de Activos',
        controls: [
          {
            id: 'A.8.1.1',
            name: 'Inventario de activos',
            objective: 'Identificar activos organizacionales y definir responsabilidades'
          },
          {
            id: 'A.8.2.1',
            name: 'Clasificación de la información',
            objective: 'Asegurar protección apropiada de la información'
          }
        ]
      }
    ];

    res.json({
      success: true,
      data: catalog
    });
  } catch (error) {
    console.error('Error al obtener catálogo ISO 27002:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener estadísticas de controles
exports.getControlStatistics = async (req, res) => {
  try {
    const filter = { organization: req.user.organization, isActive: true };

    const stats = await Control.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalControls: { $sum: 1 },
          averageEffectiveness: { $avg: '$effectiveness' },
          averageCost: { $avg: { $add: ['$implementationCost', '$maintenanceCost'] } },
          byCategory: {
            $push: {
              category: '$category',
              count: 1
            }
          },
          byType: {
            $push: {
              type: '$type',
              count: 1
            }
          },
          byStatus: {
            $push: {
              status: '$status',
              count: 1
            }
          },
          byMaturityLevel: {
            $push: {
              maturityLevel: '$maturityLevel',
              count: 1
            }
          }
        }
      }
    ]);

    // Calcular distribuciones
    const categoryDistribution = {};
    const typeDistribution = {};
    const statusDistribution = {};
    const maturityDistribution = {};

    if (stats.length > 0) {
      stats[0].byCategory.forEach(item => {
        categoryDistribution[item.category] = (categoryDistribution[item.category] || 0) + 1;
      });
      
      stats[0].byType.forEach(item => {
        typeDistribution[item.type] = (typeDistribution[item.type] || 0) + 1;
      });
      
      stats[0].byStatus.forEach(item => {
        statusDistribution[item.status] = (statusDistribution[item.status] || 0) + 1;
      });
      
      stats[0].byMaturityLevel.forEach(item => {
        maturityDistribution[item.maturityLevel] = (maturityDistribution[item.maturityLevel] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        totalControls: stats[0]?.totalControls || 0,
        averageEffectiveness: Math.round(stats[0]?.averageEffectiveness || 0),
        averageCost: Math.round(stats[0]?.averageCost || 0),
        categoryDistribution,
        typeDistribution,
        statusDistribution,
        maturityDistribution
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};