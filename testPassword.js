const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./src/models/User');

async function testPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar el usuario admin
    const user = await User.findOne({ email: 'admin@udla.edu.ec' }).select('+password');
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    console.log('🔍 Usuario encontrado:');
    console.log('  - Email:', user.email);
    console.log('  - Password hash:', user.password.substring(0, 20) + '...');
    console.log('  - Hash length:', user.password.length);
    console.log('  - Hash starts with:', user.password.substring(0, 4));

    // Probar diferentes contraseñas
    const testPasswords = ['Admin123!', 'admin123!', 'Admin123', 'Admin123!!'];
    
    console.log('\n🔐 Probando contraseñas:');
    
    for (const testPassword of testPasswords) {
      try {
        const isValid = await bcrypt.compare(testPassword, user.password);
        console.log(`  - "${testPassword}": ${isValid ? '✅ VÁLIDA' : '❌ inválida'}`);
      } catch (error) {
        console.log(`  - "${testPassword}": ⚠️  Error: ${error.message}`);
      }
    }

    // Crear un nuevo hash con la contraseña correcta para comparar
    console.log('\n🔧 Probando crear nuevo hash:');
    const newHash = await bcrypt.hash('Admin123!', 12);
    console.log('  - Nuevo hash:', newHash.substring(0, 20) + '...');
    console.log('  - Nuevo hash length:', newHash.length);
    
    const testWithNewHash = await bcrypt.compare('Admin123!', newHash);
    console.log('  - Verificación con nuevo hash:', testWithNewHash ? '✅ VÁLIDA' : '❌ inválida');

    // Comparar los hashes
    console.log('\n📊 Comparación de hashes:');
    console.log('  - Hash en BD  :', user.password.substring(0, 30) + '...');
    console.log('  - Hash nuevo  :', newHash.substring(0, 30) + '...');
    console.log('  - Son iguales :', user.password === newHash);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

testPassword();