// src/routes/assets.js

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');

// Controllers
const assetsController = require('../controllers/assetsController');

// Middleware
const auth = require('../middleware/auth');
const { assetPermissions } = require('../middleware/auth');

// Función de validación simple (reemplaza middleware faltante)
const validateRequest = (req, res, next) => {
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

// Validaciones básicas
const createAssetValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('El nombre debe tener entre 3 y 200 caracteres'),
    
  body('code')
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('El código debe tener entre 2 y 20 caracteres')
    .matches(/^[A-Za-z0-9\-_.]+$/)
    .withMessage('El código solo puede contener letras, números, guiones y puntos'),
    
  body('type')
    .isIn(['I', 'S', 'SW', 'HW', 'COM', 'SI', 'AUX', 'L', 'P'])
    .withMessage('Tipo de activo no válido según taxonomía MAGERIT'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres')
];

const updateAssetValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de activo no válido'),
    
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('El nombre debe tener entre 3 y 200 caracteres'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres')
];

// ===== RUTAS BÁSICAS =====

/**
 * @route   GET /api/assets
 * @desc    Obtener lista de activos
 * @access  Private (Todos pueden leer)
 */
router.get('/', 
  auth, 
  assetPermissions.canRead,
  assetsController.getAssets
);

/**
 * @route   POST /api/assets
 * @desc    Crear nuevo activo
 * @access  Private (Admin y analyst)
 */
router.post('/', 
  auth, 
  assetPermissions.canModify,
  createAssetValidation,
  validateRequest,
  assetsController.createAsset
);

/**
 * @route   GET /api/assets/:id
 * @desc    Obtener activo por ID
 * @access  Private (Todos pueden leer)
 */
router.get('/:id', 
  auth, 
  assetPermissions.canRead,
  [
    param('id')
      .isMongoId()
      .withMessage('ID de activo no válido')
  ],
  validateRequest,
  assetsController.getAssetById
);

/**
 * @route   PUT /api/assets/:id
 * @desc    Actualizar activo
 * @access  Private (Admin y analyst)
 */
router.put('/:id', 
  auth, 
  assetPermissions.canModify,
  updateAssetValidation,
  validateRequest,
  assetsController.updateAsset
);

/**
 * @route   DELETE /api/assets/:id
 * @desc    Eliminar activo (soft delete)
 * @access  Private (Solo admin)
 */
router.delete('/:id', 
  auth, 
  assetPermissions.canDelete,
  [
    param('id')
      .isMongoId()
      .withMessage('ID de activo no válido')
  ],
  validateRequest,
  assetsController.deleteAsset
);

/**
 * @route   POST /api/assets/:id/valuate
 * @desc    Valorar activo según metodología MAGERIT
 * @access  Private (Admin y analyst)
 */
router.post('/:id/valuate', 
  auth, 
  assetPermissions.canValuate,
  [
    param('id')
      .isMongoId()
      .withMessage('ID de activo no válido'),
    body('valuation.confidentiality')
      .isInt({ min: 0, max: 10 })
      .withMessage('Confidencialidad debe ser un número entre 0 y 10'),
    body('valuation.integrity')
      .isInt({ min: 0, max: 10 })
      .withMessage('Integridad debe ser un número entre 0 y 10'),
    body('valuation.availability')
      .isInt({ min: 0, max: 10 })
      .withMessage('Disponibilidad debe ser un número entre 0 y 10'),
    body('valuation.authenticity')
      .isInt({ min: 0, max: 10 })
      .withMessage('Autenticidad debe ser un número entre 0 y 10'),
    body('valuation.traceability')
      .isInt({ min: 0, max: 10 })
      .withMessage('Trazabilidad debe ser un número entre 0 y 10')
  ],
  validateRequest,
  assetsController.valuateAsset
);

/**
 * @route   GET /api/assets/by-organization
 * @desc    Obtener resumen de activos por organización
 * @access  Private (Admin, analyst, viewer)
 */
router.get('/by-organization', 
  auth, 
  assetPermissions.canRead,
  assetsController.getAssetsByOrganization
);

/**
 * @route   GET /api/assets/by-type/:type
 * @desc    Obtener activos por tipo
 * @access  Private (Admin, analyst, viewer)
 */
router.get('/by-type/:type', 
  auth, 
  assetPermissions.canRead,
  [
    param('type')
      .isIn(['I', 'S', 'SW', 'HW', 'COM', 'SI', 'AUX', 'L', 'P'])
      .withMessage('Tipo de activo no válido')
  ],
  validateRequest,
  assetsController.getAssetsByType
);

/**
 * @route   POST /api/assets/:id/duplicate
 * @desc    Duplicar configuración de activo
 * @access  Private (Admin y analyst)
 */
router.post('/:id/duplicate', 
  auth, 
  assetPermissions.canModify,
  [
    param('id')
      .isMongoId()
      .withMessage('ID de activo no válido'),
    body('name')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('El nombre debe tener entre 3 y 200 caracteres'),
    body('code')
      .trim()
      .isLength({ min: 2, max: 20 })
      .withMessage('El código debe tener entre 2 y 20 caracteres')
  ],
  validateRequest,
  assetsController.duplicateAsset
);

/**
 * @route   GET /api/assets/export
 * @desc    Exportar listado de activos
 * @access  Private (Admin y analyst)
 */
router.get('/export', 
  auth, 
  assetPermissions.canImportExport,
  [
    query('format')
      .optional()
      .isIn(['json', 'csv', 'excel'])
      .withMessage('Formato de exportación no válido'),
    query('type')
      .optional()
      .isIn(['I', 'S', 'SW', 'HW', 'COM', 'SI', 'AUX', 'L', 'P'])
      .withMessage('Tipo de filtro no válido')
  ],
  validateRequest,
  assetsController.exportAssets
);

/**
 * @route   GET /api/assets/magerit/taxonomy
 * @desc    Obtener taxonomía MAGERIT
 * @access  Private (Todos pueden consultar)
 */
router.get('/magerit/taxonomy', 
  auth, 
  assetPermissions.canRead,
  async (req, res) => {
    try {
      const taxonomy = {
        types: {
          'I': 'Información',
          'S': 'Servicios',
          'SW': 'Software',
          'HW': 'Hardware',
          'COM': 'Comunicaciones',
          'SI': 'Soportes de Información',
          'AUX': 'Equipamiento Auxiliar',
          'L': 'Instalaciones',
          'P': 'Personal'
        },
        dimensions: ['confidentiality', 'integrity', 'availability', 'authenticity', 'traceability'],
        levels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      };
      
      res.json({
        status: 'success',
        data: {
          taxonomy,
          version: '3.0',
          description: 'Taxonomía MAGERIT v3.0 para clasificación de activos'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error obteniendo taxonomía:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo taxonomía MAGERIT',
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;