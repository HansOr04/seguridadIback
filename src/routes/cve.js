// src/routes/cve.js - Versión corregida sin conflicto de validationResult

const express = require('express');
const router = express.Router();
const CVEController = require('../controllers/cveController');
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

const validateCVESearch = [
  query('severity')
    .optional()
    .isIn(['none', 'low', 'medium', 'high', 'critical'])
    .withMessage('Severidad no válida'),
  
  query('scoreMin')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('Puntuación mínima debe estar entre 0 y 10'),
  
  query('scoreMax')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('Puntuación máxima debe estar entre 0 y 10'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número mayor a 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite debe estar entre 1 y 100'),
  
  handleValidationErrors
];

const validateCVESync = [
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio debe ser válida'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de fin debe ser válida'),
  
  body('forceSync')
    .optional()
    .isBoolean()
    .withMessage('forceSync debe ser booleano'),
  
  handleValidationErrors
];

const validateCVECorrelation = [
  body('cveIds')
    .isArray({ min: 1 })
    .withMessage('Se requiere al menos un CVE ID'),
  
  body('cveIds.*')
    .matches(/^CVE-\d{4}-\d{4,}$/)
    .withMessage('Formato de CVE ID inválido'),
  
  body('forceRecorrelation')
    .optional()
    .isBoolean()
    .withMessage('forceRecorrelation debe ser booleano'),
  
  handleValidationErrors
];

const validateRemediationUpdate = [
  param('cveId')
    .matches(/^CVE-\d{4}-\d{4,}$/)
    .withMessage('Formato de CVE ID inválido'),
  
  body('remediationStatus')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'rejected', 'not_applicable'])
    .withMessage('Estado de remediación inválido'),
  
  body('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('ID de usuario asignado inválido'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de vencimiento debe ser válida'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Prioridad inválida'),
  
  handleValidationErrors
];

// ===== RUTAS DE DASHBOARD Y CONSULTA =====

/**
 * @route   GET /api/cve/dashboard
 * @desc    Dashboard de CVEs organizacional
 * @access  Private (admin, analyst, viewer)
 */
router.get('/dashboard', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  CVEController.getDashboard
);

/**
 * @route   GET /api/cve
 * @desc    Listar CVEs con filtros
 * @access  Private (todos los roles)
 */
router.get('/', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  validateCVESearch,
  CVEController.getCVEs
);

/**
 * @route   GET /api/cve/alerts
 * @desc    Obtener alertas automáticas de CVE
 * @access  Private (todos los roles)
 */
router.get('/alerts', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  CVEController.getAlerts
);

/**
 * @route   GET /api/cve/statistics
 * @desc    Obtener estadísticas de CVE
 * @access  Private (todos los roles)
 */
router.get('/statistics', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  CVEController.getStatistics
);

/**
 * @route   GET /api/cve/nvd-status
 * @desc    Verificar estado de API NVD
 * @access  Private (admin)
 */
router.get('/nvd-status', 
  authorize(['super_admin', 'admin']),
  CVEController.getNVDStatus
);

/**
 * @route   GET /api/cve/sync-status
 * @desc    Obtener estado de sincronización
 * @access  Private (admin)
 */
router.get('/sync-status', 
  authorize(['super_admin', 'admin']),
  CVEController.getSyncStatus
);

/**
 * @route   GET /api/cve/export
 * @desc    Exportar CVEs
 * @access  Private (admin, analyst)
 */
router.get('/export', 
  authorize(['super_admin', 'admin', 'analyst']),
  [
    query('format')
      .optional()
      .isIn(['csv', 'json', 'excel'])
      .withMessage('Formato de exportación no válido'),
    handleValidationErrors
  ],
  CVEController.exportCVEs
);

/**
 * @route   GET /api/cve/search-products
 * @desc    Buscar CVEs por productos/vendors
 * @access  Private (todos los roles)
 */
router.get('/search-products', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  [
    query('vendor')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Vendor debe tener entre 2 y 100 caracteres'),
    query('product')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Producto debe tener entre 2 y 100 caracteres'),
    query('version')
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage('Versión debe tener entre 1 y 50 caracteres'),
    handleValidationErrors
  ],
  CVEController.searchByProducts
);

/**
 * @route   GET /api/cve/:cveId
 * @desc    Obtener detalle de CVE específico
 * @access  Private (todos los roles)
 */
router.get('/:cveId', 
  authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  [
    param('cveId')
      .matches(/^CVE-\d{4}-\d{4,}$/)
      .withMessage('Formato de CVE ID inválido'),
    handleValidationErrors
  ],
  CVEController.getCVEDetail
);

// ===== RUTAS DE SINCRONIZACIÓN Y GESTIÓN =====

/**
 * @route   POST /api/cve/sync
 * @desc    Sincronizar CVEs desde NVD
 * @access  Private (admin)
 */
router.post('/sync', 
  authorize(['super_admin', 'admin']),
  validateCVESync,
  CVEController.syncCVEs
);

/**
 * @route   POST /api/cve/correlate
 * @desc    Correlacionar CVEs con activos organizacionales
 * @access  Private (admin, analyst)
 */
router.post('/correlate', 
  authorize(['super_admin', 'admin', 'analyst']),
  validateCVECorrelation,
  CVEController.correlateCVEs
);

/**
 * @route   PUT /api/cve/:cveId/remediation
 * @desc    Actualizar estado de remediación de CVE
 * @access  Private (admin, analyst)
 */
router.put('/:cveId/remediation', 
  authorize(['super_admin', 'admin', 'analyst']),
  validateRemediationUpdate,
  CVEController.updateRemediationStatus
);

module.exports = router;