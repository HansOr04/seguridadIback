const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();

// ===== MIDDLEWARES DE SEGURIDAD =====
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // máximo 100 requests por ventana
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intente de nuevo más tarde.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ===== MIDDLEWARES GENERALES =====
app.use(compression());

// CORS básico (sin importar config personalizado por ahora)
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token'
  ]
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ===== RUTAS =====
// Cargar rutas de forma segura
try {
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Rutas de auth cargadas');
} catch (error) {
  console.error('❌ Error cargando rutas de auth:', error.message);
}

try {
  const userRoutes = require('./routes/users');
  app.use('/api/users', userRoutes);
  console.log('✅ Rutas de users cargadas');
} catch (error) {
  console.error('❌ Error cargando rutas de users:', error.message);
}
try {
  const assetRoutes = require('./routes/assets');
  app.use('/api/asset', assetRoutes);
  console.log('✅ Rutas de assers cargadas');
} catch (error) {
  console.error('❌ Error cargando rutas de users:', error.message);
}

// Ruta de salud del sistema
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'SIGRISK-EC API funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Ruta para endpoints no encontrados (Express 4.x compatible)
app.all('*', (req, res, next) => {
  const error = new Error(`Endpoint ${req.originalUrl} no encontrado`);
  error.statusCode = 404;
  next(error);
});

// ===== MANEJO DE ERRORES =====
// Error handler básico (sin importar por ahora)
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Error interno del servidor';
  
  res.status(statusCode).json({
    status: 'error',
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

module.exports = app;