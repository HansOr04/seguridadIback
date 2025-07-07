// src/middleware/logger.js - VERSIÓN STANDALONE CORREGIDA

const winston = require('winston');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Configuración directa sin archivo externo
const logDir = path.join(process.cwd(), 'logs');

// Crear directorio de logs si no existe
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuración de Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sigrisk-backend' },
  transports: [
    // Archivo para errores
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5
    }),
    // Archivo para todos los logs
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10
    })
  ],
});

// Solo agregar transporte de consola en desarrollo
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    level: 'debug',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss.SSS'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
      })
    )
  }));
}

// Campos sensibles a filtrar
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'x-api-key',
  'access_token',
  'refresh_token'
];

// URLs a excluir del logging
const EXCLUDE_URLS = [
  '/health',
  '/favicon.ico',
  '/robots.txt'
];

// Función para filtrar información sensible
const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
          obj[key] = '[FILTERED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
    }
    return obj;
  };
  
  return sanitizeObject(sanitized);
};

// Función para verificar si una URL debe ser excluida
const shouldExcludeUrl = (url) => {
  return EXCLUDE_URLS.some(excludeUrl => url.includes(excludeUrl));
};

// Middleware principal de logging HTTP
const httpLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Información básica de la request
  const requestInfo = {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    userId: req.user?.id || req.user?._id || 'anonymous',
    organization: req.user?.organization?._id || req.user?.organization || 'unknown',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };

  // Verificar si la request debe ser excluida
  if (shouldExcludeUrl(requestInfo.url)) {
    return next();
  }

  // Capturar el body de la request (solo en desarrollo y si no es muy grande)
  if (process.env.NODE_ENV === 'development' && req.body) {
    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.length < 10240) { // 10KB
      requestInfo.body = sanitizeData(req.body);
    }
  }

  // Guardar métodos originales de response
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  // Variable para capturar respuesta
  let responseData = null;

  // Override del método send
  res.send = function(data) {
    responseData = data;
    return originalSend.call(this, data);
  };

  // Override del método json
  res.json = function(data) {
    responseData = data;
    return originalJson.call(this, data);
  };

  // Override del método end - AQUÍ ESTABA EL ERROR ORIGINAL
  res.end = function(chunk, encoding) {
    try {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      const method = requestInfo.method; // FIX: Usar requestInfo.method en lugar de variable method indefinida
      
      // Determinar el nivel de log basado en el status code
      let logLevel = 'info';
      let logMessage = '';
      let consoleColor = chalk.green;

      if (statusCode >= 400 && statusCode < 500) {
        logLevel = 'warn';
        consoleColor = chalk.yellow;
        logMessage = `${method} ${requestInfo.url} ${statusCode} ${duration}ms - ${requestInfo.ip} - User: ${requestInfo.userId}`;
      } else if (statusCode >= 500) {
        logLevel = 'error';
        consoleColor = chalk.red;
        logMessage = `${method} ${requestInfo.url} ${statusCode} ${duration}ms - ${requestInfo.ip} - User: ${requestInfo.userId}`;
      } else if (statusCode >= 200 && statusCode < 300) {
        logLevel = 'info';
        consoleColor = chalk.green;
        logMessage = `${method} ${requestInfo.url} ${statusCode} ${duration}ms - ${requestInfo.ip} - User: ${requestInfo.userId}`;
      } else {
        logLevel = 'info';
        consoleColor = chalk.blue;
        logMessage = `${method} ${requestInfo.url} ${statusCode} ${duration}ms - ${requestInfo.ip} - User: ${requestInfo.userId}`;
      }

      // Crear objeto de log completo
      const logData = {
        ...requestInfo,
        response: {
          statusCode,
          duration,
          size: res.get('content-length') || (chunk ? chunk.length : 0)
        }
      };

      // Agregar datos de respuesta si está habilitado y no es muy grande
      if (process.env.NODE_ENV === 'development' && 
          responseData && 
          JSON.stringify(responseData).length < 10240) { // 10KB
        logData.response.body = sanitizeData(responseData);
      }

      // Log de consola con colores (solo en desarrollo)
      if (process.env.NODE_ENV !== 'production') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(consoleColor(`${timestamp} [${logLevel.toUpperCase()}] ${logMessage}`));
      }

      // Log estructurado para archivos
      logger.log(logLevel, logMessage, logData);

      // Log adicional para errores críticos
      if (statusCode >= 500) {
        logger.error(`CRITICAL ERROR: ${method} ${requestInfo.url}`, {
          ...logData,
          critical: true,
          needsAttention: true
        });
      }

      // Verificar si el tiempo de respuesta es lento (más de 5 segundos)
      if (duration > 5000) {
        logger.warn(`SLOW RESPONSE: ${method} ${requestInfo.url} took ${duration}ms`, {
          ...logData,
          performance: {
            slow: true,
            threshold: 5000
          }
        });
      }

    } catch (error) {
      // Error en el propio logger - usar console.error para evitar bucle infinito
      console.error('💥 Error en middleware de logging:', {
        error: error.message,
        stack: error.stack,
        url: requestInfo?.url,
        method: requestInfo?.method
      });
    }

    // Llamar al método original
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Middleware para logging de errores no capturados
const errorLogger = (err, req, res, next) => {
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userId: req.user?.id || req.user?._id || 'anonymous',
    timestamp: new Date().toISOString(),
    type: 'unhandled_error'
  };

  // Log del error
  logger.error('Unhandled Application Error', errorInfo);

  // Log en consola con color (solo en desarrollo)
  if (process.env.NODE_ENV !== 'production') {
    console.error(chalk.red(`💥 Error en aplicación\n${err.stack}`));
  }

  next(err);
};

