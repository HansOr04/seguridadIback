const express = require('express');
const router = express.Router();
const controlController = require('../controllers/controlController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');

// Middleware de autenticación para todas las rutas
router.use(auth);

// Validaciones para crear/actualizar control
const controlValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ max: 100 })
    .withMessage('El nombre no puede exceder 100 caracteres'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('La descripción es requerida')
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  
  body('category')
    .isIn([
      'access_control', 'cryptography', 'physical_security', 'network_security',
      'incident_management', 'business_continuity', 'supplier_security',
      'human_resources', 'asset_management', 'information_classification',
      'operations_security', 'communications_security', 'system_development', 'compliance'
    ])
    .withMessage('Categoría de control no válida'),
  
  body('type')
    .isIn(['preventive', 'detective', 'corrective', 'compensating'])
    .withMessage('Tipo de control no válido'),
  
  body('controlObjective')
    .trim()
    .notEmpty()
    .withMessage('El objetivo del control es requerido')
    .isLength({ max: 300 })
    .withMessage('El objetivo no puede exceder 300 caracteres'),
  
  body('implementation')
    .trim()
    .notEmpty()
    .withMessage('La implementación es requerida')
    .isLength({ max: 1000 })
    .withMessage('La implementación no puede exceder 1000 caracteres'),
  
  body('guidance')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La guía no puede exceder 1000 caracteres'),
  
  body('maturityLevel')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('El nivel de madurez debe estar entre 1 y 5'),
  
  body('implementationCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El costo de implementación debe ser un número positivo'),
  
  body('maintenanceCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El costo de mantenimiento debe ser un número positivo'),
  
  body('effectiveness')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('La efectividad debe estar entre 0 y 100'),
  
  body('status')
    .optional()
    .isIn(['planned', 'implementing', 'implemented', 'monitoring', 'needs_review'])
    .withMessage('Estado de control no válido'),
  
  body('iso27002Reference')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('La referencia ISO no puede exceder 20 caracteres'),
  
  body('responsible')
    .optional()
    .isMongoId()
    .withMessage('ID del responsable no válido'),
  
  body('owner')
    .optional()
    .isMongoId()
    .withMessage('ID del propietario no válido'),
  
  body('implementationDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de implementación no válida'),
  
  body('reviewDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de revisión no válida'),
  
  body('threats')
    .optional()
    .isArray()
    .withMessage('Las amenazas deben ser un array'),
  
  body('threats.*')
    .optional()
    .isMongoId()
    .withMessage('ID de amenaza no válido'),
  
  body('vulnerabilities')
    .optional()
    .isArray()
    .withMessage('Las vulnerabilidades deben ser un array'),
  
  body('vulnerabilities.*')
    .optional()
    .isMongoId()
    .withMessage('ID de vulnerabilidad no válido'),
  
  body('assets')
    .optional()
    .isArray()
    .withMessage('Los activos deben ser un array'),
  
  body('assets.*')
    .optional()
    .isMongoId()
    .withMessage('ID de activo no válido')
];

// Validación para agregar resultado de prueba
const testResultValidation = [
  body('result')
    .isIn(['passed', 'failed', 'partial'])
    .withMessage('Resultado de prueba no válido'),
  
  body('score')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('La puntuación debe estar entre 0 y 100'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder 500 caracteres')
];

// Rutas

// POST /api/controls - Crear control
router.post('/', controlValidation, controlController.createControl);

// GET /api/controls - Obtener todos los controles
router.get('/', controlController.getControls);

// GET /api/controls/iso27002-catalog - Obtener catálogo ISO 27002
router.get('/iso27002-catalog', controlController.getISO27002Catalog);

// GET /api/controls/statistics - Obtener estadísticas
router.get('/statistics', controlController.getControlStatistics);

// GET /api/controls/:id - Obtener control por ID
router.get('/:id', controlController.getControlById);

// PUT /api/controls/:id - Actualizar control
router.put('/:id', controlValidation, controlController.updateControl);

// DELETE /api/controls/:id - Eliminar control
router.delete('/:id', controlController.deleteControl);

// POST /api/controls/:id/test-results - Agregar resultado de prueba
router.post('/:id/test-results', testResultValidation, controlController.addTestResult);

module.exports = router;