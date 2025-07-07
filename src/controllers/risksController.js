const { validationResult } = require('express-validator');
const Risk = require('../models/Risk');
const RiskMatrix = require('../models/RiskMatrix');
const RiskCalculationService = require('../services/riskCalculationService');
const Asset = require('../models/Asset');
const Threat = require('../models/Threat');
const Vulnerability = require('../models/Vulnerability');

/**
 * Controlador para gestión de riesgos MAGERIT
 */
class RisksController {

  /**
   * @desc    Obtener dashboard de riesgos organizacional
   * @route   GET /api/risks/dashboard
   * @access  Private (admin, analyst)
   */
  static async getDashboard(req, res) {
    try {
      const organizationId = req.user.organization;

      // Obtener métricas agregadas
      const aggregatedMetrics = await RiskCalculationService.calculateAggregatedRiskMetrics(organizationId);
      
      // Obtener datos del dashboard desde el modelo
      const dashboardData = await Risk.getDashboardData(organizationId);
      
      // Calcular VaR organizacional
      const varData = await RiskCalculationService.calculateOrganizationalVaR(organizationId);
      
      // Obtener riesgos críticos recientes
      const criticalRisks = await Risk.find({
        organization: organizationId,
        'classification.riskLevel': { $in: ['critical', 'high'] },
        'treatment.status': { $in: ['identified', 'analyzed'] }
      })
      .populate('asset', 'name type')
      .populate('threat', 'name mageritCode')
      .sort({ 'calculation.adjustedRisk': -1 })
      .limit(10);

      // Obtener matriz de riesgo activa
      const activeMatrix = await RiskMatrix.getActiveMatrix(organizationId);

      const response = {
        status: 'success',
        data: {
          summary: {
            totalRisks: dashboardData.totalRisks,
            averageRisk: dashboardData.averageRisk,
            criticalCount: aggregatedMetrics.riskByLevel.critical || 0,
            highCount: aggregatedMetrics.riskByLevel.high || 0
          },
          metrics: aggregatedMetrics,
          valueAtRisk: varData,
          criticalRisks: criticalRisks.map(risk => ({
            riskId: risk.riskId,
            name: risk.name,
            assetName: risk.asset?.name,
            threatCode: risk.threat?.mageritCode,
            riskLevel: risk.classification.riskLevel,
            adjustedRisk: risk.calculation.adjustedRisk,
            economicImpact: risk.calculation.economicImpact.expectedLoss,
            treatmentStatus: risk.treatment.status
          })),
          matrix: activeMatrix ? {
            name: activeMatrix.name,
            dimensions: activeMatrix.dimensions,
            tolerance: activeMatrix.riskTolerance
          } : null
        },
        timestamp: new Date()
      };

      res.json(response);

    } catch (error) {
      console.error('Error en dashboard de riesgos:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo dashboard de riesgos',
        error: error.message
      });
    }
  }

  /**
   * @desc    Listar riesgos con filtros y paginación
   * @route   GET /api/risks
   * @access  Private
   */
  static async getRisks(req, res) {
    try {
      const organizationId = req.user.organization;
      const {
        page = 1,
        limit = 25,
        riskLevel,
        category,
        status,
        assetType,
        search,
        sortBy = 'adjustedRisk',
        sortOrder = 'desc'
      } = req.query;

      // Construir filtros
      const filters = { organization: organizationId };
      
      if (riskLevel) {
        filters['classification.riskLevel'] = Array.isArray(riskLevel) 
          ? { $in: riskLevel } 
          : riskLevel;
      }
      
      if (category) {
        filters['classification.riskCategory'] = category;
      }
      
      if (status) {
        filters['treatment.status'] = status;
      }
      
      if (search) {
        filters.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { riskId: { $regex: search, $options: 'i' } }
        ];
      }

      // Configurar ordenamiento
      const sortConfig = {};
      const sortField = sortBy === 'adjustedRisk' ? 'calculation.adjustedRisk' : 
                       sortBy === 'economicImpact' ? 'calculation.economicImpact.expectedLoss' :
                       sortBy === 'created' ? 'createdAt' : 'calculation.adjustedRisk';
      
      sortConfig[sortField] = sortOrder === 'asc' ? 1 : -1;

      // Paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Ejecutar consulta
      const [risks, totalCount] = await Promise.all([
        Risk.find(filters)
          .populate('asset', 'name type businessFunction')
          .populate('threat', 'name mageritCode category')
          .populate('vulnerability', 'name severityLevel')
          .sort(sortConfig)
          .skip(skip)
          .limit(parseInt(limit)),
        Risk.countDocuments(filters)
      ]);

      // Filtrar por tipo de activo si se especifica
      let filteredRisks = risks;
      if (assetType) {
        filteredRisks = risks.filter(risk => risk.asset?.type === assetType);
      }

      const response = {
        status: 'success',
        data: {
          risks: filteredRisks.map(risk => ({
            id: risk._id,
            riskId: risk.riskId,
            name: risk.name,
            description: risk.description,
            asset: {
              id: risk.asset?._id,
              name: risk.asset?.name,
              type: risk.asset?.type,
              businessFunction: risk.asset?.businessFunction
            },
            threat: {
              id: risk.threat?._id,
              name: risk.threat?.name,
              code: risk.threat?.mageritCode,
              category: risk.threat?.category
            },
            vulnerability: {
              id: risk.vulnerability?._id,
              name: risk.vulnerability?.name,
              severity: risk.vulnerability?.severityLevel
            },
            calculation: {
              adjustedRisk: risk.calculation.adjustedRisk,
              baseRisk: risk.calculation.baseRisk,
              economicImpact: risk.calculation.economicImpact.expectedLoss
            },
            classification: risk.classification,
            riskMatrix: risk.riskMatrix,
            treatment: {
              strategy: risk.treatment.strategy,
              status: risk.treatment.status,
              priority: risk.treatment.priority
            },
            monitoring: {
              nextReviewDate: risk.monitoring.nextReviewDate,
              assignedTo: risk.monitoring.assignedTo
            },
            createdAt: risk.createdAt,
            updatedAt: risk.updatedAt
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
      console.error('Error listando riesgos:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo lista de riesgos',
        error: error.message
      });
    }
  }

  /**
   * @desc    Obtener detalle de un riesgo específico
   * @route   GET /api/risks/:id
   * @access  Private
   */
  static async getRiskById(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization;

      const risk = await Risk.findOne({
        _id: id,
        organization: organizationId
      })
      .populate('asset')
      .populate('threat')
      .populate('vulnerability')
      .populate('treatment.appliedControls.control')
      .populate('monitoring.assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

      if (!risk) {
        return res.status(404).json({
          status: 'error',
          message: 'Riesgo no encontrado'
        });
      }

      // Calcular riesgo residual
      const residualRisk = risk.calculateResidualRisk();

      // Obtener histórico de cambios recientes
      const recentHistory = risk.riskHistory.slice(-10);

      const response = {
        status: 'success',
        data: {
          risk: {
            ...risk.toObject(),
            residualRisk,
            recentHistory
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error obteniendo detalle de riesgo:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo detalle del riesgo',
        error: error.message
      });
    }
  }

  /**
   * @desc    Crear nuevo riesgo calculado
   * @route   POST /api/risks/calculate
   * @access  Private (admin, analyst)
   */
  static async calculateRisk(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { assetId, threatId, vulnerabilityId } = req.body;
      const organizationId = req.user.organization;
      const userId = req.user.id;

      // Validar que las entidades existen y pertenecen a la organización
      const [asset, threat, vulnerability] = await Promise.all([
        Asset.findOne({ _id: assetId, organization: organizationId }),
        Threat.findOne({ _id: threatId, organization: organizationId }),
        Vulnerability.findOne({ _id: vulnerabilityId, organization: organizationId, asset: assetId })
      ]);

      if (!asset) {
        return res.status(404).json({
          status: 'error',
          message: 'Activo no encontrado'
        });
      }

      if (!threat) {
        return res.status(404).json({
          status: 'error',
          message: 'Amenaza no encontrada'
        });
      }

      if (!vulnerability) {
        return res.status(404).json({
          status: 'error',
          message: 'Vulnerabilidad no encontrada o no corresponde al activo'
        });
      }

      // Verificar si ya existe un riesgo para esta combinación
      const existingRisk = await Risk.findOne({
        asset: assetId,
        threat: threatId,
        vulnerability: vulnerabilityId,
        organization: organizationId
      });

      if (existingRisk) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe un riesgo para esta combinación de activo, amenaza y vulnerabilidad'
        });
      }

      // Crear riesgo calculado
      const newRisk = await RiskCalculationService.createCalculatedRisk(
        assetId,
        threatId,
        vulnerabilityId,
        organizationId,
        userId
      );

      const response = {
        status: 'success',
        message: 'Riesgo calculado y creado exitosamente',
        data: {
          risk: {
            id: newRisk._id,
            riskId: newRisk.riskId,
            name: newRisk.name,
            calculation: newRisk.calculation,
            classification: newRisk.classification,
            riskMatrix: newRisk.riskMatrix,
            treatment: newRisk.treatment
          }
        }
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('Error calculando riesgo:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error calculando riesgo',
        error: error.message
      });
    }
  }

  /**
   * @desc    Actualizar riesgo existente
   * @route   PUT /api/risks/:id
   * @access  Private (admin, analyst)
   */
  static async updateRisk(req, res) {
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

      const risk = await Risk.findOne({
        _id: id,
        organization: organizationId
      });

      if (!risk) {
        return res.status(404).json({
          status: 'error',
          message: 'Riesgo no encontrado'
        });
      }

      // Campos actualizables
      const allowedUpdates = [
        'name',
        'description',
        'classification.riskCategory',
        'classification.businessFunction',
        'treatment.strategy',
        'treatment.priority',
        'monitoring.reviewFrequency',
        'monitoring.assignedTo'
      ];

      // Construir objeto de actualización
      const updates = {};
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          this.setNestedProperty(updates, field, req.body[field]);
        }
      });

      // Registrar cambio en historial
      if (Object.keys(updates).length > 0) {
        risk.riskHistory.push({
          date: new Date(),
          version: risk.version,
          changes: {
            field: Object.keys(updates).join(', '),
            oldValue: 'previous values',
            newValue: 'updated values'
          },
          reason: req.body.updateReason || 'Actualización manual',
          changedBy: userId
        });

        updates.updatedBy = userId;
      }

      // Aplicar actualizaciones
      Object.assign(risk, updates);
      await risk.save();

      const response = {
        status: 'success',
        message: 'Riesgo actualizado exitosamente',
        data: {
          risk: {
            id: risk._id,
            riskId: risk.riskId,
            name: risk.name,
            classification: risk.classification,
            treatment: risk.treatment,
            monitoring: risk.monitoring,
            updatedAt: risk.updatedAt
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error actualizando riesgo:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error actualizando riesgo',
        error: error.message
      });
    }
  }

  /**
   * @desc    Recalcular riesgo específico
   * @route   POST /api/risks/:id/recalculate
   * @access  Private (admin, analyst)
   */
  static async recalculateRisk(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization;
      const userId = req.user.id;

      const risk = await Risk.findOne({
        _id: id,
        organization: organizationId
      }).populate(['asset', 'threat', 'vulnerability']);

      if (!risk) {
        return res.status(404).json({
          status: 'error',
          message: 'Riesgo no encontrado'
        });
      }

      // Recalcular métricas
      const newCalculation = await RiskCalculationService.calculateBaseRisk(
        risk.asset._id,
        risk.threat._id,
        risk.vulnerability._id,
        organizationId
      );

      // Guardar valores anteriores para historial
      const previousCalculation = { ...risk.calculation };

      // Actualizar cálculos
      risk.calculation = {
        ...risk.calculation,
        ...newCalculation
      };

      // Recalcular posición en matriz
      const riskMatrix = await RiskMatrix.getActiveMatrix(organizationId);
      if (riskMatrix) {
        const probabilityLevel = Math.ceil(newCalculation.threatProbability * 5);
        const impactLevel = Math.ceil(newCalculation.aggregatedImpact * 5);
        const matrixInfo = riskMatrix.getRiskLevel(probabilityLevel, impactLevel);

        risk.riskMatrix = {
          probabilityLevel,
          impactLevel,
          matrixPosition: `${probabilityLevel}${impactLevel}`,
          riskScore: probabilityLevel * impactLevel
        };

        risk.classification.riskLevel = matrixInfo?.riskLevel || risk.classification.riskLevel;
      }

      // Registrar recálculo en historial
      risk.riskHistory.push({
        date: new Date(),
        version: risk.version,
        changes: {
          field: 'calculation',
          oldValue: previousCalculation.adjustedRisk,
          newValue: newCalculation.adjustedRisk
        },
        reason: 'Recálculo manual solicitado',
        changedBy: userId
      });

      risk.updatedBy = userId;
      await risk.save();

      const response = {
        status: 'success',
        message: 'Riesgo recalculado exitosamente',
        data: {
          risk: {
            id: risk._id,
            riskId: risk.riskId,
            calculation: risk.calculation,
            riskMatrix: risk.riskMatrix,
            classification: risk.classification,
            previousValues: {
              adjustedRisk: previousCalculation.adjustedRisk,
              riskLevel: previousCalculation.riskLevel
            }
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error recalculando riesgo:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error recalculando riesgo',
        error: error.message
      });
    }
  }

  /**
   * @desc    Obtener matriz de riesgo visual
   * @route   GET /api/risks/matrix
   * @access  Private
   */
  static async getRiskMatrix(req, res) {
    try {
      const organizationId = req.user.organization;

      // Obtener matriz activa
      const riskMatrix = await RiskMatrix.getActiveMatrix(organizationId);
      
      if (!riskMatrix) {
        return res.status(404).json({
          status: 'error',
          message: 'No se encontró matriz de riesgo activa'
        });
      }

      // Obtener riesgos para poblar la matriz
      const risks = await Risk.find({ organization: organizationId })
        .populate('asset', 'name type')
        .select('riskId name riskMatrix classification asset');

      // Generar visualización de matriz
      const matrixVisualization = riskMatrix.generateMatrixVisualization();

      // Contar riesgos por posición
      const riskCounts = {};
      risks.forEach(risk => {
        const position = risk.riskMatrix.matrixPosition;
        if (!riskCounts[position]) {
          riskCounts[position] = {
            count: 0,
            risks: []
          };
        }
        riskCounts[position].count++;
        riskCounts[position].risks.push({
          id: risk._id,
          riskId: risk.riskId,
          name: risk.name,
          assetName: risk.asset?.name,
          riskLevel: risk.classification.riskLevel
        });
      });

      // Enriquecer matriz con datos de riesgos
      matrixVisualization.matrix.forEach(row => {
        row.forEach(cell => {
          const position = `${cell.x}${cell.y}`;
          cell.riskCount = riskCounts[position]?.count || 0;
          cell.risks = riskCounts[position]?.risks || [];
        });
      });

      const response = {
        status: 'success',
        data: {
          matrix: {
            name: riskMatrix.name,
            description: riskMatrix.description,
            dimensions: riskMatrix.dimensions,
            visualization: matrixVisualization,
            tolerance: riskMatrix.riskTolerance,
            totalRisks: risks.length
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error obteniendo matriz de riesgo:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo matriz de riesgo',
        error: error.message
      });
    }
  }

  /**
   * @desc    Realizar análisis de escenarios
   * @route   POST /api/risks/scenarios
   * @access  Private (admin, analyst)
   */
  static async analyzeScenarios(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { scenarios } = req.body;
      const organizationId = req.user.organization;

      // Validar formato de escenarios
      if (!Array.isArray(scenarios) || scenarios.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Se requiere al menos un escenario para analizar'
        });
      }

      // Realizar análisis de escenarios
      const results = await RiskCalculationService.performScenarioAnalysis(organizationId, scenarios);

      const response = {
        status: 'success',
        message: `Análisis de ${scenarios.length} escenarios completado`,
        data: {
          scenarios: results,
          summary: {
            totalScenarios: results.length,
            analysisDate: new Date()
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error en análisis de escenarios:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error realizando análisis de escenarios',
        error: error.message
      });
    }
  }

  /**
   * @desc    Ejecutar simulación Monte Carlo
   * @route   POST /api/risks/:id/monte-carlo
   * @access  Private (admin, analyst)
   */
  static async runMonteCarloSimulation(req, res) {
    try {
      const { id } = req.params;
      const { iterations = 10000 } = req.body;
      const organizationId = req.user.organization;

      // Validar iteraciones
      if (iterations < 1000 || iterations > 100000) {
        return res.status(400).json({
          status: 'error',
          message: 'Las iteraciones deben estar entre 1,000 y 100,000'
        });
      }

      const risk = await Risk.findOne({
        _id: id,
        organization: organizationId
      });

      if (!risk) {
        return res.status(404).json({
          status: 'error',
          message: 'Riesgo no encontrado'
        });
      }

      // Ejecutar simulación
      const simulationResults = await RiskCalculationService.runMonteCarloSimulation(id, iterations);

      const response = {
        status: 'success',
        message: 'Simulación Monte Carlo completada',
        data: {
          riskId: risk.riskId,
          iterations,
          results: simulationResults,
          executionTime: new Date()
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error en simulación Monte Carlo:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error ejecutando simulación Monte Carlo',
        error: error.message
      });
    }
  }

  /**
   * @desc    Calcular VaR organizacional
   * @route   GET /api/risks/value-at-risk
   * @access  Private (admin, analyst)
   */
  static async getValueAtRisk(req, res) {
    try {
      const organizationId = req.user.organization;
      const { 
        confidenceLevel = 0.95, 
        timeHorizon = 365 
      } = req.query;

      // Validar parámetros
      if (confidenceLevel < 0.5 || confidenceLevel > 0.99) {
        return res.status(400).json({
          status: 'error',
          message: 'El nivel de confianza debe estar entre 0.5 y 0.99'
        });
      }

      if (timeHorizon < 1 || timeHorizon > 365) {
        return res.status(400).json({
          status: 'error',
          message: 'El horizonte temporal debe estar entre 1 y 365 días'
        });
      }

      // Calcular VaR
      const varResults = await RiskCalculationService.calculateOrganizationalVaR(
        organizationId,
        parseFloat(confidenceLevel),
        parseInt(timeHorizon)
      );

      const response = {
        status: 'success',
        data: {
          valueAtRisk: varResults,
          parameters: {
            confidenceLevel: parseFloat(confidenceLevel),
            timeHorizon: parseInt(timeHorizon)
          },
          calculationDate: new Date()
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error calculando VaR:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error calculando Value at Risk',
        error: error.message
      });
    }
  }

  /**
   * @desc    Eliminar riesgo
   * @route   DELETE /api/risks/:id
   * @access  Private (admin)
   */
  static async deleteRisk(req, res) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organization;

      const risk = await Risk.findOne({
        _id: id,
        organization: organizationId
      });

      if (!risk) {
        return res.status(404).json({
          status: 'error',
          message: 'Riesgo no encontrado'
        });
      }

      await Risk.findByIdAndDelete(id);

      res.json({
        status: 'success',
        message: 'Riesgo eliminado exitosamente'
      });

    } catch (error) {
      console.error('Error eliminando riesgo:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error eliminando riesgo',
        error: error.message
      });
    }
  }

  // Método auxiliar para establecer propiedades anidadas
  static setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }
}

module.exports = RisksController;