// Función para logging manual
const log = {
  info: (message, meta = {}) => {
    logger.info(message, meta);
    if (process.env.NODE_ENV !== 'production') {
      console.log(chalk.blue(`ℹ️  ${message}`));
    }
  },
  
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
    if (process.env.NODE_ENV !== 'production') {
      console.log(chalk.yellow(`⚠️  ${message}`));
    }
  },
  
  error: (message, meta = {}) => {
    logger.error(message, meta);
    if (process.env.NODE_ENV !== 'production') {
      console.log(chalk.red(`❌ ${message}`));
    }
  },
  
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
    if (process.env.NODE_ENV !== 'production') {
      console.log(chalk.cyan(`🔍 ${message}`));
    }
  },
  
  success: (message, meta = {}) => {
    logger.info(`SUCCESS: ${message}`, meta);
    if (process.env.NODE_ENV !== 'production') {
      console.log(chalk.green(`✅ ${message}`));
    }
  },
  
  // Función especial para logs de seguridad
  security: (message, meta = {}) => {
    logger.info(`SECURITY: ${message}`, { ...meta, type: 'security' });
    if (process.env.NODE_ENV !== 'production') {
      console.log(chalk.magenta(`🔒 SECURITY: ${message}`));
    }
  },
  
  // Función especial para logs de auditoría
  audit: (action, userId, details = {}) => {
    const auditData = {
      userId,
      action,
      details: sanitizeData(details),
      timestamp: new Date().toISOString(),
      type: 'audit'
    };
    
    logger.info(`AUDIT: ${action}`, auditData);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(chalk.blue(`📝 AUDIT: ${action} by ${userId}`));
    }
  }
};

// Manejadores de excepciones globales
process.on('uncaughtException', (error) => {
  console.error(chalk.red('💥 Excepción no capturada:'), error);
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    type: 'uncaught_exception'
  });
  
  // Dar tiempo para que se escriban los logs antes de salir
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('💥 Promise rechazada no manejada:'), reason);
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    type: 'unhandled_rejection'
  });
});

module.exports = {
  httpLogger,
  errorLogger,
  log,
  logger
};