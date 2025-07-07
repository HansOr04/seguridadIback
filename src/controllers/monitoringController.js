const Monitoring = require('../models/Monitoring');
const Asset = require('../models/Asset');
const Risk = require('../models/Risk');
const Control = require('../models/Control');
const { validationResult } = require('express-validator');

// Crear monitoreo
exports.createMonitoring = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const monitoringData = {
      ...req.body,
      organization: req.user.organization,
      responsible: req.body.responsible || req.user.id
    };

    const monitoring = new Monitoring(monitoringData);
    await monitoring.scheduleNext();

    await monitoring.populate([
      { path: 'assets', select: 'name type' },
      { path: 'controls', select: 'name type status' },
      { path: 'risks', select: 'name riskLevel' },
      { path: 'responsible', select: 'name email' },
      { path: 'notifications.recipients', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Monitoreo creado exitosamente',
      data: monitoring
    });
  } catch (error) {
    console.error('Error al crear monitoreo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener todos los monitoreos
exports.getMonitorings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      frequency,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { organization: req.user.organization, isActive: true };

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (frequency) filter.frequency = frequency;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const monitorings = await Monitoring.find(filter)
      .populate([
        { path: 'assets', select: 'name type' },
        { path: 'controls', select: 'name type status' },
        { path: 'risks', select: 'name riskLevel' },
        { path: 'responsible', select: 'name email' }
      ])
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Monitoring.countDocuments(filter);

    res.json({
      success: true,
      data: monitorings,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error al obtener monitoreos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener monitoreo por ID
exports.getMonitoringById = async (req, res) => {
  try {
    const monitoring = await Monitoring.findOne({
      _id: req.params.id,
      organization: req.user.organization
    }).populate([
      { path: 'assets', select: 'name type value' },
      { path: 'controls', select: 'name type status effectiveness' },
      { path: 'risks', select: 'name riskLevel impact probability' },
      { path: 'responsible', select: 'name email' },
      { path: 'notifications.recipients', select: 'name email' }
    ]);

    if (!monitoring) {
      return res.status(404).json({
        success: false,
        message: 'Monitoreo no encontrado'
      });
    }

    res.json({
      success: true,
      data: monitoring
    });
  } catch (error) {
    console.error('Error al obtener monitoreo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Actualizar monitoreo
exports.updateMonitoring = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const monitoring = await Monitoring.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'assets', select: 'name type' },
      { path: 'controls', select: 'name type status' },
      { path: 'risks', select: 'name riskLevel' },
      { path: 'responsible', select: 'name email' }
    ]);

    if (!monitoring) {
      return res.status(404).json({
        success: false,
        message: 'Monitoreo no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Monitoreo actualizado exitosamente',
      data: monitoring
    });
  } catch (error) {
    console.error('Error al actualizar monitoreo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar monitoreo
exports.deleteMonitoring = async (req, res) => {
  try {
    const monitoring = await Monitoring.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { isActive: false, status: 'inactive' },
      { new: true }
    );

    if (!monitoring) {
      return res.status(404).json({
        success: false,
        message: 'Monitoreo no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Monitoreo eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar monitoreo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Ejecutar monitoreo manualmente
exports.executeMonitoring = async (req, res) => {
  try {
    const monitoring = await Monitoring.findOne({
      _id: req.params.id,
      organization: req.user.organization
    }).populate(['assets', 'controls', 'risks']);

    if (!monitoring) {
      return res.status(404).json({
        success: false,
        message: 'Monitoreo no encontrado'
      });
    }

    const startTime = Date.now();
    let result = { status: 'success', score: 100, message: 'Ejecución exitosa' };

    try {
      // Ejecutar según el tipo de monitoreo
      switch (monitoring.type) {
        case 'risk_assessment':
          result = await executeRiskAssessment(monitoring);
          break;
        case 'control_testing':
          result = await executeControlTesting(monitoring);
          break;
        case 'vulnerability_scan':
          result = await executeVulnerabilityScan(monitoring);
          break;
        case 'compliance_check':
          result = await executeComplianceCheck(monitoring);
          break;
        case 'kpi_monitoring':
          result = await executeKPIMonitoring(monitoring);
          break;
        default:
          result = { status: 'error', score: 0, message: 'Tipo de monitoreo no válido' };
      }
    } catch (execError) {
      result = { 
        status: 'error', 
        score: 0, 
        message: `Error en ejecución: ${execError.message}` 
      };
    }

    const executionTime = Date.now() - startTime;
    
    await monitoring.addResult(
      result.status,
      result.score,
      result.message,
      result.details,
      executionTime
    );

    await monitoring.scheduleNext();

    res.json({
      success: true,
      message: 'Monitoreo ejecutado exitosamente',
      data: {
        result,
        executionTime,
        nextExecution: monitoring.nextExecution
      }
    });
  } catch (error) {
    console.error('Error al ejecutar monitoreo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener resultados de monitoreo
exports.getMonitoringResults = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const monitoring = await Monitoring.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!monitoring) {
      return res.status(404).json({
        success: false,
        message: 'Monitoreo no encontrado'
      });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const results = monitoring.results.slice(-endIndex).slice(-limit);

    res.json({
      success: true,
      data: {
        results: results.reverse(),
        total: monitoring.results.length,
        metrics: monitoring.metrics,
        successRate: monitoring.successRate
      }
    });
  } catch (error) {
    console.error('Error al obtener resultados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener dashboard de monitoreo
exports.getMonitoringDashboard = async (req, res) => {
  try {
    const filter = { organization: req.user.organization, isActive: true };

    // Estadísticas generales
    const totalMonitorings = await Monitoring.countDocuments(filter);
    const activeMonitorings = await Monitoring.countDocuments({ ...filter, status: 'active' });
    
    // Monitoreos que necesitan atención
    const now = new Date();
    const overdueMonitorings = await Monitoring.countDocuments({
      ...filter,
      status: 'active',
      nextExecution: { $lt: now }
    });

    // Distribución por tipo
    const typeDistribution = await Monitoring.aggregate([
      { $match: filter },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Distribución por estado
    const statusDistribution = await Monitoring.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Últimos resultados críticos
    const criticalResults = await Monitoring.aggregate([
      { $match: filter },
      { $unwind: '$results' },
      { $match: { 'results.status': { $in: ['warning', 'error'] } } },
      { $sort: { 'results.date': -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: 'responsible',
          foreignField: '_id',
          as: 'responsible'
        }
      },
      {
        $project: {
          name: 1,
          type: 1,
          'results.status': 1,
          'results.score': 1,
          'results.message': 1,
          'results.date': 1,
          'responsible.name': 1,
          'responsible.email': 1
        }
      }
    ]);

    // Tendencias de efectividad
    const effectivenessTrend = await Monitoring.aggregate([
      { $match: filter },
      { $unwind: '$results' },
      {
        $group: {
          _id: {
            year: { $year: '$results.date' },
            month: { $month: '$results.date' }
          },
          averageScore: { $avg: '$results.score' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalMonitorings,
          activeMonitorings,
          overdueMonitorings,
          successRate: activeMonitorings > 0 ? ((activeMonitorings - overdueMonitorings) / activeMonitorings) * 100 : 0
        },
        distributions: {
          type: typeDistribution.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          status: statusDistribution.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {})
        },
        criticalResults,
        effectivenessTrend
      }
    });
  } catch (error) {
    console.error('Error al obtener dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Funciones auxiliares para ejecutar diferentes tipos de monitoreo
async function executeRiskAssessment(monitoring) {
  const risks = await Risk.find({ 
    organization: monitoring.organization,
    _id: { $in: monitoring.risks }
  });

  let totalScore = 0;
  let highRisks = 0;
  
  risks.forEach(risk => {
    if (risk.riskLevel === 'high' || risk.riskLevel === 'very_high') {
      highRisks++;
    }
    totalScore += risk.impact * risk.probability;
  });

  const averageRisk = risks.length > 0 ? totalScore / risks.length : 0;
  const score = Math.max(0, 100 - (averageRisk * 10) - (highRisks * 5));

  return {
    status: score >= 70 ? 'success' : score >= 40 ? 'warning' : 'error',
    score: Math.round(score),
    message: `Evaluación completada. ${highRisks} riesgos altos encontrados.`,
    details: {
      totalRisks: risks.length,
      highRisks,
      averageRisk: Math.round(averageRisk * 100) / 100
    }
  };
}

async function executeControlTesting(monitoring) {
  const controls = await Control.find({
    organization: monitoring.organization,
    _id: { $in: monitoring.controls }
  });

  let totalEffectiveness = 0;
  let implementedControls = 0;

  controls.forEach(control => {
    if (control.status === 'implemented' || control.status === 'monitoring') {
      implementedControls++;
      totalEffectiveness += control.effectiveness;
    }
  });

  const averageEffectiveness = implementedControls > 0 ? totalEffectiveness / implementedControls : 0;
  const implementationRate = controls.length > 0 ? (implementedControls / controls.length) * 100 : 0;

  return {
    status: averageEffectiveness >= 80 ? 'success' : averageEffectiveness >= 60 ? 'warning' : 'error',
    score: Math.round(averageEffectiveness),
    message: `${implementedControls}/${controls.length} controles implementados.`,
    details: {
      totalControls: controls.length,
      implementedControls,
      averageEffectiveness: Math.round(averageEffectiveness),
      implementationRate: Math.round(implementationRate)
    }
  };
}

async function executeVulnerabilityScan(monitoring) {
  // Simulación de escaneo de vulnerabilidades
  const assets = await Asset.find({
    organization: monitoring.organization,
    _id: { $in: monitoring.assets }
  });

  const vulnerabilities = Math.floor(Math.random() * assets.length * 0.3);
  const criticalVulns = Math.floor(vulnerabilities * 0.1);
  const score = Math.max(0, 100 - (vulnerabilities * 2) - (criticalVulns * 10));

  return {
    status: criticalVulns === 0 ? 'success' : criticalVulns <= 2 ? 'warning' : 'error',
    score: Math.round(score),
    message: `Escaneo completado. ${vulnerabilities} vulnerabilidades encontradas.`,
    details: {
      totalAssets: assets.length,
      vulnerabilities,
      criticalVulnerabilities: criticalVulns,
      lowRiskVulnerabilities: vulnerabilities - criticalVulns
    }
  };
}

async function executeComplianceCheck(monitoring) {
  const controls = await Control.find({
    organization: monitoring.organization,
    _id: { $in: monitoring.controls }
  });

  let compliantControls = 0;
  controls.forEach(control => {
    if (control.status === 'implemented' && control.effectiveness >= 80) {
      compliantControls++;
    }
  });

  const complianceRate = controls.length > 0 ? (compliantControls / controls.length) * 100 : 0;

  return {
    status: complianceRate >= 90 ? 'success' : complianceRate >= 70 ? 'warning' : 'error',
    score: Math.round(complianceRate),
    message: `${compliantControls}/${controls.length} controles cumplen los requisitos.`,
    details: {
      totalControls: controls.length,
      compliantControls,
      complianceRate: Math.round(complianceRate),
      nonCompliantControls: controls.length - compliantControls
    }
  };
}

async function executeKPIMonitoring(monitoring) {
  // KPIs básicos del sistema
  const assets = await Asset.countDocuments({ organization: monitoring.organization });
  const risks = await Risk.countDocuments({ organization: monitoring.organization });
  const controls = await Control.countDocuments({ organization: monitoring.organization, status: 'implemented' });
  
  const kpiScore = Math.min(100, (assets * 2) + (controls * 3) + (risks > 0 ? 20 : 0));

  return {
    status: kpiScore >= 80 ? 'success' : kpiScore >= 60 ? 'warning' : 'info',
    score: Math.round(kpiScore),
    message: `KPIs actualizados. Sistema en ${kpiScore >= 80 ? 'buen' : 'regular'} estado.`,
    details: {
      totalAssets: assets,
      totalRisks: risks,
      implementedControls: controls,
      systemMaturity: Math.round(kpiScore)
    }
  };
}