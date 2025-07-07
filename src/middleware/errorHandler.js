const { logError } = require('./logger');

// Middleware de manejo de errores para SIGRISK-EC
const errorHandler = (err, req, res, next) => {
  // Log del error con contexto completo
  logError('Error en aplicación', err, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'Anónimo',
    organization: req.user?.organization || 'N/A',
    body: req.body ? JSON.stringify(req.body).substring(0, 500) : 'N/A',
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  // Errores de validación de express-validator (ya manejados en validations.js)
  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors: err.errors
    });
  }

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message,
      value: val.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Errores de validación de base de datos',
      errors
    });
  }

  // Errores de duplicado de MongoDB (índices únicos)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    
    return res.status(409).json({
      success: false,
      message: `El ${field} '${value}' ya existe en el sistema`,
      field,
      value,
      code: 'DUPLICATE_ENTRY'
    });
  }

  // Errores de casting de MongoDB (IDs inválidos)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID inválido proporcionado',
      field: err.path,
      value: err.value,
      code: 'INVALID_ID'
    });
  }

  // Errores JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token de acceso inválido',
      code: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token de acceso expirado',
      code: 'EXPIRED_TOKEN'
    });
  }

  // Errores de autorización personalizados
  if (err.name === 'UnauthorizedError' || err.status === 403) {
    return res.status(403).json({
      success: false,
      message: 'No tienes autorización para realizar esta acción',
      code: 'UNAUTHORIZED'
    });
  }

  // Errores de conexión a base de datos
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
    return res.status(503).json({
      success: false,
      message: 'Error de conexión con la base de datos. Intenta nuevamente.',
      code: 'DATABASE_CONNECTION_ERROR'
    });
  }

  // Errores de timeout de MongoDB
  if (err.name === 'MongoTimeoutError') {
    return res.status(408).json({
      success: false,
      message: 'Tiempo de espera agotado en la base de datos',
      code: 'DATABASE_TIMEOUT'
    });
  }

  // Errores de sintaxis JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'JSON inválido en el cuerpo de la petición',
      code: 'INVALID_JSON'
    });
  }

  // Errores de tamaño de payload
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'El tamaño del archivo o datos enviados es demasiado grande',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  // Errores de Rate Limiting
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }

  // Errores específicos de SIGRISK-EC
  if (err.code === 'ASSET_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      message: 'Activo no encontrado en el sistema',
      code: 'ASSET_NOT_FOUND'
    });
  }

  if (err.code === 'RISK_CALCULATION_ERROR') {
    return res.status(400).json({
      success: false,
      message: 'Error en el cálculo de riesgo. Verifica los datos proporcionados.',
      code: 'RISK_CALCULATION_ERROR'
    });
  }

  if (err.code === 'ORGANIZATION_ACCESS_DENIED') {
    return res.status(403).json({
      success: false,
      message: 'No tienes acceso a los datos de esta organización',
      code: 'ORGANIZATION_ACCESS_DENIED'
    });
  }

  // Error de archivo no encontrado
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      message: 'Archivo o recurso no encontrado',
      code: 'FILE_NOT_FOUND'
    });
  }

  // Errores de multer (subida de archivos)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'El archivo es demasiado grande',
      code: 'FILE_TOO_LARGE'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Tipo de archivo no permitido',
      code: 'INVALID_FILE_TYPE'
    });
  }

  // Error genérico para desarrollo (incluye stack trace)
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message || 'Error interno del servidor',
      stack: err.stack,
      error: err,
      timestamp: new Date().toISOString(),
      environment: 'development'
    });
  }

  // Error genérico para producción (sin información sensible)
  res.status(err.statusCode || err.status || 500).json({
    success: false,
    message: err.statusCode || err.status ? err.message : 'Error interno del servidor',
    code: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString()
  });
};

// Middleware para manejar rutas no encontradas (404)
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`,
    code: 'ROUTE_NOT_FOUND',
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;