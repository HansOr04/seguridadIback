const Treatment = require('../models/Treatment');
const Control = require('../models/Control');
const Risk = require('../models/Risk');
const Asset = require('../models/Asset');
const { validationResult } = require('express-validator');

// Crear tratamiento
exports.createTreatment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const treatmentData = {
      ...req.body,
      organization: req.user.organization
    };

    const treatment = new Treatment(treatmentData);
    await treatment.save();

    await treatment.populate([
      { path: 'riskId', select: 'name riskLevel' },
      { path: 'assetId', select: 'name type' },
      { path: 'controls', select: 'name type effectiveness' },
      { path: 'responsible', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Tratamiento creado exitosamente',
      data: treatment
    });
  } catch (error) {
    console.error('Error al crear tratamiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener todos los tratamientos
exports.getTreatments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { organization: req.user.organization, isActive: true };

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const treatments = await Treatment.find(filter)
      .populate([
        { path: 'riskId', select: 'name riskLevel impact probability' },
        { path: 'assetId', select: 'name type value' },
        { path: 'controls', select: 'name type effectiveness status' },
        { path: 'responsible', select: 'name email' },
        { path: 'approvedBy', select: 'name email' }
      ])
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Treatment.countDocuments(filter);

    res.json({
      success: true,
      data: treatments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error al obtener tratamientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener tratamiento por ID
exports.getTreatmentById = async (req, res) => {
  try {
    const treatment = await Treatment.findOne({
      _id: req.params.id,
      organization: req.user.organization
    }).populate([
      { path: 'riskId', select: 'name riskLevel impact probability' },
      { path: 'assetId', select: 'name type value' },
      { path: 'controls', select: 'name type effectiveness status' },
      { path: 'responsible', select: 'name email' },
      { path: 'approvedBy', select: 'name email' }
    ]);

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Tratamiento no encontrado'
      });
    }

    res.json({
      success: true,
      data: treatment
    });
  } catch (error) {
    console.error('Error al obtener tratamiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Actualizar tratamiento
exports.updateTreatment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const treatment = await Treatment.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'riskId', select: 'name riskLevel' },
      { path: 'assetId', select: 'name type' },
      { path: 'controls', select: 'name type effectiveness' },
      { path: 'responsible', select: 'name email' }
    ]);

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Tratamiento no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Tratamiento actualizado exitosamente',
      data: treatment
    });
  } catch (error) {
    console.error('Error al actualizar tratamiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar tratamiento
exports.deleteTreatment = async (req, res) => {
  try {
    const treatment = await Treatment.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { isActive: false },
      { new: true }
    );

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Tratamiento no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Tratamiento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar tratamiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Calcular análisis costo-beneficio
exports.calculateCostBenefit = async (req, res) => {
  try {
    const treatment = await Treatment.findOne({
      _id: req.params.id,
      organization: req.user.organization
    }).populate('riskId');

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Tratamiento no encontrado'
      });
    }

    const totalCost = treatment.implementationCost + treatment.maintenanceCost;
    const riskValue = treatment.riskId ? treatment.riskId.annualLossExpectancy || 0 : 0;
    const reducedRisk = riskValue * (treatment.riskReduction / 100);
    const netBenefit = reducedRisk - totalCost;
    const roi = totalCost > 0 ? ((reducedRisk - totalCost) / totalCost) * 100 : 0;

    const analysis = {
      totalCost,
      riskValue,
      reducedRisk,
      netBenefit,
      roi,
      paybackPeriod: netBenefit > 0 ? totalCost / reducedRisk : null,
      recommendation: netBenefit > 0 ? 'Recomendado' : 'No recomendado'
    };

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error al calcular costo-beneficio:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener estadísticas de tratamientos
exports.getTreatmentStatistics = async (req, res) => {
  try {
    const filter = { organization: req.user.organization, isActive: true };

    const stats = await Treatment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalTreatments: { $sum: 1 },
          averageCost: { $avg: { $add: ['$implementationCost', '$maintenanceCost'] } },
          averageROI: { $avg: '$roi' },
          averageRiskReduction: { $avg: '$riskReduction' },
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
          byPriority: {
            $push: {
              priority: '$priority',
              count: 1
            }
          }
        }
      }
    ]);

    // Calcular distribuciones
    const typeDistribution = {};
    const statusDistribution = {};
    const priorityDistribution = {};

    if (stats.length > 0) {
      stats[0].byType.forEach(item => {
        typeDistribution[item.type] = (typeDistribution[item.type] || 0) + 1;
      });
      
      stats[0].byStatus.forEach(item => {
        statusDistribution[item.status] = (statusDistribution[item.status] || 0) + 1;
      });
      
      stats[0].byPriority.forEach(item => {
        priorityDistribution[item.priority] = (priorityDistribution[item.priority] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        totalTreatments: stats[0]?.totalTreatments || 0,
        averageCost: Math.round(stats[0]?.averageCost || 0),
        averageROI: Math.round(stats[0]?.averageROI || 0),
        averageRiskReduction: Math.round(stats[0]?.averageRiskReduction || 0),
        typeDistribution,
        statusDistribution,
        priorityDistribution
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

// Aprobar tratamiento
exports.approveTreatment = async (req, res) => {
  try {
    const treatment = await Treatment.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      {
        approvedBy: req.user.id,
        approvedDate: new Date(),
        status: 'in_progress'
      },
      { new: true }
    ).populate([
      { path: 'riskId', select: 'name riskLevel' },
      { path: 'assetId', select: 'name type' },
      { path: 'approvedBy', select: 'name email' }
    ]);

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Tratamiento no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Tratamiento aprobado exitosamente',
      data: treatment
    });
  } catch (error) {
    console.error('Error al aprobar tratamiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};