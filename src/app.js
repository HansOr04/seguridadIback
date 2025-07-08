const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Configs y middlewares personalizados
const { connectDatabase } = require('./config/database');
const corsMiddleware = require('./config/cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { httpLogger, log, logger } = require('./middleware/logger');

// Rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const assetRoutes = require('./routes/assets');
const riskRoutes = require('./routes/risks');
const treatmentRoutes = require('./routes/treatments');
const controlRoutes = require('./routes/controls');
const monitoringRoutes = require('./routes/monitoring');
const reportRoutes = require('./routes/reports');

const app = express();

// 🛠️ Conexión a MongoDB
connectDatabase();

// 📝 Inicio de aplicación
log.info('Iniciando SIGRISK-EC MAGERIT Backend', {
  version: '1.0.0',
  environment: process.env.NODE_ENV,
  port: process.env.PORT || 3000
});

// ⚙️ Rate Limiting
const handleRateLimitExceeded = (req, res) => {
  log.warn('Rate limit excedido', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
  res.status(429).json({
    status: 'error',
    message: 'Demasiadas solicitudes, intenta nuevamente más tarde',
    timestamp: new Date().toISOString()
  });
};

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: handleRateLimitExceeded
});

// 🛡️ Middlewares globales
app.use(corsMiddleware);
app.options('*', corsMiddleware);

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(limiter);
app.use(compression());
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (buf.length > 1024 * 1024) {
      log.warn('Request con body muy grande detectado', {
        size: buf.length,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging HTTP
app.use(httpLogger);

// 🔥 Capturar JSON inválido
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    log.error('Error de parsing JSON', {
      error: err.message,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(400).json({ 
      status: 'error', 
      message: 'JSON inválido en el body de la petición',
      timestamp: new Date().toISOString()
    });
  }
  next();
});

// 📡 Endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'SIGRISK-EC MAGERIT - Sistema de Gestión Cuantitativa de Riesgos Cibernéticos',
    data: {
      version: '1.0.0',
      description: 'Backend desarrollado para USFQ - Ingeniería en Ciberseguridad',
      methodology: 'MAGERIT v3.0 + Normativas Ecuatorianas',
      features: [
        'Autenticación JWT completa',
        'Gestión de activos MAGERIT',
        'Cálculo cuantitativo de riesgos',
        'Tratamientos y controles ISO 27002',
        'Monitoreo continuo automatizado',
        'Generación de reportes PDF/Excel',
        'Integración CVE/NVD (preparada)',
        'KPIs y métricas en tiempo real',
        'Logging completo y auditoría'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'conectada' : 'desconectada';

    const logStats = {
      available: true,
      directory: path.join(process.cwd(), 'logs'),
      timestamp: new Date().toISOString()
    };

    res.json({
      status: 'success',
      message: 'SIGRISK-EC MAGERIT Backend funcionando correctamente',
      data: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        database: dbStatus,
        logs: logStats,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  } catch (error) {
    log.error('Error en health check', { error: error.message });
    res.status(500).json({ 
      status: 'error', 
      message: 'Error en health check', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/logs/stats', async (req, res) => {
  try {
    const stats = {
      available: true,
      directory: path.join(process.cwd(), 'logs'),
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
    
    res.json({ 
      status: 'success', 
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Error obteniendo estadísticas de logs', { error: error.message });
    res.status(500).json({ 
      status: 'error', 
      message: 'Error obteniendo estadísticas de logs',
      timestamp: new Date().toISOString()
    });
  }
});

// 📁 Rutas principales
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/risks', riskRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/controls', controlRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/reports', reportRoutes);

// 🔎 Ruta no encontrada
app.use(notFoundHandler);

// 🧯 Manejo de errores final
app.use(errorHandler);

// Función utilitaria para limpiar logs antiguos
const cleanOldLogs = (days = 30) => {
  try {
    const fs = require('fs');
    const logDir = path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logDir)) return;

    const files = fs.readdirSync(logDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    files.forEach(file => {
      try {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          log.info(`Log file eliminado: ${file}`);
        }
      } catch (error) {
        log.warn(`Error procesando archivo de log ${file}: ${error.message}`);
      }
    });
  } catch (error) {
    log.error('Error en limpieza de logs', { error: error.message });
  }
};

// 🔌 Graceful Shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM recibido en app.js, preparando cierre...');
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close(() => {
      log.info('Conexión MongoDB cerrada desde app.js');
    });
  }
});

process.on('SIGINT', () => {
  log.info('SIGINT recibido en app.js, preparando cierre...');
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close(() => {
      log.info('Conexión MongoDB cerrada desde app.js');
    });
  }
});

// Exportar app y utilitarios
module.exports = { 
  app, 
  cleanOldLogs 
};
