// src/middleware/errorHandler.js - CORREGIDO

const { log } = require('./logger'); // Importar el objeto log del nuevo logger

// Middleware de manejo de errores para SIGRISK-EC
const errorHandler = (err, req, res, next) => {
  // Log del error con contexto completo usando el nuevo logger
  log.error('Error en aplicación', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code
    },
    request: {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || req.user?._id || 'Anónimo',
      organization: req.user?.organization?._id || req.user?.organization || 'N/A',
      body: req.body ? JSON.stringify(req.body).substring(0, 500) : 'N/A',
      params: req.params,
      query: req.query
    },
    timestamp: new Date().toISOString()
  });

  // Errores de validación de express-validator (ya manejados en validations.js)
  if (err.type === 'validation') {
    return res.status(400).json({
      status: 'error',
      message: 'Errores de validación',
      errors: err.errors,
      timestamp: new Date().toISOString()
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
      status: 'error',
      message: 'Errores de validación de base de datos',
      errors,
      timestamp: new Date().toISOString()
    });
  }

  // Errores de duplicado de MongoDB (índices únicos)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    
    return res.status(409).json({
      status: 'error',
      message: `El ${field} '${value}' ya existe en el sistema`,
      field,
      value,
      code: 'DUPLICATE_ENTRY',
      timestamp: new Date().toISOString()
    });
  }

  // Errores de casting de MongoDB (IDs inválidos)
  if (err.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: 'ID inválido proporcionado',
      field: err.path,
      value: err.value,
      code: 'INVALID_ID',
      timestamp: new Date().toISOString()
    });
  }

  // Errores JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token de acceso inválido',
      code: 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token de acceso expirado',
      code: 'EXPIRED_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  // Errores de autorización personalizados
  if (err.name === 'UnauthorizedError' || err.status === 403) {
    return res.status(403).json({
      status: 'error',
      message: 'No tienes autorización para realizar esta acción',
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString()
    });
  }

  // Errores de conexión a base de datos
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
    return res.status(503).json({
      status: 'error',
      message: 'Error de conexión con la base de datos. Intenta nuevamente.',
      code: 'DATABASE_CONNECTION_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Errores de timeout de MongoDB
  if (err.name === 'MongoTimeoutError') {
    return res.status(408).json({
      status: 'error',
      message: 'Tiempo de espera agotado en la base de datos',
      code: 'DATABASE_TIMEOUT',
      timestamp: new Date().toISOString()
    });
  }

  // Errores de sintaxis JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 'error',
      message: 'JSON inválido en el cuerpo de la petición',
      code: 'INVALID_JSON',
      timestamp: new Date().toISOString()
    });
  }

  // Errores de tamaño de payload
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      status: 'error',
      message: 'El tamaño del archivo o datos enviados es demasiado grande',
      code: 'PAYLOAD_TOO_LARGE',
      timestamp: new Date().toISOString()
    });
  }

  // Errores de Rate Limiting
  if (err.status === 429) {
    return res.status(429).json({
      status: 'error',
      message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString()
    });
  }

  // Errores específicos de SIGRISK-EC
  if (err.code === 'ASSET_NOT_FOUND') {
    return res.status(404).json({
      status: 'error',
      message: 'Activo no encontrado en el sistema',
      code: 'ASSET_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === 'RISK_CALCULATION_ERROR') {
    return res.status(400).json({
      status: 'error',
      message: 'Error en el cálculo de riesgo. Verifica los datos proporcionados.',
      code: 'RISK_CALCULATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === 'ORGANIZATION_ACCESS_DENIED') {
    return res.status(403).json({
      status: 'error',
      message: 'No tienes acceso a los datos de esta organización',
      code: 'ORGANIZATION_ACCESS_DENIED',
      timestamp: new Date().toISOString()
    });
  }

  // Error de archivo no encontrado
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      status: 'error',
      message: 'Archivo o recurso no encontrado',
      code: 'FILE_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  // Errores de multer (subida de archivos)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      status: 'error',
      message: 'El archivo es demasiado grande',
      code: 'FILE_TOO_LARGE',
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      status: 'error',
      message: 'Tipo de archivo no permitido',
      code: 'INVALID_FILE_TYPE',
      timestamp: new Date().toISOString()
    });
  }

  // Error genérico para desarrollo (incluye stack trace)
  if (process.env.NODE_ENV === 'development') {
    return res.status(err.statusCode || err.status || 500).json({
      status: 'error',
      message: err.message || 'Error interno del servidor',
      stack: err.stack,
      error: {
        name: err.name,
        message: err.message,
        code: err.code
      },
      timestamp: new Date().toISOString(),
      environment: 'development'
    });
  }

  // Error genérico para producción (sin información sensible)
  res.status(err.statusCode || err.status || 500).json({
    status: 'error',
    message: err.statusCode || err.status ? err.message : 'Error interno del servidor',
    code: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString()
  });
};

// Middleware para manejar rutas no encontradas (404)
const notFoundHandler = (req, res) => {
  log.warn('Ruta no encontrada', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    status: 'error',
    message: `Ruta ${req.originalUrl} no encontrada`,
    code: 'ROUTE_NOT_FOUND',
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};