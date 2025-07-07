
// ================================================================
// src/routes/assets.js - CORRECCIÓN DE VALIDACIÓN
// ================================================================

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const assetController = require('../controllers/assetsController');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Aplicar autenticación a todas las rutas
router.use(auth);

// Función para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
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

// ===== VALIDACIONES CORREGIDAS =====

const validateAssetCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  body('code')
    .trim()
    .notEmpty()
    .withMessage('El código es requerido')
    .isLength({ min: 2, max: 20 })
    .withMessage('El código debe tener entre 2 y 20 caracteres')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  
  body('type')
    .notEmpty()
    .withMessage('El tipo es requerido')
    .isIn(['DATA', 'SOFTWARE', 'HARDWARE', 'NETWORK', 'PERSONNEL', 'PHYSICAL', 'SERVICE'])
    .withMessage('Tipo de activo no válido'),
  
  body('subtype')
    .notEmpty()
    .withMessage('El subtipo es requerido'),
  
  body('valuation.confidentiality')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La confidencialidad debe ser un número entre 0 y 10'),
  
  body('valuation.integrity')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La integridad debe ser un número entre 0 y 10'),
  
  body('valuation.availability')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La disponibilidad debe ser un número entre 0 y 10'),
  
  body('valuation.authenticity')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La autenticidad debe ser un número entre 0 y 10'),
  
  body('valuation.traceability')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La trazabilidad debe ser un número entre 0 y 10'),
  
  body('economicValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor económico debe ser un número positivo'),
  
  body('sectoralFactor')
    .optional()
    .isFloat({ min: 0.1, max: 10 })
    .withMessage('El factor sectorial debe estar entre 0.1 y 10'),
  
  body('owner.userId')
    .notEmpty()
    .withMessage('El propietario es requerido')
    .isMongoId()
    .withMessage('ID de propietario no válido'),
  
  body('owner.department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('El departamento no puede exceder 100 caracteres'),
  
  body('custodian.userId')
    .optional()
    .isMongoId()
    .withMessage('ID de custodio no válido'),
  
  handleValidationErrors
];

const validateAssetUpdate = [
  param('id')
    .isMongoId()
    .withMessage('ID de activo no válido'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  
  body('type')
    .optional()
    .isIn(['DATA', 'SOFTWARE', 'HARDWARE', 'NETWORK', 'PERSONNEL', 'PHYSICAL', 'SERVICE'])
    .withMessage('Tipo de activo no válido'),
  
  body('valuation.confidentiality')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La confidencialidad debe ser un número entre 0 y 10'),
  
  body('valuation.integrity')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La integridad debe ser un número entre 0 y 10'),
  
  body('valuation.availability')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La disponibilidad debe ser un número entre 0 y 10'),
  
  body('valuation.authenticity')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La autenticidad debe ser un número entre 0 y 10'),
  
  body('valuation.traceability')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('La trazabilidad debe ser un número entre 0 y 10'),
  
  body('economicValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor económico debe ser un número positivo'),
  
  body('owner.userId')
    .optional()
    .isMongoId()
    .withMessage('ID de propietario no válido'),
  
  body('custodian.userId')
    .optional()
    .isMongoId()
    .withMessage('ID de custodio no válido'),
  
  handleValidationErrors
];

const validateAssetValuation = [
  param('id')
    .isMongoId()
    .withMessage('ID de activo no válido'),
  
  body('valuation.confidentiality')
    .isInt({ min: 0, max: 10 })
    .withMessage('La confidencialidad debe ser un número entre 0 y 10'),
  
  body('valuation.integrity')
    .isInt({ min: 0, max: 10 })
    .withMessage('La integridad debe ser un número entre 0 y 10'),
  
  body('valuation.availability')
    .isInt({ min: 0, max: 10 })
    .withMessage('La disponibilidad debe ser un número entre 0 y 10'),
  
  body('valuation.authenticity')
    .isInt({ min: 0, max: 10 })
    .withMessage('La autenticidad debe ser un número entre 0 y 10'),
  
  body('valuation.traceability')
    .isInt({ min: 0, max: 10 })
    .withMessage('La trazabilidad debe ser un número entre 0 y 10'),
  
  body('economicValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor económico debe ser un número positivo'),
  
  body('justification')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La justificación no puede exceder 1000 caracteres'),
  
  handleValidationErrors
];

const validateAssetDuplication = [
  param('id')
    .isMongoId()
    .withMessage('ID de activo no válido'),
  
  body('name')
    .trim()
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  body('code')
    .trim()
    .notEmpty()
    .withMessage('El código es requerido')
    .isLength({ min: 2, max: 20 })
    .withMessage('El código debe tener entre 2 y 20 caracteres')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),
  
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número mayor a 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe estar entre 1 y 100'),
  
  query('sortBy')
    .optional()
    .isIn(['name', 'code', 'type', 'criticality.score', 'economicValue', 'createdAt', 'updatedAt'])
    .withMessage('Campo de ordenamiento no válido'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Orden debe ser asc o desc'),
  
  handleValidationErrors
];

// ===== RUTAS CORREGIDAS =====

// POST /api/assets - Crear activo
router.post('/', 
  authorize(['admin', 'analyst']), 
  validateAssetCreation, 
  assetController.createAsset
);

// GET /api/assets - Obtener activos con paginación y filtros
router.get('/', 
  authorize(['admin', 'analyst', 'viewer']), 
  validatePagination, 
  assetController.getAssets
);

// GET /api/assets/summary - Obtener resumen de activos (SIN VALIDACIÓN QUE CAUSA ERROR)
router.get('/summary', 
  authorize(['admin', 'analyst', 'viewer']), 
  assetController.getAssetsByOrganization
);

// GET /api/assets/by-type/:type - Obtener activos por tipo
router.get('/by-type/:type', 
  authorize(['admin', 'analyst', 'viewer']),
  param('type').isIn(['DATA', 'SOFTWARE', 'HARDWARE', 'NETWORK', 'PERSONNEL', 'PHYSICAL', 'SERVICE'])
    .withMessage('Tipo de activo no válido'),
  handleValidationErrors,
  assetController.getAssetsByType
);

// GET /api/assets/export - Exportar activos
router.get('/export', 
  authorize(['admin', 'analyst']),
  query('format').optional().isIn(['json', 'csv', 'excel']).withMessage('Formato no válido'),
  handleValidationErrors,
  assetController.exportAssets
);

// GET /api/assets/:id - Obtener activo por ID
router.get('/:id', 
  authorize(['admin', 'analyst', 'viewer']),
  param('id').isMongoId().withMessage('ID de activo no válido'),
  handleValidationErrors,
  assetController.getAssetById
);

// PUT /api/assets/:id - Actualizar activo
router.put('/:id', 
  authorize(['admin', 'analyst']), 
  validateAssetUpdate, 
  assetController.updateAsset
);

// DELETE /api/assets/:id - Eliminar activo
router.delete('/:id', 
  authorize(['admin']),
  param('id').isMongoId().withMessage('ID de activo no válido'),
  handleValidationErrors,
  assetController.deleteAsset
);

// POST /api/assets/:id/valuate - Valorar activo
router.post('/:id/valuate', 
  authorize(['admin', 'analyst']), 
  validateAssetValuation, 
  assetController.valuateAsset
);

// POST /api/assets/:id/duplicate - Duplicar activo
router.post('/:id/duplicate', 
  authorize(['admin', 'analyst']), 
  validateAssetDuplication, 
  assetController.duplicateAsset
);

module.exports = router;