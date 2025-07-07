const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Importar modelos
const User = require('../models/User');
const Organization = require('../models/Organization');
const Asset = require('../models/Asset');
const Threat = require('../models/Threat');
const Vulnerability = require('../models/Vulnerability');
const Risk = require('../models/Risk');
const Treatment = require('../models/Treatment');
const Control = require('../models/Control');
const Monitoring = require('../models/Monitoring');
const Report = require('../models/Report');

require('dotenv').config();

// Función principal de sembrado
async function seedDatabase() {
  try {
    console.log('🌱 Iniciando sembrado de base de datos SIGRISK-EC...');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas');

    // Limpiar datos existentes
    console.log('🧹 Limpiando datos existentes...');
    await Promise.all([
      User.deleteMany({}),
      Organization.deleteMany({}),
      Asset.deleteMany({}),
      Threat.deleteMany({}),
      Vulnerability.deleteMany({}),
      Risk.deleteMany({}),
      Treatment.deleteMany({}),
      Control.deleteMany({}),
      Monitoring.deleteMany({}),
      Report.deleteMany({})
    ]);

    // 1. Crear organización UDLA
    console.log('🏛️ Creando Universidad de las Américas UDLA...');
    const udlaOrg = new Organization({
      name: 'Universidad de las Américas UDLA',
      legalName: 'Universidad de las Américas UDLA',
      ruc: '1791256324001',
      type: 'educativa',
      sector: 'privado', 
      size: 'grande',
      contact: {
        address: {
          street: 'Av. de los Granados E12-41 y Colimes',
          city: 'Quito',
          province: 'Pichincha',
          postalCode: '170125',
          country: 'Ecuador'
        },
        phone: '+593-2-398-1000',
        email: 'info@udla.edu.ec',
        website: 'https://www.udla.edu.ec'
      },
      description: 'Universidad privada de excelencia académica con enfoque en innovación tecnológica',
      mageritConfig: {
        riskMatrix: {
          type: '5x5',
          impactScale: [1, 2, 3, 4, 5],
          probabilityScale: [1, 2, 3, 4, 5]
        }
      },
      limits: {
        maxUsers: 150,
        maxAssets: 1200,
        maxReports: 600,
        storageQuota: 107374182400 // 100GB
      },
      subscription: {
        plan: 'professional',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-12-31'),
        isActive: true,
        paymentStatus: 'active'
      }
    });
    await udlaOrg.save();

    // 2. Crear usuarios
    console.log('👥 Creando usuarios del sistema...');
    const users = [];

    // Super Admin
    const superAdmin = new User({
      email: 'carlos.montufar@udla.edu.ec',
      password: await bcrypt.hash('Admin123!', 12),
      name: 'Dr. Carlos Montúfar',
      role: 'super_admin',
      organization: udlaOrg._id,
      profile: {
        firstName: 'Carlos',
        lastName: 'Montúfar',
        phone: '+593-99-123-4567',
        position: 'Director de Tecnología',
        department: 'TI'
      },
      isActive: true,
      isEmailVerified: true
    });
    await superAdmin.save();
    users.push(superAdmin);

    // Admin
    const admin = new User({
      email: 'maria.rodriguez@udla.edu.ec',
      password: await bcrypt.hash('Admin123!', 12),
      name: 'Ing. María Rodríguez',
      role: 'admin',
      organization: udlaOrg._id,
      profile: {
        firstName: 'María',
        lastName: 'Rodríguez',
        phone: '+593-99-234-5678',
        position: 'Jefe de Seguridad de la Información',
        department: 'Seguridad TI'
      },
      isActive: true,
      isEmailVerified: true
    });
    await admin.save();
    users.push(admin);

    // Analista 1
    const analyst1 = new User({
      email: 'juan.perez@udla.edu.ec',
      password: await bcrypt.hash('Analyst123!', 12),
      name: 'Lcdo. Juan Pérez',
      role: 'analyst',
      organization: udlaOrg._id,
      profile: {
        firstName: 'Juan',
        lastName: 'Pérez',
        phone: '+593-99-345-6789',
        position: 'Analista de Riesgos',
        department: 'Seguridad TI'
      },
      isActive: true,
      isEmailVerified: true
    });
    await analyst1.save();
    users.push(analyst1);

    // Analista 2
    const analyst2 = new User({
      email: 'ana.garcia@udla.edu.ec',
      password: await bcrypt.hash('Analyst123!', 12),
      name: 'Ing. Ana García',
      role: 'analyst',
      organization: udlaOrg._id,
      profile: {
        firstName: 'Ana',
        lastName: 'García',
        phone: '+593-99-456-7890',
        position: 'Especialista en Ciberseguridad',
        department: 'Seguridad TI'
      },
      isActive: true,
      isEmailVerified: true
    });
    await analyst2.save();
    users.push(analyst2);

    // Viewer
    const viewer = new User({
      email: 'luis.vega@udla.edu.ec',
      password: await bcrypt.hash('Viewer123!', 12),
      name: 'Tec. Luis Vega',
      role: 'viewer',
      organization: udlaOrg._id,
      profile: {
        firstName: 'Luis',
        lastName: 'Vega',
        phone: '+593-99-567-8901',
        position: 'Técnico de Soporte',
        department: 'TI'
      },
      isActive: true,
      isEmailVerified: true
    });
    await viewer.save();
    users.push(viewer);

    // 3. Crear amenazas con códigos MAGERIT correctos
    console.log('⚠️ Creando amenazas MAGERIT...');
    const threats = [];

    const threatData = [
      {
        mageritCode: 'E.8',
        name: 'Ransomware',
        description: 'Software malicioso que cifra archivos y sistemas exigiendo rescate económico',
        category: 'cyberattacks',
        baseProbability: 0.8,
        probabilityLevel: 'high',
        affectedDimensions: {
          confidentiality: true,
          integrity: true,
          availability: true,
          authenticity: false,
          traceability: true
        },
        susceptibleAssetTypes: ['software', 'data', 'essential_services'],
        impactMultiplier: 2.5,
        organization: udlaOrg._id,
        createdBy: superAdmin._id,
        isStandard: true
      },
      {
        mageritCode: 'E.9',
        name: 'Phishing',
        description: 'Correos fraudulentos para robar credenciales',
        category: 'cyberattacks',
        baseProbability: 0.9,
        probabilityLevel: 'very_high',
        affectedDimensions: {
          confidentiality: true,
          integrity: false,
          availability: false,
          authenticity: true,
          traceability: false
        },
        susceptibleAssetTypes: ['personnel', 'data', 'essential_services'],
        impactMultiplier: 1.8,
        organization: udlaOrg._id,
        createdBy: superAdmin._id,
        isStandard: true
      },
      {
        mageritCode: 'A.1',
        name: 'Falla eléctrica',
        description: 'Interrupción del suministro eléctrico',
        category: 'technical_failures',
        baseProbability: 0.3,
        probabilityLevel: 'medium',
        affectedDimensions: {
          confidentiality: false,
          integrity: false,
          availability: true,
          authenticity: false,
          traceability: false
        },
        susceptibleAssetTypes: ['hardware', 'essential_services', 'installations'],
        impactMultiplier: 1.5,
        organization: udlaOrg._id,
        createdBy: superAdmin._id,
        isStandard: true
      },
      {
        mageritCode: 'E.2',
        name: 'Acceso no autorizado empleado',
        description: 'Empleado accede sin autorización',
        category: 'human_origin',
        baseProbability: 0.4,
        probabilityLevel: 'medium',
        affectedDimensions: {
          confidentiality: true,
          integrity: true,
          availability: false,
          authenticity: true,
          traceability: true
        },
        susceptibleAssetTypes: ['personnel', 'data', 'essential_services'],
        impactMultiplier: 1.6,
        organization: udlaOrg._id,
        createdBy: superAdmin._id,
        isStandard: true
      },
      {
        mageritCode: 'E.10',
        name: 'Ataque DDoS',
        description: 'Denegación de servicio distribuida',
        category: 'cyberattacks',
        baseProbability: 0.5,
        probabilityLevel: 'medium',
        affectedDimensions: {
          confidentiality: false,
          integrity: false,
          availability: true,
          authenticity: false,
          traceability: false
        },
        susceptibleAssetTypes: ['communication_networks', 'essential_services'],
        impactMultiplier: 1.2,
        organization: udlaOrg._id,
        createdBy: superAdmin._id,
        isStandard: true
      }
    ];

    for (const threatInfo of threatData) {
      const threat = new Threat(threatInfo);
      await threat.save();
      threats.push(threat);
    }

    // 4. Crear activos
    console.log('💻 Creando activos de información...');
    const assets = [];

    const assetData = [
      {
        name: 'Sistema BANNER',
        code: 'UDLA-SW-001',
        description: 'Sistema ERP académico de la universidad',
        type: 'SW',
        subtype: 'SW.2',
        economicValue: 850000,
        sectoralFactor: 1.2,
        location: {
          building: 'Data Center UDLA',
          floor: '1',
          room: 'DC-01',
          rack: 'R-15'
        },
        organization: udlaOrg._id,
        owner: {
          userId: superAdmin._id,
          name: `${superAdmin.profile.firstName} ${superAdmin.profile.lastName}`,
          email: superAdmin.email,
          department: 'TI'
        },
        custodian: {
          userId: admin._id,
          name: `${admin.profile.firstName} ${admin.profile.lastName}`,
          email: admin.email,
          department: 'TI'
        },
        valuation: {
          confidentiality: 4,
          integrity: 5,
          availability: 5,
          authenticity: 4,
          traceability: 4
        },
        metadata: {
          vendor: 'Ellucian',
          version: '9.5.2',
          model: 'BANNER ERP',
          tags: ['ERP', 'Académico', 'Crítico']
        },
        createdBy: superAdmin._id,
        status: 'ACTIVE'
      },
      {
        name: 'Base Datos Estudiantes',
        code: 'UDLA-I-001',
        description: 'BD con información académica y personal',
        type: 'I',
        subtype: 'I.2',
        economicValue: 1200000,
        sectoralFactor: 1.5,
        location: {
          building: 'Data Center UDLA',
          floor: '1',
          room: 'DC-01',
          rack: 'R-16'
        },
        organization: udlaOrg._id,
        owner: {
          userId: admin._id,
          name: `${admin.profile.firstName} ${admin.profile.lastName}`,
          email: admin.email,
          department: 'Registro'
        },
        custodian: {
          userId: analyst1._id,
          name: `${analyst1.profile.firstName} ${analyst1.profile.lastName}`,
          email: analyst1.email,
          department: 'TI'
        },
        valuation: {
          confidentiality: 5,
          integrity: 5,
          availability: 5,
          authenticity: 5,
          traceability: 5
        },
        metadata: {
          vendor: 'Oracle',
          version: '19c Enterprise',
          model: 'Oracle Database',
          tags: ['LOPD', 'Confidencial', 'Crítico']
        },
        createdBy: superAdmin._id,
        status: 'ACTIVE'
      },
      {
        name: 'Portal Web UDLA',
        code: 'UDLA-S-001',
        description: 'Sitio web oficial institucional',
        type: 'S',
        subtype: 'S.3',
        economicValue: 45000,
        sectoralFactor: 0.8,
        location: {
          building: 'AWS Cloud',
          floor: 'Virtual',
          room: 'us-east-1'
        },
        organization: udlaOrg._id,
        owner: {
          userId: admin._id,
          name: `${admin.profile.firstName} ${admin.profile.lastName}`,
          email: admin.email,
          department: 'Comunicación'
        },
        custodian: {
          userId: analyst2._id,
          name: `${analyst2.profile.firstName} ${analyst2.profile.lastName}`,
          email: analyst2.email,
          department: 'TI'
        },
        valuation: {
          confidentiality: 1,
          integrity: 3,
          availability: 4,
          authenticity: 3,
          traceability: 2
        },
        metadata: {
          vendor: 'AWS',
          version: 'WordPress 6.4',
          model: 'Web Application',
          tags: ['Público', 'WordPress', 'AWS']
        },
        createdBy: superAdmin._id,
        status: 'ACTIVE'
      },
      {
        name: 'Servidor Exchange',
        code: 'UDLA-HW-001',
        description: 'Servidor de correo institucional',
        type: 'HW',
        subtype: 'HW.1',
        economicValue: 75000,
        sectoralFactor: 1.0,
        location: {
          building: 'Data Center UDLA',
          floor: '1',
          room: 'DC-01',
          rack: 'R-12'
        },
        organization: udlaOrg._id,
        owner: {
          userId: superAdmin._id,
          name: `${superAdmin.profile.firstName} ${superAdmin.profile.lastName}`,
          email: superAdmin.email,
          department: 'TI'
        },
        custodian: {
          userId: admin._id,
          name: `${admin.profile.firstName} ${admin.profile.lastName}`,
          email: admin.email,
          department: 'TI'
        },
        valuation: {
          confidentiality: 3,
          integrity: 4,
          availability: 5,
          authenticity: 4,
          traceability: 3
        },
        metadata: {
          vendor: 'Dell',
          version: 'Exchange Server 2019',
          model: 'PowerEdge R750',
          tags: ['Email', 'Exchange', 'Dell']
        },
        createdBy: superAdmin._id,
        status: 'ACTIVE'
      },
      {
        name: 'Red WiFi Campus',
        code: 'UDLA-COM-001',
        description: 'Infraestructura inalámbrica campus',
        type: 'COM',
        subtype: 'COM.3',
        economicValue: 120000,
        sectoralFactor: 1.1,
        location: {
          building: 'Campus UDLA',
          floor: 'Todos',
          room: 'Edificios'
        },
        organization: udlaOrg._id,
        owner: {
          userId: superAdmin._id,
          name: `${superAdmin.profile.firstName} ${superAdmin.profile.lastName}`,
          email: superAdmin.email,
          department: 'TI'
        },
        custodian: {
          userId: analyst1._id,
          name: `${analyst1.profile.firstName} ${analyst1.profile.lastName}`,
          email: analyst1.email,
          department: 'TI'
        },
        valuation: {
          confidentiality: 2,
          integrity: 3,
          availability: 5,
          authenticity: 3,
          traceability: 2
        },
        metadata: {
          vendor: 'Cisco',
          version: 'Meraki MR46',
          model: 'Cisco Meraki',
          tags: ['WiFi', 'Cisco', 'Campus']
        },
        createdBy: superAdmin._id,
        status: 'ACTIVE'
      },
      {
        name: 'Sistema CCTV',
        code: 'UDLA-AUX-001',
        description: 'Sistema videovigilancia campus',
        type: 'AUX',
        subtype: 'AUX.3',
        economicValue: 95000,
        sectoralFactor: 0.9,
        location: {
          building: 'Campus UDLA',
          floor: 'Todos',
          room: 'Puntos estratégicos'
        },
        organization: udlaOrg._id,
        owner: {
          userId: admin._id,
          name: `${admin.profile.firstName} ${admin.profile.lastName}`,
          email: admin.email,
          department: 'Seguridad'
        },
        custodian: {
          userId: viewer._id,
          name: `${viewer.profile.firstName} ${viewer.profile.lastName}`,
          email: viewer.email,
          department: 'Seguridad'
        },
        valuation: {
          confidentiality: 4,
          integrity: 3,
          availability: 3,
          authenticity: 2,
          traceability: 4
        },
        metadata: {
          vendor: 'Hikvision',
          version: 'DS-2CD2385G1-I',
          model: 'IP Camera 4K',
          tags: ['CCTV', 'Hikvision', 'Seguridad']
        },
        createdBy: superAdmin._id,
        status: 'ACTIVE'
      }
    ];

    for (const assetInfo of assetData) {
      const asset = new Asset(assetInfo);
      await asset.save();
      assets.push(asset);
    }

    // 5. Crear vulnerabilidades
    console.log('🔍 Creando vulnerabilidades...');
    const vulnerabilities = [];

    const vulnData = [
      {
        name: 'SQL Injection en BANNER',
        description: 'Vulnerabilidad de inyección SQL en módulo consultas',
        type: 'technical',
        category: 'software_vulnerabilities',
        vulnerabilityLevel: 0.85,
        severityLevel: 'high',
        asset: assets[0]._id,
        affectedDimensions: {
          confidentiality: { impact: 0.9 },
          integrity: { impact: 0.8 },
          availability: { impact: 0.1 },
          authenticity: { impact: 0.6 },
          traceability: { impact: 0.3 }
        },
        technicalAssessment: {
          discoveryMethod: 'automated_scan',
          discoveryDate: new Date('2024-01-15'),
          verificationStatus: 'verified',
          exploitComplexity: 'low',
          accessRequired: 'user'
        },
        cveDetails: {
          cveId: 'CVE-2024-1234',
          cvssV3Score: 8.5,
          cvssV3Vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
          cweId: 'CWE-89'
        },
        remediation: {
          status: 'in_progress',
          priority: 'critical',
          assignedTo: analyst1._id,
          dueDate: new Date('2024-04-15'),
          estimatedEffort: 40,
          estimatedCost: 15000,
          remediationNotes: 'Actualización crítica del sistema BANNER requerida'
        },
        temporalMetrics: {
          exploitCodeMaturity: 'functional',
          remediationLevel: 'temporary_fix',
          reportConfidence: 'confirmed'
        },
        environmentalMetrics: {
          businessImpact: 0.9,
          exposureLevel: 'internal',
          dataClassification: 'confidential'
        },
        organization: udlaOrg._id,
        discoveredBy: analyst1._id,
        createdBy: analyst1._id
      },
      {
        name: 'Contraseñas débiles administrativas',
        description: 'Políticas insuficientes de contraseñas para admins',
        type: 'organizational',
        category: 'policy_gaps',
        vulnerabilityLevel: 0.62,
        severityLevel: 'medium',
        asset: assets[1]._id,
        affectedDimensions: {
          confidentiality: { impact: 0.7 },
          integrity: { impact: 0.5 },
          availability: { impact: 0.3 },
          authenticity: { impact: 0.8 },
          traceability: { impact: 0.4 }
        },
        technicalAssessment: {
          discoveryMethod: 'manual_review',
          discoveryDate: new Date('2024-02-01'),
          verificationStatus: 'verified',
          exploitComplexity: 'medium',
          accessRequired: 'none'
        },
        remediation: {
          status: 'open',
          priority: 'high',
          assignedTo: analyst2._id,
          dueDate: new Date('2024-03-30'),
          estimatedEffort: 20,
          estimatedCost: 5000,
          remediationNotes: 'Implementar política de contraseñas robustas y MFA'
        },
        temporalMetrics: {
          exploitCodeMaturity: 'high',
          remediationLevel: 'official_fix',
          reportConfidence: 'confirmed'
        },
        environmentalMetrics: {
          businessImpact: 0.7,
          exposureLevel: 'internal',
          dataClassification: 'internal'
        },
        organization: udlaOrg._id,
        discoveredBy: analyst2._id,
        createdBy: analyst2._id
      },
      {
        name: 'Falta cifrado comunicaciones internas',
        description: 'Protocolos sin cifrado entre servidores',
        type: 'technical',
        category: 'network_vulnerabilities',
        vulnerabilityLevel: 0.58,
        severityLevel: 'medium',
        asset: assets[4]._id, // Red WiFi
        affectedDimensions: {
          confidentiality: { impact: 0.8 },
          integrity: { impact: 0.4 },
          availability: { impact: 0.1 },
          authenticity: { impact: 0.3 },
          traceability: { impact: 0.2 }
        },
        technicalAssessment: {
          discoveryMethod: 'audit',
          discoveryDate: new Date('2024-01-20'),
          verificationStatus: 'verified',
          exploitComplexity: 'high',
          accessRequired: 'admin'
        },
        remediation: {
          status: 'open',
          priority: 'medium',
          assignedTo: analyst1._id,
          dueDate: new Date('2024-05-01'),
          estimatedEffort: 30,
          estimatedCost: 8000,
          remediationNotes: 'Implementar TLS/SSL en todas las comunicaciones internas'
        },
        temporalMetrics: {
          exploitCodeMaturity: 'proof_of_concept',
          remediationLevel: 'workaround',
          reportConfidence: 'reasonable'
        },
        environmentalMetrics: {
          businessImpact: 0.5,
          exposureLevel: 'internal',
          dataClassification: 'internal'
        },
        organization: udlaOrg._id,
        discoveredBy: analyst1._id,
        createdBy: analyst1._id
      }
    ];

    for (const vulnInfo of vulnData) {
      const vulnerability = new Vulnerability(vulnInfo);
      await vulnerability.save();
      vulnerabilities.push(vulnerability);
    }

    // 6. Crear riesgos
    console.log('📊 Creando riesgos calculados...');
    const risks = [];

    const riskData = [
      {
        riskId: `UDLA-${assets[0]._id.toString().slice(-6)}-${threats[0]._id.toString().slice(-6)}-001`,
        name: 'Compromiso BANNER por Ransomware',
        description: 'Riesgo de cifrado del sistema académico por ransomware',
        organization: udlaOrg._id,
        asset: assets[0]._id,
        threat: threats[0]._id,
        vulnerability: vulnerabilities[0]._id,
        calculation: {
          threatProbability: 0.8,
          vulnerabilityLevel: 0.85,
          impact: {
            confidentiality: 0.9,
            integrity: 0.8,
            availability: 0.95,
            authenticity: 0.7,
            traceability: 0.6
          },
          aggregatedImpact: 0.82, // Promedio ponderado de impactos
          temporalFactor: 1.2,
          environmentalFactor: 1.1,
          baseRisk: 0.68,
          adjustedRisk: 0.72,
          economicImpact: {
            potentialLoss: 850000,
            expectedLoss: 680000,
            annualizedLoss: 612000
          }
        },
        classification: {
          riskLevel: 'critical',
          riskCategory: 'technical',
          businessFunction: 'core_business'
        },
        riskMatrix: {
          probabilityLevel: 4,
          impactLevel: 5,
          matrixPosition: '45',
          riskScore: 20
        },
        treatment: {
          strategy: 'mitigate',
          status: 'identified',
          priority: 'critical',
          targetDate: new Date('2024-06-30'),
          appliedControls: [],
          notes: 'Requiere implementación urgente de controles anti-ransomware'
        },
        monitoring: {
          assignedTo: admin._id,
          nextReviewDate: new Date('2024-04-01'),
          reviewFrequency: 'monthly',
          lastAssessment: new Date()
        },
        scenarios: [
          {
            name: 'Compromiso total del sistema',
            description: 'Cifrado completo de la base de datos BANNER',
            probability: 0.8,
            impact: 0.95,
            potentialLoss: 850000,
            likelihood: 'likely'
          }
        ],
        createdBy: analyst1._id
      },
      {
        riskId: `UDLA-${assets[1]._id.toString().slice(-6)}-${threats[1]._id.toString().slice(-6)}-002`,
        name: 'Filtración datos estudiantes por phishing',
        description: 'Acceso no autorizado a BD por credenciales comprometidas',
        organization: udlaOrg._id,
        asset: assets[1]._id,
        threat: threats[1]._id,
        vulnerability: vulnerabilities[1]._id,
        calculation: {
          threatProbability: 0.9,
          vulnerabilityLevel: 0.62,
          impact: {
            confidentiality: 0.95,
            integrity: 0.7,
            availability: 0.3,
            authenticity: 0.8,
            traceability: 0.9
          },
          aggregatedImpact: 0.73, // Promedio ponderado de impactos
          temporalFactor: 1.1,
          environmentalFactor: 1.0,
          baseRisk: 0.63,
          adjustedRisk: 0.68,
          economicImpact: {
            potentialLoss: 400000,
            expectedLoss: 240000,
            annualizedLoss: 216000
          }
        },
        classification: {
          riskLevel: 'high',
          riskCategory: 'compliance',
          businessFunction: 'core_business'
        },
        riskMatrix: {
          probabilityLevel: 4,
          impactLevel: 4,
          matrixPosition: '44',
          riskScore: 16
        },
        treatment: {
          strategy: 'mitigate',
          status: 'treatment_planned',
          priority: 'high',
          targetDate: new Date('2024-05-15'),
          appliedControls: [],
          notes: 'Implementar programa de concienciación y MFA'
        },
        monitoring: {
          assignedTo: admin._id,
          nextReviewDate: new Date('2024-03-15'),
          reviewFrequency: 'monthly',
          lastAssessment: new Date()
        },
        scenarios: [
          {
            name: 'Filtración masiva de datos',
            description: 'Exposición de datos personales de estudiantes',
            probability: 0.7,
            impact: 0.8,
            potentialLoss: 400000,
            likelihood: 'possible'
          }
        ],
        createdBy: analyst2._id
      },
      {
        riskId: `UDLA-${assets[2]._id.toString().slice(-6)}-${threats[4]._id.toString().slice(-6)}-003`,
        name: 'Interrupción portal web por DDoS',
        description: 'Indisponibilidad sitio web por ataque denegación servicio',
        organization: udlaOrg._id,
        asset: assets[2]._id,
        threat: threats[4]._id,
        vulnerability: vulnerabilities[2]._id,
        calculation: {
          threatProbability: 0.5,
          vulnerabilityLevel: 0.58,
          impact: {
            confidentiality: 0.1,
            integrity: 0.2,
            availability: 0.9,
            authenticity: 0.3,
            traceability: 0.1
          },
          aggregatedImpact: 0.32, // Promedio ponderado de impactos
          temporalFactor: 1.0,
          environmentalFactor: 0.9,
          baseRisk: 0.29,
          adjustedRisk: 0.32,
          economicImpact: {
            potentialLoss: 25000,
            expectedLoss: 15000,
            annualizedLoss: 13500
          }
        },
        classification: {
          riskLevel: 'medium',
          riskCategory: 'operational',
          businessFunction: 'support'
        },
        riskMatrix: {
          probabilityLevel: 3,
          impactLevel: 3,
          matrixPosition: '33',
          riskScore: 9
        },
        treatment: {
          strategy: 'mitigate',
          status: 'monitored',
          priority: 'medium',
          targetDate: new Date('2024-03-01'),
          appliedControls: [],
          notes: 'Firewall anti-DDoS implementado'
        },
        monitoring: {
          assignedTo: analyst1._id,
          nextReviewDate: new Date('2024-06-01'),
          reviewFrequency: 'quarterly',
          lastAssessment: new Date()
        },
        scenarios: [
          {
            name: 'Interrupción temporal del servicio',
            description: 'Portal web inaccesible por 2-4 horas',
            probability: 0.5,
            impact: 0.4,
            potentialLoss: 25000,
            likelihood: 'possible'
          }
        ],
        createdBy: analyst1._id
      }
    ];

    for (const riskInfo of riskData) {
      const risk = new Risk(riskInfo);
      await risk.save();
      risks.push(risk);
    }

    // 7. Crear controles
    console.log('🛡️ Creando controles ISO 27002...');
    const controls = [];

    const controlData = [
      {
        name: 'Backup automatizado BANNER',
        description: 'Respaldo diario automatizado del sistema académico',
        organization: udlaOrg._id,
        category: 'operations_security',
        type: 'preventive',
        iso27002Reference: 'A.12.3.1',
        controlObjective: 'Asegurar disponibilidad de información crítica',
        implementation: 'Backup diario a las 2 AM con retención 30 días',
        guidance: 'Verificar integridad semanalmente',
        maturityLevel: 4,
        implementationCost: 15000,
        maintenanceCost: 3000,
        effectiveness: 85,
        status: 'implemented',
        assets: [assets[0]._id, assets[1]._id],
        threats: [threats[0]._id],
        responsible: admin._id,
        owner: superAdmin._id,
        implementationDate: new Date('2023-06-01'),
        reviewDate: new Date('2024-12-01')
      },
      {
        name: 'Autenticación multifactor admins',
        description: 'MFA obligatorio para cuentas administrativas',
        organization: udlaOrg._id,
        category: 'access_control',
        type: 'preventive',
        iso27002Reference: 'A.9.4.2',
        controlObjective: 'Fortalecer autenticación usuarios privilegiados',
        implementation: 'Microsoft Authenticator + SMS respaldo',
        guidance: 'Revisar logs autenticación mensualmente',
        maturityLevel: 3,
        implementationCost: 8000,
        maintenanceCost: 1200,
        effectiveness: 90,
        status: 'implemented',
        threats: [threats[1]._id, threats[3]._id],
        responsible: admin._id,
        owner: superAdmin._id,
        implementationDate: new Date('2023-09-01'),
        reviewDate: new Date('2024-09-01')
      },
      {
        name: 'Firewall perimetral con IPS',
        description: 'Firewall con sistema prevención intrusos',
        organization: udlaOrg._id,
        category: 'network_security',
        type: 'preventive',
        iso27002Reference: 'A.13.1.1',
        controlObjective: 'Proteger red de ataques externos',
        implementation: 'FortiGate 600E con IPS habilitado',
        guidance: 'Actualizar reglas seguridad mensualmente',
        maturityLevel: 4,
        implementationCost: 25000,
        maintenanceCost: 5000,
        effectiveness: 80,
        status: 'implemented',
        assets: [assets[4]._id], // Red WiFi
        threats: [threats[4]._id], // DDoS
        responsible: analyst1._id,
        owner: superAdmin._id,
        implementationDate: new Date('2023-03-01'),
        reviewDate: new Date('2024-03-01')
      }
    ];

    for (const controlInfo of controlData) {
      const control = new Control(controlInfo);
      await control.save();
      controls.push(control);
    }

    // 8. Crear tratamientos
    console.log('📋 Creando tratamientos de riesgos...');
    const treatments = [];

    const treatmentData = [
      {
        name: 'Mitigación ransomware BANNER',
        description: 'Plan integral protección contra ransomware',
        organization: udlaOrg._id,
        riskId: risks[0]._id,
        assetId: assets[0]._id,
        type: 'mitigate',
        priority: 'critical',
        status: 'in_progress',
        controls: [controls[0]._id, controls[1]._id],
        implementationCost: 45000,
        maintenanceCost: 12000,
        expectedBenefit: 680000,
        riskReduction: 40,
        implementationDate: new Date('2024-02-01'),
        responsible: admin._id,
        approvedBy: superAdmin._id,
        approvedDate: new Date('2024-01-15'),
        notes: 'Incluye capacitación personal y actualización sistemas'
      },
      {
        name: 'Programa concienciación phishing',
        description: 'Capacitación continua prevenir phishing',
        organization: udlaOrg._id,
        riskId: risks[1]._id,
        assetId: assets[1]._id,
        type: 'mitigate',
        priority: 'high',
        status: 'planned',
        implementationCost: 12000,
        maintenanceCost: 3000,
        expectedBenefit: 180000,
        riskReduction: 25,
        implementationDate: new Date('2024-03-01'),
        responsible: analyst2._id,
        notes: 'Incluye simulacros phishing trimestrales'
      }
    ];

    for (const treatmentInfo of treatmentData) {
      const treatment = new Treatment(treatmentInfo);
      await treatment.save();
      treatments.push(treatment);
    }

    // 9. Crear monitoreos
    console.log('📈 Creando monitoreos automatizados...');
    const monitorings = [];

    const monitoringData = [
      {
        name: 'Monitoreo vulnerabilidades críticas',
        description: 'Escaneo automático vulnerabilidades sistemas críticos',
        organization: udlaOrg._id,
        type: 'vulnerability_scan',
        frequency: 'weekly',
        status: 'active',
        assets: [assets[0]._id, assets[1]._id],
        responsible: analyst1._id,
        notifications: {
          enabled: true,
          recipients: [superAdmin._id, admin._id],
          threshold: 70
        }
      },
      {
        name: 'Evaluación mensual controles',
        description: 'Verificación efectividad controles implementados',
        organization: udlaOrg._id,
        type: 'control_testing',
        frequency: 'monthly',
        status: 'active',
        controls: controls.map(c => c._id),
        responsible: admin._id,
        notifications: {
          enabled: true,
          recipients: [superAdmin._id],
          threshold: 80
        }
      }
    ];

    for (const monitoringInfo of monitoringData) {
      const monitoring = new Monitoring(monitoringInfo);
      await monitoring.scheduleNext();
      
      // Agregar algunos resultados históricos
      for (let i = 0; i < 3; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 7));
        const score = Math.floor(Math.random() * 30) + 70;
        const status = score >= 85 ? 'success' : score >= 70 ? 'warning' : 'error';
        
        await monitoring.addResult(
          status,
          score,
          `Ejecución automática ${monitoring.type}. Puntuación: ${score}%`,
          { 
            executionType: 'automatic',
            itemsScanned: Math.floor(Math.random() * 50) + 10,
            issuesFound: Math.floor(Math.random() * 5)
          },
          Math.floor(Math.random() * 30000) + 5000
        );
      }
      
      monitorings.push(monitoring);
    }

    // 10. Crear reportes
    console.log('📄 Creando reportes ejecutivos...');
    const reports = [];

    const reportData = [
      {
        name: 'Reporte Ejecutivo Q1 2024',
        description: 'Resumen ejecutivo estado riesgos primer trimestre',
        organization: udlaOrg._id,
        type: 'executive_summary',
        format: 'pdf',
        status: 'completed',
        generatedBy: superAdmin._id,
        generatedDate: new Date('2024-01-31'),
        recipients: [superAdmin._id, admin._id],
        parameters: {
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31')
          },
          includeAssets: true,
          includeRisks: true,
          includeControls: true,
          includeTreatments: true,
          riskLevelFilter: ['medium', 'high', 'very_high']
        },
        content: {
          executiveSummary: `Este reporte presenta análisis completo del estado seguridad información UDLA. 
          Se han identificado ${assets.length} activos, ${risks.length} riesgos (${risks.filter(r => r.riskMatrix.riskLevel === 'very_high').length} nivel alto),
          y ${controls.length} controles implementados. Nivel madurez actual es 78%.`,
          sections: [
            {
              title: 'Resumen de Activos',
              content: {
                total: assets.length,
                porTipo: assets.reduce((acc, asset) => {
                  acc[asset.type] = (acc[asset.type] || 0) + 1;
                  return acc;
                }, {}),
                valorTotal: assets.reduce((sum, asset) => sum + asset.economicValue, 0)
              },
              order: 1
            },
            {
              title: 'Análisis de Riesgos',
              content: {
                total: risks.length,
                porNivel: risks.reduce((acc, risk) => {
                  acc[risk.riskMatrix.riskLevel] = (acc[risk.riskMatrix.riskLevel] || 0) + 1;
                  return acc;
                }, {}),
                perdidaEsperadaTotal: risks.reduce((sum, risk) => sum + risk.calculation.economicImpact.expectedLoss, 0)
              },
              order: 2
            }
          ]
        },
        fileInfo: {
          filename: 'reporte_ejecutivo_q1_2024.pdf',
          fileSize: 2548576,
          downloadCount: 5
        },
        metadata: {
          totalAssets: assets.length,
          totalRisks: risks.length,
          totalControls: controls.length,
          averageRiskLevel: 3.2,
          generationTime: 15000
        }
      },
      {
        name: 'Reporte Técnico Cumplimiento ISO 27001',
        description: 'Evaluación detallada cumplimiento ISO 27001',
        organization: udlaOrg._id,
        type: 'compliance',
        format: 'excel',
        status: 'scheduled',
        generatedBy: admin._id,
        frequency: 'quarterly',
        scheduledDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        recipients: [superAdmin._id, admin._id, analyst1._id],
        parameters: {
          includeAssets: true,
          includeRisks: true,
          includeControls: true,
          includeTreatments: true,
          riskLevelFilter: ['low', 'medium', 'high', 'very_high']
        },
        template: {
          name: 'iso27001_compliance',
          customization: {
            includeMaturityAssessment: true,
            includeGapAnalysis: true,
            includeRecommendations: true
          }
        }
      }
    ];

    for (const reportInfo of reportData) {
      const report = new Report(reportInfo);
      await report.save();
      reports.push(report);
    }

    // Agregar resultados prueba a controles
    console.log('🧪 Agregando resultados prueba controles...');
    for (const control of controls) {
      for (let i = 0; i < 3; i++) {
        const score = Math.floor(Math.random() * 20) + 80;
        const result = score >= 90 ? 'passed' : score >= 75 ? 'partial' : 'failed';
        
        await control.addTestResult(
          result,
          score,
          `Prueba ${i + 1}: ${result === 'passed' ? 'Exitosa' : result === 'partial' ? 'Parcial' : 'Fallida'}`,
          analyst1._id
        );
      }
    }

    // Mostrar resumen final
    console.log('\n✅ Sembrado completado exitosamente para UDLA!');
    console.log('\n📊 Resumen de datos creados:');
    console.log(`   🏛️  Organización: ${udlaOrg.name}`);
    console.log(`   👥 Usuarios: ${users.length}`);
    console.log(`   💻 Activos: ${assets.length}`);
    console.log(`   ⚠️  Amenazas: ${threats.length}`);
    console.log(`   🔍 Vulnerabilidades: ${vulnerabilities.length}`);
    console.log(`   📊 Riesgos: ${risks.length}`);
    console.log(`   🛡️  Controles: ${controls.length}`);
    console.log(`   📋 Tratamientos: ${treatments.length}`);
    console.log(`   📈 Monitoreos: ${monitorings.length}`);
    console.log(`   📄 Reportes: ${reports.length}`);

    console.log('\n🔑 Credenciales de acceso:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 SUPER ADMIN:');
    console.log('   📧 carlos.montufar@udla.edu.ec');
    console.log('   🔐 Admin123!');
    console.log('   👤 Dr. Carlos Montúfar - Director de Tecnología');
    console.log('\n🔧 ADMIN:');
    console.log('   📧 maria.rodriguez@udla.edu.ec');
    console.log('   🔐 Admin123!');
    console.log('   👤 Ing. María Rodríguez - Jefe Seguridad TI');
    console.log('\n📊 ANALISTAS:');
    console.log('   📧 juan.perez@udla.edu.ec');
    console.log('   🔐 Analyst123!');
    console.log('   👤 Lcdo. Juan Pérez - Analista de Riesgos');
    console.log('\n   📧 ana.garcia@udla.edu.ec');
    console.log('   🔐 Analyst123!');
    console.log('   👤 Ing. Ana García - Especialista Ciberseguridad');
    console.log('\n👁️  VIEWER:');
    console.log('   📧 luis.vega@udla.edu.ec');
    console.log('   🔐 Viewer123!');
    console.log('   👤 Tec. Luis Vega - Técnico de Soporte');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n🏫 Universidad de las Américas UDLA');
    console.log('   🆔 RUC: 1791256324001');
    console.log('   📍 Av. de los Granados E12-41 y Colimes, Quito');
    console.log('   📞 +593-2-398-1000');
    console.log('   🌐 https://www.udla.edu.ec');

    console.log('\n📋 Datos de prueba incluidos:');
    console.log('   ✅ Sistema BANNER ($850,000) - Criticidad Alta');
    console.log('   ✅ Base Datos Estudiantes ($1,200,000) - Información Personal');
    console.log('   ✅ Portal Web UDLA ($45,000) - Servicios Públicos');
    console.log('   ✅ Servidor Exchange ($75,000) - Comunicaciones');
    console.log('   ✅ Red WiFi Campus ($120,000) - Infraestructura');
    console.log('   ✅ Sistema CCTV ($95,000) - Seguridad Física');
    console.log('   ✅ Amenazas MAGERIT: Ransomware (E.8), Phishing (E.9), DDoS (E.10)');
    console.log('   ✅ Vulnerabilidades con CVE: SQL Injection, Contraseñas débiles');
    console.log('   ✅ Riesgos cuantitativos calculados con metodología MAGERIT');
    console.log('   ✅ Controles ISO 27002: Backup, MFA, Firewall');
    console.log('   ✅ Tratamientos con análisis costo-beneficio ROI');
    console.log('   ✅ Monitoreos automatizados: Vulnerabilidades + Controles');
    console.log('   ✅ Reportes: Ejecutivo Q1 + Cumplimiento ISO 27001');

    console.log('\n🚀 ¡Sistema listo para usar!');
    console.log('   💻 Backend: http://localhost:5000');
    console.log('   🏥 Health: http://localhost:5000/health');
    console.log('   📚 API Docs: http://localhost:5000/api/docs');

  } catch (error) {
    console.error('❌ Error durante el sembrado:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Función para limpiar la base de datos
async function clearDatabase() {
  try {
    console.log('🧹 Limpiando base de datos...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    
    await Promise.all([
      User.deleteMany({}),
      Organization.deleteMany({}),
      Asset.deleteMany({}),
      Threat.deleteMany({}),
      Vulnerability.deleteMany({}),
      Risk.deleteMany({}),
      Treatment.deleteMany({}),
      Control.deleteMany({}),
      Monitoring.deleteMany({}),
      Report.deleteMany({})
    ]);
    
    console.log('✅ Base de datos limpiada exitosamente');
  } catch (error) {
    console.error('❌ Error al limpiar base de datos:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'clear') {
    clearDatabase();
  } else {
    seedDatabase();
  }
}

module.exports = {
  seedDatabase,
  clearDatabase
};