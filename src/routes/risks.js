// src/routes/risks.js - Versión corregida sin conflicto de validationResult

const express = require('express');
const router = express.Router();
const RisksController = require('../controllers/risksController');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { body, param, query } = require('express-validator');

// Middleware de validación personalizado para evitar conflicto
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Errores de validación',
      errors: errors.array(),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Aplicar autenticación a todas las rutas
router.use(auth);

// ===== VALIDACIONES =====

const validateRiskCalculation = [
  body('assetId')
    .isMongoId()
    .withMessage('ID de activo inválido'),
  
  body('threatId')
    .isMongoId()
    .withMessage('ID de amenaza inválido'),
  
  body('vulnerabilityId')
    .isMongoId()
    .withMessage('ID de vulnerabilidad inválido'),
  
  handleValidationErrors
];

const validateRiskUpdate = [
  param('id')
    .isMongoId()
    .withMessage('ID de riesgo inválido'),
  
  body('name')
    .optional()
    .isLength({ min: 3, max: 200 })
    .withMessage('Nombre debe tener entre 3 y 200 caracteres'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Descripción no puede exceder 1000 caracteres'),
  
  body('classification.riskCategory')
    .optional()
    .isIn(['operational', 'technical', 'strategic', 'compliance', 'financial'])
    .withMessage('Categoría de riesgo inválida'),
  
  body('treatment.strategy')
    .optional()
    .isIn(['accept', 'mitigate', 'transfer', 'avoid'])
    .withMessage('Estrategia de tratamiento inválida'),
  
  body('treatment.priority')
    .optional()
    .isIn(['critical', 'high', 'medium', 'low'])
    .withMessage('Prioridad inválida'),
  
  body('monitoring.reviewFrequency')
    .optional()
    .isIn(['weekly', 'monthly', 'quarterly', 'annually'])
    .withMessage('Frecuencia de revisión inválida'),
  
  body('monitoring.assignedTo')
    .optional()
    .isMongoId()
    .withMessage('ID de usuario asignado inválido'),
  
  handleValidationErrors
];

const validateScenarioAnalysis = [
  body('scenarios')
    .isArray({ min: 1, max: 10 })
    .withMessage('Se requiere entre 1 y 10 escenarios'),
  
  body('scenarios.*.name')
    .isLength({ min: 3, max: 100 })
    .withMessage('Nombre del escenario debe tener entre 3 y 100 caracteres'),
  
  body('scenarios.*.description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Descripción del escenario no puede exceder 500 caracteres'),
  
  body('scenarios.*.probabilityMultiplier')
    .isFloat({ min: 0.1, max: 10 })
    .withMessage('Multiplicador de probabilidad debe estar entre 0.1 y 10'),
  
  body('scenarios.*.impactMultiplier')
    .isFloat({ min: 0.1, max: 10 })
    .withMessage('Multiplicador de impacto debe estar entre 0.1 y 10'),
  
  handleValidationErrors
];

const validateMonteCarloParams = [
  param('id')
    .isMongoId()
    .withMessage('ID de riesgo inválido'),
  
  body('iterations')
    .optional()
    .isInt({ min: 1000, max: 100000 })
    .withMessage('Iteraciones deben estar entre 1,000 y 100,000'),
  
  handleValidationErrors
];

const validateVaRParams = [
  query('confidenceLevel')
    .optional()
    .isFloat({ min: 0.5, max: 0.99 })
    .withMessage('Nivel de confianza debe estar entre 0.5 y 0.99'),
  
  query('timeHorizon')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Horizonte temporal debe estar entre 1 y 365 días'),
  
  handleValidationErrors
];

const validateRiskFilters = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número mayor a 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite debe estar entre 1 y 100'),
  
  query('riskLevel')
    .optional()
    .isIn(['critical', 'high', 'medium', 'low'])
    .withMessage('Nivel de riesgo inválido'),
  
  query('category')
    .optional()
    .isIn(['operational', 'technical', 'strategic', 'compliance', 'financial'])
    .withMessage('Categoría inválida'),
  
  query('status')
    .optional()
    .isIn(['identified', 'analyzed', 'treated', 'monitored', 'closed'])
    .withMessage('Estado inválido'),
  
  query('assetType')
    .optional()
    .isIn(['software', 'hardware', 'communication_networks', 'data', 'essential_services', 'support_equipment', 'installations', 'personnel'])
    .withMessage('Tipo de activo inválido'),
  
  query('sortBy')
    .optional()
    .isIn(['adjustedRisk', 'economicImpact', 'created', 'name'])
    .withMessage('Campo de ordenamiento inválido'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Orden inválido'),
  
  handleValidationErrors
];

// ===== RUTAS DE DASHBOARD Y LISTADO =====

/**
 * @route   GET /api/risks/dashboard
 * @desc    Dashboard de riesgos organizacional
 * @access  Private (todos los roles)
 */
router.get('/dashboard', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  RisksController.getDashboard
);

/**
 * @route   GET /api/risks
 * @desc    Listar riesgos con filtros
 * @access  Private (todos los roles)
 */
router.get('/', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  validateRiskFilters,
  RisksController.getRisks
);

/**
 * @route   GET /api/risks/matrix
 * @desc    Matriz de riesgo visual
 * @access  Private (todos los roles)
 * @note    Esta ruta debe ir ANTES de /:id para evitar conflictos
 */
router.get('/matrix', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  RisksController.getRiskMatrix
);

/**
 * @route   GET /api/risks/value-at-risk
 * @desc    Calcular VaR organizacional
 * @access  Private (admin, analyst)
 */
router.get('/value-at-risk', 
  authorize(['super_admin', 'admin', 'analyst']),
  validateVaRParams,
  RisksController.getValueAtRisk
);

/**
 * @route   GET /api/risks/:id
 * @desc    Detalle de riesgo específico
 * @access  Private (todos los roles)
 */
router.get('/:id', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  [
    param('id')
      .isMongoId()
      .withMessage('ID de riesgo inválido'),
    handleValidationErrors
  ],
  RisksController.getRiskById
);

// ===== RUTAS DE CÁLCULO Y GESTIÓN =====

/**
 * @route   POST /api/risks/calculate
 * @desc    Crear nuevo riesgo calculado
 * @access  Private (admin, analyst)
 */
router.post('/calculate', 
  authorize(['super_admin', 'admin', 'analyst']),
  validateRiskCalculation,
  RisksController.calculateRisk
);

/**
 * @route   POST /api/risks/scenarios
 * @desc    Análisis de escenarios
 * @access  Private (admin, analyst)
 */
router.post('/scenarios', 
  authorize(['super_admin', 'admin', 'analyst']),
  validateScenarioAnalysis,
  RisksController.analyzeScenarios
);

/**
 * @route   POST /api/risks/:id/recalculate
 * @desc    Recalcular riesgo específico
 * @access  Private (admin, analyst)
 */
router.post('/:id/recalculate', 
  authorize(['super_admin', 'admin', 'analyst']),
  [
    param('id')
      .isMongoId()
      .withMessage('ID de riesgo inválido'),
    handleValidationErrors
  ],
  RisksController.recalculateRisk
);

/**
 * @route   POST /api/risks/:id/monte-carlo
 * @desc    Simulación Monte Carlo
 * @access  Private (admin, analyst)
 */
router.post('/:id/monte-carlo', 
  authorize(['super_admin', 'admin', 'analyst']),
  validateMonteCarloParams,
  RisksController.runMonteCarloSimulation
);

// ===== RUTAS DE ACTUALIZACIÓN Y ELIMINACIÓN =====

/**
 * @route   PUT /api/risks/:id
 * @desc    Actualizar riesgo existente
 * @access  Private (admin, analyst)
 */
router.put('/:id', 
  authorize(['super_admin', 'admin', 'analyst']),
  validateRiskUpdate,
  RisksController.updateRisk
);

/**
 * @route   DELETE /api/risks/:id
 * @desc    Eliminar riesgo
 * @access  Private (admin only)
 */
router.delete('/:id', 
  authorize(['super_admin', 'admin']),
  [
    param('id')
      .isMongoId()
      .withMessage('ID de riesgo inválido'),
    handleValidationErrors
  ],
  RisksController.deleteRisk
);

module.exports = router;