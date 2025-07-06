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

    // Crear usuario administrador
    const adminUser = new User({
      email: 'admin@udla.edu.ec',
      password: 'Admin123!',
      profile: {
        firstName: 'Administrador',
        lastName: 'Sistema',
        phone: '+593 2 297 1700',
        position: 'Administrador de Sistema',
        department: 'TI'
      },
      role: 'admin',
      organization: organization._id,
      security: {
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    await adminUser.save();
    console.log('👤 Usuario admin creado:', adminUser.email);

    // Crear usuario analista
    const analystUser = new User({
      email: 'analista@udla.edu.ec',
      password: 'Analyst123!',
      profile: {
        firstName: 'María',
        lastName: 'González',
        phone: '+593 2 297 1701',
        position: 'Analista de Seguridad',
        department: 'Ciberseguridad'
      },
      role: 'analyst',
      organization: organization._id,
      security: {
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    await analystUser.save();
    console.log('👤 Usuario analista creado:', analystUser.email);

    // Crear usuario viewer
    const viewerUser = new User({
      email: 'viewer@udla.edu.ec',
      password: 'Viewer123!',
      profile: {
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '+593 2 297 1702',
        position: 'Consultor',
        department: 'Auditoría'
      },
      role: 'viewer',
      organization: organization._id,
      security: {
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    await viewerUser.save();
    console.log('👤 Usuario viewer creado:', viewerUser.email);

    console.log('\n✅ Seeding completado exitosamente!');
    console.log('\n📋 Credenciales de acceso:');
    console.log('Admin: admin@udla.edu.ec / Admin123!');
    console.log('Analista: analista@udla.edu.ec / Analyst123!');
    console.log('Viewer: viewer@udla.edu.ec / Viewer123!');

  } catch (error) {
    console.error('❌ Error en seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
};

seedData();