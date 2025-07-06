const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

// Load environment variables from the root directory
require('dotenv').config();

const User = require('../models/User');
const Organization = require('../models/Organization');

const seedData = async () => {
  try {
    console.log('🔍 Checking environment variables...');
    console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI no está definida en las variables de entorno');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📊 Conectado a MongoDB Atlas para seeding');

    // Limpiar datos existentes
    await User.deleteMany({});
    await Organization.deleteMany({});
    console.log('🧹 Datos existentes eliminados');

    // Crear organización de prueba
    const organization = new Organization({
      name: 'Universidad de las Americas',
      legalName: 'Universidad de las Americas',
      ruc: '1234567890123',
      type: 'educativa',
      sector: 'privado',
      size: 'grande',
      contact: {
        address: {
          street: 'Av. Simon Bolivar y Av. Nayon',
          city: 'Quito',
          province: 'Pichincha',
          postalCode: '170901',
          country: 'Ecuador'
        },
        email: 'info@udla.edu.ec',
        phone: '+593 2 297 1700',
        website: 'https://www.udla.edu.ec'
      }
    });

    await organization.save();
    console.log('🏢 Organización creada:', organization.name);

    // FUNCIÓN PARA CREAR USUARIO CON CONTRASEÑA HASHEADA MANUALMENTE
    const createUserWithHashedPassword = async (userData) => {
      // Hash manual de la contraseña
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      
      console.log(`🔐 Hasheando contraseña para ${userData.email}:`, {
        original: userData.password,
        hashedLength: hashedPassword.length,
        saltRounds: saltRounds,
        hashPreview: hashedPassword.substring(0, 20) + '...'
      });

      // Verificar inmediatamente que el hash funciona
      const testVerification = await bcrypt.compare(userData.password, hashedPassword);
      console.log(`🧪 Verificación inmediata del hash: ${testVerification ? '✅ VÁLIDA' : '❌ FALLA'}`);

      // Crear usuario usando directamente MongoDB sin middleware de Mongoose
      const userDoc = {
        email: userData.email,
        password: hashedPassword, // ← Contraseña ya hasheada
        profile: userData.profile,
        role: userData.role,
        organization: organization._id,
        isActive: true,
        security: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          lastActivity: new Date(),
          failedLoginAttempts: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insertar directamente en la colección para evitar middleware
      const result = await User.collection.insertOne(userDoc);
      console.log(`💾 Usuario insertado directamente en BD con ID: ${result.insertedId}`);
      
      // Verificar que se guardó correctamente
      const savedUser = await User.findById(result.insertedId).select('+password');
      console.log(`✅ Usuario verificado - ${userData.email}:`, {
        hasPassword: !!savedUser.password,
        passwordLength: savedUser.password?.length,
        isHashed: savedUser.password?.startsWith('$2b$') || savedUser.password?.startsWith('$2a$'),
        hashMatches: savedUser.password === hashedPassword
      });
      
      // Verificar que la contraseña funciona
      const finalVerification = await bcrypt.compare(userData.password, savedUser.password);
      console.log(`🔐 Verificación final con contraseña guardada: ${finalVerification ? '✅ VÁLIDA' : '❌ FALLA'}`);
      
      return savedUser;
    };

    // Crear usuario administrador
    console.log('👤 Creando usuario admin...');
    const adminUser = await createUserWithHashedPassword({
      email: 'admin@udla.edu.ec',
      password: 'Admin123!',
      profile: {
        firstName: 'Administrador',
        lastName: 'Sistema',
        phone: '+593 2 297 1700',
        position: 'Administrador de Sistema',
        department: 'TI'
      },
      role: 'admin'
    });

    // Crear usuario analista
    console.log('👤 Creando usuario analista...');
    const analystUser = await createUserWithHashedPassword({
      email: 'analista@udla.edu.ec',
      password: 'Analyst123!',
      profile: {
        firstName: 'María',
        lastName: 'González',
        phone: '+593 2 297 1701',
        position: 'Analista de Seguridad',
        department: 'Ciberseguridad'
      },
      role: 'analyst'
    });

    // Crear usuario viewer
    console.log('👤 Creando usuario viewer...');
    const viewerUser = await createUserWithHashedPassword({
      email: 'viewer@udla.edu.ec',
      password: 'Viewer123!',
      profile: {
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '+593 2 297 1702',
        position: 'Consultor',
        department: 'Auditoría'
      },
      role: 'viewer'
    });

    console.log('\n✅ Seeding completado exitosamente!');
    console.log('\n📋 Credenciales de acceso:');
    console.log('Admin: admin@udla.edu.ec / Admin123!');
    console.log('Analista: analista@udla.edu.ec / Analyst123!');
    console.log('Viewer: viewer@udla.edu.ec / Viewer123!');

    // VERIFICACIÓN FINAL
    console.log('\n🔍 Verificación final de usuarios:');
    const users = await User.find({}).select('+password');
    for (const user of users) {
      const isValidPassword = await bcrypt.compare('Admin123!', user.password);
      console.log(`  - ${user.email}: password length = ${user.password?.length}, hashed = ${user.password?.startsWith('$2')}, admin pwd works = ${user.email.includes('admin') ? isValidPassword : 'N/A'}`);
    }

  } catch (error) {
    console.error('❌ Error en seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

seedData();