    const fs = require('fs');
const path = require('path');
const util = require('util');

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuración de colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Utilidad para obtener IP del cliente
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         'IP no disponible';
};

// Utilidad para formatear fecha
const formatDate = (date = new Date()) => {
  return date.toISOString().replace('T', ' ').replace('Z', '');
};

// Utilidad para obtener nivel de log según status code
const getLogLevel = (statusCode) => {
  if (statusCode >= 500) return 'ERROR';
  if (statusCode >= 400) return 'WARN';
  if (statusCode >= 300) return 'INFO';
  return 'SUCCESS';
};

// Utilidad para obtener color según nivel
const getColorByLevel = (level) => {
  const colorMap = {
    'ERROR': colors.red,
    'WARN': colors.yellow,
    'INFO': colors.blue,
    'SUCCESS': colors.green,
    'DEBUG': colors.cyan
  };
  return colorMap[level] || colors.white;
};

// Función para escribir en archivo
const writeToFile = (filename, content) => {
  const filePath = path.join(logsDir, filename);
  const logEntry = `${content}\n`;
  
  fs.appendFile(filePath, logEntry, (err) => {
    if (err) {
      console.error('Error escribiendo log:', err);
    }
  });
};

// Función para formatear logs
const formatLogEntry = (req, res, responseTime, level = 'INFO') => {
  const timestamp = formatDate();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const status = res.statusCode;
  const ip = getClientIP(req);
  const userAgent = req.get('User-Agent') || 'N/A';
  const contentLength = res.get('Content-Length') || '-';
  const userId = req.user?.id || 'Anónimo';
  const organization = req.user?.organization || 'N/A';
  
  // Formato JSON para logs estructurados
  const logData = {
    timestamp,
    level,
    method,
    url,
    status,
    responseTime: `${responseTime}ms`,
    ip,
    userId,
    organization,
    contentLength,
    userAgent,
    environment: process.env.NODE_ENV || 'development'
  };

  // Formato legible para consola
  const consoleFormat = `${timestamp} [${level}] ${method} ${url} ${status} ${responseTime}ms - ${ip} - User: ${userId}`;
  
  // Formato detallado para archivo
  const fileFormat = JSON.stringify(logData, null, 2);
  
  return { consoleFormat, fileFormat, logData };
};

// Middleware principal de logging
const logger = (req, res, next) => {
  const startTime = Date.now();
  
  // Interceptar el final de la respuesta
  const originalEnd = res.end;
  const originalWrite = res.write;
  
  let body = '';
  
  // Capturar body de respuesta para logs detallados
  res.write = function(chunk, encoding) {
    if (chunk) {
      body += chunk.toString();
    }
    return originalWrite.call(res, chunk, encoding);
  };
  
  res.end = function(chunk, encoding) {
    if (chunk) {
      body += chunk.toString();
    }
    const url = req.originalUrl || req.url;

    const responseTime = Date.now() - startTime;
    const level = getLogLevel(res.statusCode);
    const { consoleFormat, fileFormat, logData } = formatLogEntry(req, res, responseTime, level);
    
    // Log en consola con colores
    const color = getColorByLevel(level);
    console.log(`${color}${consoleFormat}${colors.reset}`);
    
    // Escribir en archivos según el nivel
    const today = new Date().toISOString().split('T')[0];
    
    // Log general
    writeToFile(`access-${today}.log`, fileFormat);
    
    // Logs específicos por nivel
    if (level === 'ERROR') {
      writeToFile(`error-${today}.log`, fileFormat);
    } else if (level === 'WARN') {
      writeToFile(`warning-${today}.log`, fileFormat);
    }
    
    // Log detallado en desarrollo
    if (process.env.NODE_ENV === 'development') {
      const detailedLog = {
        ...logData,
        headers: req.headers,
        query: req.query,
        params: req.params,
        body: req.body ? JSON.stringify(req.body).substring(0, 1000) + '...' : 'N/A',
        responseBody: body.substring(0, 500) + '...'
      };
      writeToFile(`detailed-${today}.log`, JSON.stringify(detailedLog, null, 2));
    }
    
    // Métricas especiales para SIGRISK-EC
    if (url.includes('/api/risks') || url.includes('/api/assets')) {
      const securityLog = {
        ...logData,
        module: 'SECURITY',
        action: method === 'GET' ? 'CONSULTA' : method === 'POST' ? 'CREACION' : method === 'PUT' ? 'ACTUALIZACION' : 'ELIMINACION',
        resource: url.includes('/risks') ? 'RIESGO' : 'ACTIVO'
      };
      writeToFile(`security-${today}.log`, JSON.stringify(securityLog, null, 2));
    }
    
    return originalEnd.call(res, chunk, encoding);
  };
  
  next();
};

