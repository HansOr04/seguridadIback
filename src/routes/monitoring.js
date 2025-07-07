const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');

// Middleware de autenticación para todas las rutas
router.use(auth);

// Validaciones para crear/actualizar monitoreo
const monitoringValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ max: 100 })
    .withMessage('El nombre no puede exceder 100 caracteres'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  
  body('type')
    .isIn(['risk_assessment', 'control_testing', 'vulnerability_scan', 'compliance_check', 'kpi_monitoring'])
    .withMessage('Tipo de monitoreo no válido'),
  
  body('frequency')
    .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'annually'])
    .withMessage('Frecuencia no válida'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'paused', 'error'])
    .withMessage('Estado no válido'),
  
  body('responsible')
    .optional()
    .isMongoId()
    .withMessage('ID del responsable no válido'),
  
  body('assets')
    .optional()
    .isArray()
    .withMessage('Los activos deben ser un array'),
  
  body('assets.*')
    .optional()
    .isMongoId()
    .withMessage('ID de activo no válido'),
  
  body('controls')
    .optional()
    .isArray()
    .withMessage('Los controles deben ser un array'),
  
  body('controls.*')
    .optional()
    .isMongoId()
    .withMessage('ID de control no válido'),
  
  body('risks')
    .optional()
    .isArray()
    .withMessage('Los riesgos deben ser un array'),
  
  body('risks.*')
    .optional()
    .isMongoId()
    .withMessage('ID de riesgo no válido'),
  
  body('notifications.enabled')
    .optional()
    .isBoolean()
    .withMessage('Las notificaciones deben ser verdadero o falso'),
  
  body('notifications.threshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El umbral debe estar entre 0 y 100'),
  
  body('notifications.recipients')
    .optional()
    .isArray()
    .withMessage('Los destinatarios deben ser un array'),
  
  body('notifications.recipients.*')
    .optional()
    .isMongoId()
    .withMessage('ID de destinatario no válido')
];

// Rutas

// POST /api/monitoring - Crear monitoreo
router.post('/', monitoringValidation, monitoringController.createMonitoring);

// GET /api/monitoring - Obtener todos los monitoreos
router.get('/', monitoringController.getMonitorings);

// GET /api/monitoring/dashboard - Obtener dashboard de monitoreo
router.get('/dashboard', monitoringController.getMonitoringDashboard);

// GET /api/monitoring/:id - Obtener monitoreo por ID
router.get('/:id', monitoringController.getMonitoringById);

// PUT /api/monitoring/:id - Actualizar monitoreo
router.put('/:id', monitoringValidation, monitoringController.updateMonitoring);

// DELETE /api/monitoring/:id - Eliminar monitoreo
router.delete('/:id', monitoringController.deleteMonitoring);

// POST /api/monitoring/:id/execute - Ejecutar monitoreo manualmente
router.post('/:id/execute', monitoringController.executeMonitoring);

// GET /api/monitoring/:id/results - Obtener resultados de monitoreo
router.get('/:id/results', monitoringController.getMonitoringResults);

module.exports = router;