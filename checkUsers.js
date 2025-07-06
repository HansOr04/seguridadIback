const mongoose = require('mongoose');
require('dotenv').config();

const Organization = require('./src/models/Organization');

async function checkOrganization() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar la organización por nombre
    const org = await Organization.findOne({ name: 'Universidad de las Americas' });
    
    if (!org) {
      console.log('❌ Organización no encontrada');
      return;
    }

    console.log('🏢 Organización encontrada:');
    console.log('📋 Datos completos:');
    console.log(JSON.stringify(org, null, 2));
    
    console.log('\n🔍 Campos relevantes para autenticación:');
    console.log(`   _id: ${org._id}`);
    console.log(`   name: ${org.name}`);
    console.log(`   isActive: ${org.isActive}`);
    console.log(`   isDeleted: ${org.isDeleted}`);
    console.log(`   status: ${org.status}`);
    
    console.log('\n🧪 Verificaciones:');
    console.log(`   ¿Tiene isActive? ${org.hasOwnProperty('isActive')}`);
    console.log(`   ¿isActive es true? ${org.isActive === true}`);
    console.log(`   ¿Tiene status? ${org.hasOwnProperty('status')}`);
    console.log(`   ¿status es 'active'? ${org.status === 'active'}`);
    console.log(`   ¿isDeleted es false? ${org.isDeleted === false}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

checkOrganization();