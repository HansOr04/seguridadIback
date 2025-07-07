const mongoose = require('mongoose');

const threatSchema = new mongoose.Schema({
  // Identificación MAGERIT
  mageritCode: {
    type: String,
    required: true,
    unique: true,
    // Códigos MAGERIT: A.1, A.2, E.1, etc.
    match: /^[A-E]\.\d{1,2}(\.\d{1,2})?$/
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'natural_disasters',      // A. Desastres naturales
      'human_origin',          // B. Origen humano
      'technical_failures',    // C. Fallos técnicos
      'cyberattacks',         // D. Ciberataques
      'organizational'        // E. Organizacionales
    ]
  },
  
  // Probabilidad base MAGERIT (0-1)
  baseProbability: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    // Escala MAGERIT: 0.1 (muy baja) a 1.0 (muy alta)
  },
  
  // Nivel de probabilidad cualitativo
  probabilityLevel: {
    type: String,
    required: true,
    enum: ['very_low', 'low', 'medium', 'high', 'very_high']
  },
  
  // Dimensiones de seguridad afectadas
  affectedDimensions: {
    confidentiality: {
      type: Boolean,
      default: false
    },
    integrity: {
      type: Boolean,
      default: false
    },
    availability: {
      type: Boolean,
      default: false
    },
    authenticity: {
      type: Boolean,
      default: false
    },
    traceability: {
      type: Boolean,
      default: false
    }
  },
  
  // Tipos de activos susceptibles
  susceptibleAssetTypes: [{
    type: String,
    enum: [
      'essential_services',
      'data',
      'key_data', 
      'software',
      'hardware',
      'communication_networks',
      'support_equipment',
      'installations',
      'personnel'
    ]
  }],
  
  // Métrica cuantitativa adicional
  impactMultiplier: {
    type: Number,
    default: 1.0,
    min: 0.1,
    max: 3.0
    // Factor que multiplica el impacto base
  },
  
  // Factor temporal (estacional, etc.)
  temporalFactor: {
    hasSeasonality: {
      type: Boolean,
      default: false
    },
    peakMonths: [{
      type: Number,
      min: 1,
      max: 12
    }],
    seasonalMultiplier: {
      type: Number,
      default: 1.0,
      min: 0.5,
      max: 2.0
    }
  },
  
  // Factor geográfico (específico para Ecuador)
  geographicFactor: {
    ecuadorRelevance: {
      type: String,
      enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
      default: 'medium'
    },
    coastalMultiplier: {
      type: Number,
      default: 1.0
    },
    sierraMultiplier: {
      type: Number,
      default: 1.0
    },
    amazonMultiplier: {
      type: Number,
      default: 1.0
    }
  },
  
  // Integración CVE (para amenazas técnicas)
  cveIntegration: {
    enabled: {
      type: Boolean,
      default: false
    },
    cvePatterns: [{
      type: String,
      // Patrones para correlacionar con CVE
    }],
    lastCveSync: {
      type: Date
    },
    relatedCves: [{
      cveId: String,
      cvssScore: Number,
      dateFound: Date
    }]
  },
  
  // Metadatos organizacionales
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  isStandard: {
    type: Boolean,
    default: true,
    // true = amenaza estándar MAGERIT, false = personalizada
  },
  customization: {
    originalThreatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Threat'
    },
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Control de versiones
  version: {
    type: String,
    default: '1.0'
  },
  status: {
    type: String,
    enum: ['active', 'deprecated', 'under_review'],
    default: 'active'
  },
  
  // Auditoria
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimización
threatSchema.index({ mageritCode: 1 });
threatSchema.index({ organization: 1, category: 1 });
threatSchema.index({ organization: 1, isStandard: 1 });
threatSchema.index({ 'cveIntegration.enabled': 1, organization: 1 });

// Virtual para nivel de riesgo cualitativo
threatSchema.virtual('riskLevel').get(function() {
  if (this.baseProbability >= 0.8) return 'very_high';
  if (this.baseProbability >= 0.6) return 'high';
  if (this.baseProbability >= 0.4) return 'medium';
  if (this.baseProbability >= 0.2) return 'low';
  return 'very_low';
});

