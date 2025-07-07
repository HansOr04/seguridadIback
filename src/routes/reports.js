const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');
const { body } = require('express-validator');

// Middleware de autenticación para todas las rutas
router.use(auth);

// Validaciones para crear/actualizar reporte
const reportValidation = [
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
    .isIn(['risk_assessment', 'compliance', 'executive_summary', 'technical_details', 'audit', 'kpi_dashboard'])
    .withMessage('Tipo de reporte no válido'),
  
  body('format')
    .optional()
    .isIn(['pdf', 'excel', 'html', 'json'])
    .withMessage('Formato de reporte no válido'),
  
  body('frequency')
    .optional()
    .isIn(['once', 'daily', 'weekly', 'monthly', 'quarterly', 'annually'])
    .withMessage('Frecuencia no válida'),
  
  body('scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha programada no válida'),
  
  body('recipients')
    .optional()
    .isArray()
    .withMessage('Los destinatarios deben ser un array'),
  
  body('recipients.*')
    .optional()
    .isMongoId()
    .withMessage('ID de destinatario no válido'),
  
  body('parameters.dateRange.start')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio no válida'),
  
  body('parameters.dateRange.end')
    .optional()
    .isISO8601()
    .withMessage('Fecha de fin no válida'),
  
  body('parameters.includeAssets')
    .optional()
    .isBoolean()
    .withMessage('Incluir activos debe ser verdadero o falso'),
  
  body('parameters.includeRisks')
    .optional()
    .isBoolean()
    .withMessage('Incluir riesgos debe ser verdadero o falso'),
  
  body('parameters.includeControls')
    .optional()
    .isBoolean()
    .withMessage('Incluir controles debe ser verdadero o falso'),
  
  body('parameters.includeTreatments')
    .optional()
    .isBoolean()
    .withMessage('Incluir tratamientos debe ser verdadero o falso'),
  
  body('parameters.riskLevelFilter')
    .optional()
    .isArray()
    .withMessage('El filtro de nivel de riesgo debe ser un array'),
  
  body('parameters.riskLevelFilter.*')
    .optional()
    .isIn(['very_low', 'low', 'medium', 'high', 'very_high'])
    .withMessage('Nivel de riesgo no válido'),
  
  body('parameters.assetTypes')
    .optional()
    .isArray()
    .withMessage('Los tipos de activo deben ser un array'),
  
  body('template.name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('El nombre de plantilla no puede exceder 50 caracteres')
];

// Rutas

// POST /api/reports - Crear reporte
router.post('/', reportValidation, reportController.createReport);

// GET /api/reports - Obtener todos los reportes
router.get('/', reportController.getReports);

// GET /api/reports/statistics - Obtener estadísticas
router.get('/statistics', reportController.getReportStatistics);

// GET /api/reports/:id - Obtener reporte por ID
router.get('/:id', reportController.getReportById);

// PUT /api/reports/:id - Actualizar reporte
router.put('/:id', reportValidation, reportController.updateReport);

// DELETE /api/reports/:id - Eliminar reporte
router.delete('/:id', reportController.deleteReport);

// POST /api/reports/:id/generate - Generar reporte
router.post('/:id/generate', reportController.generateReport);

// GET /api/reports/:id/download - Descargar reporte
router.get('/:id/download', reportController.downloadReport);

module.exports = router;