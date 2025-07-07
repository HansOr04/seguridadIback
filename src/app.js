const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

// Configs y middlewares personalizados
const { connectDatabase } = require('./config/database');
const corsMiddleware = require('./config/cors');
const errorHandler = require('./middleware/errorHandler');
const {
  logger,
  logInfo,
  logError,
  logWarning,
  cleanOldLogs,
  getLogStats
} = require('./middleware/logger');

// Rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const assetRoutes = require('./routes/assets');
const riskRoutes = require('./routes/risks');
const treatmentRoutes = require('./routes/treatments');
const controlRoutes = require('./routes/controls');
const monitoringRoutes = require('./routes/monitoring');
const reportRoutes = require('./routes/reports');

// Servicios
const cronJobs = require('./services/cronJobs');

const app = express();

// 🛠️ Conexión a MongoDB
connectDatabase();

// 📝 Inicio de aplicación
logInfo('Iniciando SIGRISK-EC MAGERIT Backend', {
  version: '1.0.0',
  environment: process.env.NODE_ENV,
  port: process.env.PORT || 3000
});

// ⚙️ Rate Limiting
const handleRateLimitExceeded = (req, res) => {
  logWarning('Rate limit excedido', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
  res.status(429).json({
    success: false,
    message: 'Demasiadas solicitudes, intenta nuevamente más tarde'
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
      logWarning('Request con body muy grande detectado', {
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
app.use(logger);

// 🔥 Capturar JSON inválido
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logError('Error de parsing JSON', err, {
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(400).json({ success: false, message: 'JSON inválido en el body de la petición' });
  }
  next();
});

// 📡 Endpoints
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SIGRISK-EC MAGERIT - Sistema de Gestión Cuantitativa de Riesgos Cibernéticos',
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
  });
});

app.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'conectada' : 'desconectada';
    const cronStatus = cronJobs.getStatus();
    const logStats = await getLogStats();
    res.json({
      success: true,
      message: 'SIGRISK-EC MAGERIT Backend funcionando correctamente',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV,
      database: dbStatus,
      cronJobs: cronStatus,
      logs: logStats,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    logError('Error en health check', error);
    res.status(500).json({ success: false, message: 'Error en health check', error: error.message });
  }
});

app.get('/api/logs/stats', async (req, res) => {
  try {
    const stats = await getLogStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logError('Error obteniendo estadísticas de logs', error);
    res.status(500).json({ success: false, message: 'Error obteniendo estadísticas de logs' });
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
app.use((req, res) => {
  logWarning('Endpoint no encontrado', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    requestedUrl: req.originalUrl
  });
});

// 🧯 Manejo de errores final
app.use(errorHandler);

// 🕒 Cron Jobs en producción
if (process.env.NODE_ENV === 'production') {
  cronJobs.initialize();
  logInfo('Cron jobs inicializados en producción');
}

cron.schedule('0 2 * * *', () => {
  logInfo('Iniciando limpieza de logs antiguos');
  cleanOldLogs(30);
}, { timezone: 'America/Guayaquil' });

cron.schedule('0 * * * *', async () => {
  try {
    const stats = await getLogStats();
    logInfo('Estadísticas de logs generadas', stats);
  } catch (error) {
    logError('Error generando estadísticas de logs', error);
  }
});

// 🔌 Graceful Shutdown
process.on('SIGTERM', () => {
  logInfo('SIGTERM recibido, cerrando servidor...');
  cronJobs.stopAll();
  mongoose.connection.close(() => {
    logInfo('Conexión MongoDB cerrada');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logInfo('SIGINT recibido, cerrando servidor...');
  cronJobs.stopAll();
  mongoose.connection.close(() => {
    logInfo('Conexión MongoDB cerrada');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logError('Excepción no capturada', error, { fatal: true });
  console.error('💥 Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Promise rejection no manejada', new Error(reason), { fatal: false });
  console.error('💥 Promise rejection no manejada:', reason);
});

module.exports = { app };