// Funciones de logging manual
const logInfo = (message, data = {}) => {
  const timestamp = formatDate();
  const logEntry = {
    timestamp,
    level: 'INFO',
    message,
    data,
    environment: process.env.NODE_ENV || 'development'
  };
  
  console.log(`${colors.blue}[INFO] ${timestamp} - ${message}${colors.reset}`);
  const today = new Date().toISOString().split('T')[0];
  writeToFile(`app-${today}.log`, JSON.stringify(logEntry, null, 2));
};

const logError = (message, error = {}, data = {}) => {
  const timestamp = formatDate();
  const logEntry = {
    timestamp,
    level: 'ERROR',
    message,
    error: {
      message: error.message || 'Error desconocido',
      stack: error.stack || 'Stack no disponible',
      code: error.code || 'N/A'
    },
    data,
    environment: process.env.NODE_ENV || 'development'
  };
  
  console.error(`${colors.red}[ERROR] ${timestamp} - ${message}${colors.reset}`);
  console.error(`${colors.red}${error.stack || error.message}${colors.reset}`);
  
  const today = new Date().toISOString().split('T')[0];
  writeToFile(`error-${today}.log`, JSON.stringify(logEntry, null, 2));
  writeToFile(`app-${today}.log`, JSON.stringify(logEntry, null, 2));
};

const logWarning = (message, data = {}) => {
  const timestamp = formatDate();
  const logEntry = {
    timestamp,
    level: 'WARN',
    message,
    data,
    environment: process.env.NODE_ENV || 'development'
  };
  
  console.warn(`${colors.yellow}[WARN] ${timestamp} - ${message}${colors.reset}`);
  const today = new Date().toISOString().split('T')[0];
  writeToFile(`warning-${today}.log`, JSON.stringify(logEntry, null, 2));
  writeToFile(`app-${today}.log`, JSON.stringify(logEntry, null, 2));
};

const logDebug = (message, data = {}) => {
  if (process.env.NODE_ENV === 'development') {
    const timestamp = formatDate();
    const logEntry = {
      timestamp,
      level: 'DEBUG',
      message,
      data,
      environment: process.env.NODE_ENV || 'development'
    };
    
    console.log(`${colors.cyan}[DEBUG] ${timestamp} - ${message}${colors.reset}`);
    const today = new Date().toISOString().split('T')[0];
    writeToFile(`debug-${today}.log`, JSON.stringify(logEntry, null, 2));
  }
};

// Función para limpiar logs antiguos
const cleanOldLogs = (daysToKeep = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  fs.readdir(logsDir, (err, files) => {
    if (err) {
      console.error('Error leyendo directorio de logs:', err);
      return;
    }
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (stats.mtime < cutoffDate) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.error('Error eliminando log antiguo:', err);
            } else {
              console.log(`Log antiguo eliminado: ${file}`);
            }
          });
        }
      });
    });
  });
};

// Función para obtener estadísticas de logs
const getLogStats = () => {
  return new Promise((resolve, reject) => {
    fs.readdir(logsDir, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      
      const stats = {
        totalFiles: files.length,
        logTypes: {},
        totalSize: 0
      };
      
      let processed = 0;
      
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        fs.stat(filePath, (err, fileStat) => {
          if (!err) {
            stats.totalSize += fileStat.size;
            const logType = file.split('-')[0];
            stats.logTypes[logType] = (stats.logTypes[logType] || 0) + 1;
          }
          
          processed++;
          if (processed === files.length) {
            stats.totalSizeMB = Math.round(stats.totalSize / (1024 * 1024) * 100) / 100;
            resolve(stats);
          }
        });
      });
      
      if (files.length === 0) {
        resolve(stats);
      }
    });
  });
};

module.exports = {
  logger,
  logInfo,
  logError,
  logWarning,
  logDebug,
  cleanOldLogs,
  getLogStats
};