// Guarda esto como debug-env.js en la raíz y ejecuta: node debug-env.js

const fs = require('fs');
const path = require('path');

console.log('🔍 Debugging environment variables...\n');

// 1. Verificar que el archivo .env existe
const envPath = path.join(__dirname, '.env');
console.log('📍 Ruta del archivo .env:', envPath);
console.log('📁 ¿Archivo .env existe?:', fs.existsSync(envPath));

if (!fs.existsSync(envPath)) {
  console.log('❌ El archivo .env NO existe en la ruta esperada');
  process.exit(1);
}

// 2. Leer el contenido del archivo .env
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('\n📄 Contenido del archivo .env:');
  console.log('─'.repeat(50));
  console.log(envContent);
  console.log('─'.repeat(50));
  
  // 3. Verificar líneas no vacías
  const lines = envContent.split('\n').filter(line => line.trim() !== '');
  console.log(`\n📊 Total de líneas no vacías: ${lines.length}`);
  
  // 4. Verificar líneas que parecen variables
  const varLines = lines.filter(line => line.includes('=') && !line.trim().startsWith('#'));
  console.log(`📊 Líneas que parecen variables: ${varLines.length}`);
  
  varLines.forEach((line, index) => {
    console.log(`   ${index + 1}. ${line.substring(0, 50)}${line.length > 50 ? '...' : ''}`);
  });
  
} catch (error) {
  console.log('❌ Error leyendo archivo .env:', error.message);
  process.exit(1);
}

// 5. Intentar cargar dotenv y verificar
console.log('\n🔧 Intentando cargar dotenv...');
require('dotenv').config();

console.log('\n🔍 Variables de entorno después de cargar dotenv:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.log('PORT:', process.env.PORT || 'undefined');
console.log('MONGODB_URI existe:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI (primeros 20 chars):', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'undefined');

// 6. Verificar todas las variables que empiecen con ciertos prefijos
console.log('\n🔍 Todas las variables de entorno del proyecto:');
Object.keys(process.env)
  .filter(key => key.startsWith('MONGODB') || key.startsWith('JWT') || key.startsWith('NODE') || key.startsWith('PORT'))
  .forEach(key => {
    const value = process.env[key];
    const displayValue = value && value.length > 30 ? value.substring(0, 30) + '...' : value;
    console.log(`   ${key}: ${displayValue}`);
  });

console.log('\n✅ Debug completado');