const express = require('express');
const router = express.Router();
const treatmentController = require('../controllers/treatmentController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');

// Middleware de autenticación para todas las rutas
router.use(auth);

// Validaciones para crear/actualizar tratamiento
const treatmentValidation = [
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
  
  body('type')
    .isIn(['accept', 'mitigate', 'avoid', 'transfer'])
    .withMessage('Tipo de tratamiento no válido'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Prioridad no válida'),
  
  body('riskId')
    .notEmpty()
    .withMessage('ID del riesgo es requerido')
    .isMongoId()
    .withMessage('ID del riesgo no válido'),
  
  body('assetId')
    .notEmpty()
    .withMessage('ID del activo es requerido')
    .isMongoId()
    .withMessage('ID del activo no válido'),
  
  body('implementationCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El costo de implementación debe ser un número positivo'),
  
  body('maintenanceCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El costo de mantenimiento debe ser un número positivo'),
  
  body('expectedBenefit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El beneficio esperado debe ser un número positivo'),
  
  body('riskReduction')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('La reducción de riesgo debe estar entre 0 y 100'),
  
  body('responsible')
    .optional()
    .isMongoId()
    .withMessage('ID del responsable no válido'),
  
  body('implementationDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de implementación no válida'),
  
  body('controls')
    .optional()
    .isArray()
    .withMessage('Los controles deben ser un array'),
  
  body('controls.*')
    .optional()
    .isMongoId()
    .withMessage('ID de control no válido')
];

// Rutas

// POST /api/treatments - Crear tratamiento
router.post('/', treatmentValidation, treatmentController.createTreatment);

// GET /api/treatments - Obtener todos los tratamientos
router.get('/', treatmentController.getTreatments);

// GET /api/treatments/statistics - Obtener estadísticas
router.get('/statistics', treatmentController.getTreatmentStatistics);

// GET /api/treatments/:id - Obtener tratamiento por ID
router.get('/:id', treatmentController.getTreatmentById);

// PUT /api/treatments/:id - Actualizar tratamiento
router.put('/:id', treatmentValidation, treatmentController.updateTreatment);

// DELETE /api/treatments/:id - Eliminar tratamiento
router.delete('/:id', treatmentController.deleteTreatment);

// POST /api/treatments/:id/approve - Aprobar tratamiento
router.post('/:id/approve', treatmentController.approveTreatment);

// GET /api/treatments/:id/cost-benefit - Calcular análisis costo-beneficio
router.get('/:id/cost-benefit', treatmentController.calculateCostBenefit);

module.exports = router;