// Método para calcular probabilidad ajustada
threatSchema.methods.calculateAdjustedProbability = function(temporalFactor = 1.0, geographicFactor = 1.0) {
  let adjustedProbability = this.baseProbability * temporalFactor * geographicFactor;
  
  // Aplicar factor estacional si aplica
  if (this.temporalFactor.hasSeasonality) {
    const currentMonth = new Date().getMonth() + 1;
    if (this.temporalFactor.peakMonths.includes(currentMonth)) {
      adjustedProbability *= this.temporalFactor.seasonalMultiplier;
    }
  }
  
  // Mantener en rango válido
  return Math.min(Math.max(adjustedProbability, 0), 1);
};

// Método para obtener CVEs relacionados activos
threatSchema.methods.getActiveCVEs = function() {
  if (!this.cveIntegration.enabled) return [];
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.cveIntegration.relatedCves.filter(cve => 
    cve.dateFound >= thirtyDaysAgo && cve.cvssScore >= 7.0
  );
};

// Middleware pre-save para validaciones
threatSchema.pre('save', function(next) {
  // Validar códigos MAGERIT estándar
  if (this.isStandard && !this.mageritCode.match(/^[A-E]\.\d{1,2}(\.\d{1,2})?$/)) {
    return next(new Error('Código MAGERIT inválido para amenaza estándar'));
  }
  
  // Sincronizar probabilityLevel con baseProbability
  if (this.baseProbability >= 0.8) this.probabilityLevel = 'very_high';
  else if (this.baseProbability >= 0.6) this.probabilityLevel = 'high';
  else if (this.baseProbability >= 0.4) this.probabilityLevel = 'medium';
  else if (this.baseProbability >= 0.2) this.probabilityLevel = 'low';
  else this.probabilityLevel = 'very_low';
  
  next();
});

// Método estático para cargar catálogo MAGERIT estándar
threatSchema.statics.loadStandardCatalog = async function(organizationId, userId) {
  const standardThreats = [
    {
      mageritCode: 'A.1',
      name: 'Fuego',
      description: 'Incendio que puede destruir el soporte de la información así como los equipos de procesamiento.',
      category: 'natural_disasters',
      baseProbability: 0.1,
      affectedDimensions: { availability: true },
      susceptibleAssetTypes: ['hardware', 'installations', 'support_equipment'],
      organization: organizationId,
      createdBy: userId,
      isStandard: true
    },
    {
      mageritCode: 'E.1',
      name: 'Errores de los usuarios',
      description: 'Equivocaciones de las personas cuando usan los sistemas de información.',
      category: 'organizational',
      baseProbability: 0.6,
      affectedDimensions: { confidentiality: true, integrity: true, availability: true },
      susceptibleAssetTypes: ['data', 'software'],
      organization: organizationId,
      createdBy: userId,
      isStandard: true
    },
    {
      mageritCode: 'E.2',
      name: 'Errores del administrador',
      description: 'Equivocaciones de los administradores de los sistemas.',
      category: 'organizational', 
      baseProbability: 0.4,
      affectedDimensions: { confidentiality: true, integrity: true, availability: true },
      susceptibleAssetTypes: ['software', 'hardware', 'communication_networks'],
      organization: organizationId,
      createdBy: userId,
      isStandard: true
    },
    {
      mageritCode: 'E.7',
      name: 'Deficiencias en la organización',
      description: 'Carencias en la organización que se traduce en una mala política de seguridad.',
      category: 'organizational',
      baseProbability: 0.5,
      affectedDimensions: { confidentiality: true, integrity: true, availability: true, authenticity: true, traceability: true },
      susceptibleAssetTypes: ['essential_services', 'data', 'software'],
      organization: organizationId,
      createdBy: userId,
      isStandard: true
    },
    {
      mageritCode: 'E.8',
      name: 'Difusión de software dañino',
      description: 'Instalación de programas maliciosos: virus, gusanos, troyanos, etc.',
      category: 'cyberattacks',
      baseProbability: 0.7,
      affectedDimensions: { confidentiality: true, integrity: true, availability: true },
      susceptibleAssetTypes: ['software', 'data', 'hardware'],
      cveIntegration: { enabled: true, cvePatterns: ['malware', 'virus', 'trojan'] },
      organization: organizationId,
      createdBy: userId,
      isStandard: true
    }
  ];
  
  try {
    await this.insertMany(standardThreats);
    return { success: true, count: standardThreats.length };
  } catch (error) {
    throw new Error(`Error cargando catálogo estándar: ${error.message}`);
  }
};

module.exports = mongoose.model('Threat', threatSchema);