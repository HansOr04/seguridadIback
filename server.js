const { app } = require('./src/app');
const { logInfo } = require('./src/middleware/logger');

const PORT = process.env.PORT || 3000;

// Iniciar el servidor directamente con app
const server = app.listen(PORT, () => {
  logInfo('Servidor SIGRISK-EC iniciado exitosamente', {
    port: PORT,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    processId: process.pid,
    nodeVersion: process.version
  });
  console.log(`🚀 SIGRISK-EC MAGERIT Backend corriendo en puerto ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`📝 Logs guardados en: ./logs/`);
});

// Manejo de errores del servidor
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(`❌ ${bind} requiere privilegios elevados`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`❌ ${bind} ya está en uso`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

module.exports = server;  