const app = require('./app');

const PORT = process.env.PORT || 5000;

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log('🏛️  SIGRISK-EC MAGERIT - Backend Server');
  console.log('🎓 Universidad de las Américas UDLA');
  console.log('========================================');
  console.log(`🌍 Servidor ejecutándose en puerto: ${PORT}`);
  console.log(`📅 Fecha de inicio: ${new Date().toLocaleString('es-EC')}`);
  console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Versión: 1.0.0 - Fases 1-5 Completadas`);
  console.log('');
  console.log('📡 Endpoints disponibles:');
  console.log(`   🏠 Principal: http://localhost:${PORT}/`);
  console.log(`   🏥 Health: http://localhost:${PORT}/health`);
  console.log(`   🔐 Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   👥 Users: http://localhost:${PORT}/api/users`);
  console.log(`   🏢 Organizations: http://localhost:${PORT}/api/organizations`);
  console.log(`   💻 Assets: http://localhost:${PORT}/api/assets`);
  console.log(`   ⚠️  Threats: http://localhost:${PORT}/api/threats`);
  console.log(`   🔍 Vulnerabilities: http://localhost:${PORT}/api/vulnerabilities`);
  console.log(`   📊 Risks: http://localhost:${PORT}/api/risks`);
  console.log(`   📋 Treatments: http://localhost:${PORT}/api/treatments`);
  console.log(`   🛡️  Controls: http://localhost:${PORT}/api/controls`);
  console.log(`   📈 Monitoring: http://localhost:${PORT}/api/monitoring`);
  console.log(`   📄 Reports: http://localhost:${PORT}/api/reports`);
  console.log('');
  console.log('🔧 Comandos útiles:');
  console.log(`   📦 Instalar datos de prueba: npm run seed`);
  console.log(`   🧹 Limpiar base de datos: npm run seed:clear`);
  console.log(`   🧪 Ejecutar pruebas: npm test`);
  console.log(`   📊 Cobertura de pruebas: npm run test:coverage`);
  console.log(`   🔍 Linting: npm run lint`);
  console.log('');
  console.log('🔑 Credenciales por defecto (después del seed):');
  console.log('   👑 Super Admin: carlos.montufar@udla.edu.ec / Admin123!');
  console.log('   🔧 Admin: maria.rodriguez@udla.edu.ec / Admin123!');
  console.log('   📊 Analyst: juan.perez@udla.edu.ec / Analyst123!');
  console.log('   👁️  Viewer: luis.vega@udla.edu.ec / Viewer123!');
  console.log('');
  console.log('✅ Sistema listo para recibir conexiones');
  console.log('========================================');
});

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception! Cerrando servidor...', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection! Cerrando servidor...', err);
  server.close(() => {
    process.exit(1);
  });
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido. Cerrando servidor gracefully...');
  server.close(() => {
    console.log('✅ Proceso terminado');
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT recibido. Cerrando servidor gracefully...');
  server.close(() => {
    console.log('✅ Proceso terminado');
    process.exit(0);
  });
});

module.exports = server;