const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');

// Importar configuraciones
require('dotenv').config();
const { connectDB } = require('./config/database');
const corsConfig = require('./config/cors');

// Importar middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

// Importar rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const organizationRoutes = require('./routes/organizations');
const assetRoutes = require('./routes/assets');
const threatRoutes = require('./routes/threats');
const vulnerabilityRoutes = require('./routes/vulnerabilities');
const riskRoutes = require('./routes/risks');
const treatmentRoutes = require('./routes/treatments');
const controlRoutes = require('./routes/controls');
const monitoringRoutes = require('./routes/monitoring');
const reportRoutes = require('./routes/reports');

// Importar servicios
const cronJobs = require('./services/cronJobs');

// Crear aplicación Express
const app = express();

// Conectar a MongoDB
connectDB();

// Configurar rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // máximo 100 requests por ventana
  message: {
    success: false,
    message: 'Demasiadas solicitudes, intenta nuevamente más tarde'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configurar CORS
app.use(cors(corsConfig));

// Rate limiting
app.use(limiter);

// Compresión
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Middleware personalizado de logging
app.use(logger);

// Rutas de salud
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SIGRISK-EC MAGERIT Backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'conectada' : 'desconectada',
    cronJobs: cronJobs.getStatus()
  });
});

// Ruta principal
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
      'KPIs y métricas en tiempo real'
    ],
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      organizations: '/api/organizations',
      assets: '/api/assets',
      threats: '/api/threats',
      vulnerabilities: '/api/vulnerabilities',
      risks: '/api/risks',
      treatments: '/api/treatments',
      controls: '/api/controls',
      monitoring: '/api/monitoring',
      reports: '/api/reports'
    },
    documentation: '/api/docs',
    health: '/health'
  });
});

// Configurar rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/threats', threatRoutes);
app.use('/api/vulnerabilities', vulnerabilityRoutes);
app.use('/api/risks', riskRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/controls', controlRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/reports', reportRoutes);

// Ruta para manejar 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint no encontrado',
    requestedUrl: req.originalUrl,
    availableEndpoints: {
      auth: '/api/auth',
      users: '/api/users',
      organizations: '/api/organizations',
      assets: '/api/assets',
      threats: '/api/threats',
      vulnerabilities: '/api/vulnerabilities',
      risks: '/api/risks',
      treatments: '/api/treatments',
      controls: '/api/controls',
      monitoring: '/api/monitoring',
      reports: '/api/reports'
    }
  });
});

// Middleware de manejo de errores (debe ir al final)
app.use(errorHandler);

// Inicializar cron jobs en producción
if (process.env.NODE_ENV === 'production') {
  cronJobs.initialize();
}

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido, cerrando servidor...');
  cronJobs.stopAll();
  mongoose.connection.close();
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recibido, cerrando servidor...');
  cronJobs.stopAll();
  mongoose.connection.close();
  process.exit(0);
});

module.exports = app;