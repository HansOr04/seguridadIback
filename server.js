// server.js - OPTIMIZADO SIN CRON JOBS
const { app } = require('./src/app');
const { log } = require('./src/middleware/logger');

const PORT = process.env.PORT || 3000;
let server = null;

// Iniciar el servidor
const startServer = () => {
  try {
    server = app.listen(PORT, () => {
      log.info('Servidor SIGRISK-EC iniciado exitosamente', {
        port: PORT,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        processId: process.pid,
        nodeVersion: process.version
      });

      console.log(`🚀 SIGRISK-EC MAGERIT Backend corriendo en puerto ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`📝 Logs guardados en: ./logs/`);
      console.log(`🔧 PID: ${process.pid}`);
    });

    // Configurar timeout para requests
    server.timeout = 120000; // 2 minutos

    return server;
  } catch (error) {
    log.error('Error crítico iniciando servidor:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Manejo de errores del servidor
const setupServerErrorHandling = (server) => {
  server.on('error', (error) => {
    log.error('Error en servidor', {
      error: error.message,
      code: error.code,
      syscall: error.syscall,
      port: PORT,
      pid: process.pid
    });

    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

    switch (error.code) {
      case 'EACCES':
        console.error(`❌ ${bind} requiere privilegios elevados`);
        log.error('Puerto requiere privilegios elevados', { port: PORT, bind });
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(`❌ ${bind} ya está en uso`);
        log.error('Puerto ya está en uso', { port: PORT, bind });
        process.exit(1);
        break;
      default:
        console.error(`❌ Error del servidor: ${error.message}`);
        throw error;
    }
  });

  server.on('clientError', (err, socket) => {
    log.warn('Error de cliente detectado', {
      error: err.message,
      remoteAddress: socket.remoteAddress
    });

    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });

  server.on('timeout', (socket) => {
    log.warn('Timeout de conexión detectado', {
      remoteAddress: socket.remoteAddress
    });
  });
};

// Configurar manejo de cierre graceful
const setupGracefulShutdown = (server) => {
  const gracefulShutdown = (signal) => {
    log.info(`${signal} recibido en server.js, iniciando cierre graceful...`, {
      signal,
      pid: process.pid,
      uptime: process.uptime()
    });

    // 1. Cerrar servidor HTTP
    server.close((err) => {
      if (err) {
        log.error('Error cerrando servidor HTTP:', { error: err.message });
      } else {
        log.info('Servidor HTTP cerrado exitosamente');
      }

      // 2. Cerrar conexión de base de datos
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.close(() => {
          log.info('Conexión MongoDB cerrada exitosamente');
          log.info('Cierre graceful completado, saliendo del proceso...', {
            finalUptime: process.uptime(),
            finalMemory: process.memoryUsage()
          });
          process.exit(0);
        });
      } else {
        log.info('Cierre graceful completado (no había conexión DB), saliendo del proceso...');
        process.exit(0);
      }
    });

    // Forzar cierre después de 10 segundos si no responde
    setTimeout(() => {
      log.error('Forzando cierre del proceso después de 10 segundos...');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Manejar excepciones no capturadas
  process.on('uncaughtException', (err) => {
    log.error('Excepción no capturada en server.js:', {
      error: err.message,
      stack: err.stack
    });
    console.error('❌ Excepción no capturada:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.error('Promise rejection no manejada en server.js:', {
      reason: reason?.message || reason,
      promise: promise.toString()
    });
    console.error('❌ Promise rejection no manejada:', reason);
  });
};

// Función para monitorear estado del servidor
const setupHealthMonitoring = () => {
  // Monitorear memoria cada 5 minutos
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    if (memMB.heapUsed > 500) {
      log.warn('Alto uso de memoria detectado', {
        memory: memMB,
        uptime: Math.round(process.uptime())
      });
    }
  }, 5 * 60 * 1000);

  // Log de estado cada hora
  setInterval(() => {
    log.info('Estado del servidor', {
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV,
      pid: process.pid
    });
  }, 60 * 60 * 1000);
};

// Función principal
const main = () => {
  try {
    log.info('🚀 Iniciando SIGRISK-EC MAGERIT Backend...', {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      cwd: process.cwd()
    });

    const server = startServer();
    setupServerErrorHandling(server);
    setupGracefulShutdown(server);
    setupHealthMonitoring();

    log.info('✅ Configuración del servidor completada exitosamente');
  } catch (error) {
    log.error('❌ Error crítico en función main:', {
      error: error.message,
      stack: error.stack
    });

    console.error('❌ Error crítico iniciando aplicación:', error);
    process.exit(1);
  }
};

// Ejecutar aplicación
if (require.main === module) {
  main();
} else {
  module.exports = startServer();
}
