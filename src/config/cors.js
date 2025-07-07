const cors = require('cors');

const allowedOrigins = [
  'http://localhost:3000',         // Desarrollo local
  'http://localhost:3001',         // Testing alternativo
  'https://sigrisk-ec.vercel.app', // Producción
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      // Permitir peticiones sin origin (apps móviles, herramientas locales, etc.)
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true); // ✅ Origin permitido
    } else {
      console.warn('❌ Origin no permitido por política CORS:', origin);
      return callback(new Error('No permitido por política CORS'));
    }
  },
  credentials: true, // Permitir cookies y headers de autenticación
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Métodos permitidos
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control'
  ],
  optionsSuccessStatus: 200 // Para compatibilidad con navegadores antiguos
};

module.exports = cors(corsOptions);
