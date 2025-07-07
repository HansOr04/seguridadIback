// src/app.js - Versión corregida
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
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// ===== MIDDLEWARES GENERALES =====
app.use(compression());
app.use(morgan('combined'));
app.use(cookieParser());

// Parsear JSON y URL encoded
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '10mb',
  strict: true
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FILE_SIZE || '10mb'
}));

// ===== MIDDLEWARE DE LOGGING =====
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// ===== RUTAS DE API =====
const loadRoutes = () => {
  try {
    // Importar rutas con manejo de errores
    console.log('📂 Cargando rutas de API...');

    // Rutas básicas (siempre disponibles)
    try {
      const authRoutes = require('./routes/auth');
      app.use('/api/auth', authRoutes);
      console.log('✅ Rutas de autenticación cargadas');
    } catch (error) {
      console.error('❌ Error cargando rutas de auth:', error.message);
    }

    try {
      const userRoutes = require('./routes/users');
      app.use('/api/users', userRoutes);
      console.log('✅ Rutas de usuarios cargadas');
    } catch (error) {
      console.error('❌ Error cargando rutas de users:', error.message);
    }

    try {
      const assetRoutes = require('./routes/assets');
      app.use('/api/assets', assetRoutes);
      console.log('✅ Rutas de activos cargadas');
    } catch (error) {
      console.error('❌ Error cargando rutas de assets:', error.message);
    }

    // Rutas de CVE (con validación de dependencias)
    try {
      const cveRoutes = require('./routes/cve');
      app.use('/api/cve', cveRoutes);
      console.log('✅ Rutas de CVE cargadas');
    } catch (error) {
      console.error('❌ Error cargando rutas de CVE:', error.message);
    }

    // Rutas de riesgos (con validación de dependencias)
    try {
      const riskRoutes = require('./routes/risks');
      app.use('/api/risks', riskRoutes);
      console.log('✅ Rutas de riesgos cargadas');
    } catch (error) {
      console.error('❌ Error cargando rutas de risks:', error.message);
    }

    // Rutas opcionales (cargar solo si existen)
    const optionalRoutes = [
      { path: './routes/organizations', mount: '/api/organizations', name: 'organizaciones' },
      { path: './routes/threats', mount: '/api/threats', name: 'amenazas' },
      { path: './routes/vulnerabilities', mount: '/api/vulnerabilities', name: 'vulnerabilidades' },
      { path: './routes/treatments', mount: '/api/treatments', name: 'tratamientos' },
      { path: './routes/controls', mount: '/api/controls', name: 'controles' },
      { path: './routes/monitoring', mount: '/api/monitoring', name: 'monitoreo' },
      { path: './routes/reports', mount: '/api/reports', name: 'reportes' },
      { path: './routes/kpis', mount: '/api/kpis', name: 'KPIs' }
    ];

    optionalRoutes.forEach(route => {
      try {
        const routeModule = require(route.path);
        app.use(route.mount, routeModule);
        console.log(`✅ Rutas de ${route.name} cargadas`);
      } catch (error) {
        console.log(`⚠️  Rutas de ${route.name} no disponibles (${error.message})`);
      }
    });

    console.log('🎯 Carga de rutas completada');

  } catch (error) {
    console.error('❌ Error general cargando rutas:', error);
  }
};

// Cargar rutas
loadRoutes();

// ===== RUTA 404 =====
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Ruta ${req.originalUrl} no encontrada`,
    timestamp: new Date().toISOString()
  });
});

// ===== MIDDLEWARE DE MANEJO DE ERRORES =====
app.use((error, req, res, next) => {
  console.error('❌ Error no capturado:', error);

  // Error de sintaxis JSON
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      status: 'error',
      message: 'JSON inválido en el cuerpo de la petición',
      timestamp: new Date().toISOString()
    });
  }

  // Error de validación de Mongoose
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    
    return res.status(400).json({
      status: 'error',
      message: 'Error de validación',
      errors,
      timestamp: new Date().toISOString()
    });
  }

  // Error de cast de Mongoose (ID inválido)
  if (error.name === 'CastError') {
    return res.status(400).json({
      status: 'error',
      message: `ID inválido: ${error.value}`,
      timestamp: new Date().toISOString()
    });
  }

  // Error de duplicado de MongoDB
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    
    return res.status(409).json({
      status: 'error',
      message: `El ${field} '${value}' ya existe`,
      timestamp: new Date().toISOString()
    });
  }

  // Error JWT
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token inválido',
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      message: 'Token expirado',
      timestamp: new Date().toISOString()
    });
  }

  // Error genérico
  const status = error.status || error.statusCode || 500;
  const message = error.message || 'Error interno del servidor';

  res.status(status).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    timestamp: new Date().toISOString()
  });
});

module.exports = app;