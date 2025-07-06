const mongoose = require('mongoose');

const connectDatabase = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI no está definida en las variables de entorno');
    }

    // Opciones actualizadas para Mongoose 8.x
    const options = {
      maxPoolSize: 10, // Máximo 10 conexiones simultáneas
      serverSelectionTimeoutMS: 5000, // 5 segundos timeout
      socketTimeoutMS: 45000, // 45 segundos socket timeout
    };

    const conn = await mongoose.connect(mongoURI, options);

    console.log(`✅ MongoDB Atlas conectado: ${conn.connection.host}`);
    console.log(`📊 Base de datos: ${conn.connection.name}`);

    // Event listeners para monitoreo
    mongoose.connection.on('connected', () => {
      console.log('🔗 Mongoose conectado a MongoDB Atlas');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de conexión MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 Mongoose desconectado de MongoDB');
    });

    // Manejo de cierre graceful
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('🛑 Conexión MongoDB cerrada por terminación de aplicación');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error cerrando conexión MongoDB:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Error conectando a MongoDB Atlas:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDatabase };