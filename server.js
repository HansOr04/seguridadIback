// Cargar variables de entorno PRIMERO
require('dotenv').config();

const app = require('./src/app');
const { connectDatabase } = require('./src/config/database');

const PORT = process.env.PORT || 5000;

// Conectar a MongoDB Atlas
connectDatabase();

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor SIGRISK-EC ejecutándose en puerto ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 MongoDB: ${process.env.MONGODB_URI ? 'Configurado' : 'No configurado'}`);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado exitosamente');
  });
});

module.exports = server;