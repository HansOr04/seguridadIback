const mongoose = require('mongoose');

const cveSchema = new mongoose.Schema({
  // Identificación CVE
  cveId: {
    type: String,
    required: true,
    unique: true,
    match: /^CVE-\d{4}-\d{4,}$/,
    index: true
  },
  
  // Información básica
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  publishedDate: {
    type: Date,
    required: true
  },
  lastModifiedDate: {
    type: Date,
    required: true
  },
  
  // Estado del CVE
  status: {
    type: String,
    enum: ['awaiting_analysis', 'analyzed', 'modified', 'rejected'],
    default: 'analyzed'
  },
  
  // Métricas CVSS v3.1
  cvssV3: {
    baseScore: {
      type: Number,
      min: 0,
      max: 10,
      required: true
    },
    baseSeverity: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      required: true
    },
    vectorString: {
      type: String,
      required: true,
      // Ejemplo: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
    },
    
    // Métricas base
    attackVector: {
      type: String,
      enum: ['network', 'adjacent', 'local', 'physical'],
      required: true
    },
    attackComplexity: {
      type: String,
      enum: ['low', 'high'],
      required: true
    },
    privilegesRequired: {
      type: String,
      enum: ['none', 'low', 'high'],
      required: true
    },
    userInteraction: {
      type: String,
      enum: ['none', 'required'],
      required: true
    },
    scope: {
      type: String,
      enum: ['unchanged', 'changed'],
      required: true
    },
    
    // Impacto
    confidentialityImpact: {
      type: String,
      enum: ['none', 'low', 'high'],
      required: true
    },
    integrityImpact: {
      type: String,
      enum: ['none', 'low', 'high'],
      required: true
    },
    availabilityImpact: {
      type: String,
      enum: ['none', 'low', 'high'],
      required: true
    },
    
    // Métricas temporales (opcionales)
    temporal: {
      exploitCodeMaturity: {
        type: String,
        enum: ['not_defined', 'unproven', 'proof_of_concept', 'functional', 'high']
      },
      remediationLevel: {
        type: String,
        enum: ['not_defined', 'official_fix', 'temporary_fix', 'workaround', 'unavailable']
      },
      reportConfidence: {
        type: String,
        enum: ['not_defined', 'unknown', 'reasonable', 'confirmed']
      },
      temporalScore: Number,
      temporalSeverity: String
    }
  },
  
  // CVSS v2 (para compatibilidad con CVEs antiguos)
  cvssV2: {
    baseScore: Number,
    baseSeverity: String,
    vectorString: String,
    accessVector: String,
    accessComplexity: String,
    authentication: String,
    confidentialityImpact: String,
    integrityImpact: String,
    availabilityImpact: String
  },
  
  // Clasificación CWE (Common Weakness Enumeration)
  weaknesses: [{
    cweId: {
      type: String,
      match: /^CWE-\d+$/
    },
    description: String,
    source: String
  }],
  
  // Productos afectados (CPE - Common Platform Enumeration)
  affectedProducts: [{
    vendor: String,
    product: String,
    version: String,
    cpe23Uri: String,
    // Ejemplo: cpe:2.3:a:apache:http_server:2.4.49:*:*:*:*:*:*:*
    versionStartIncluding: String,
    versionEndIncluding: String,
    versionStartExcluding: String,
    versionEndExcluding: String
  }],
  
  // Referencias externas
  references: [{
    url: {
      type: String,
      required: true
    },
    source: String,
    tags: [String],
    // Tags: patch, vendor-advisory, exploit, mitigation, etc.
  }],
  
  // Correlación con inventario organizacional
  organizationalImpact: [{
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization'
    },
    
    // Activos afectados en la organización
    affectedAssets: [{
      asset: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset'
      },
      relevanceScore: {
        type: Number,
        min: 0,
        max: 1,
        // Qué tan relevante es este CVE para este activo específico
      },
      exposureLevel: {
        type: String,
        enum: ['none', 'low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'not_applicable', 'patched'],
        default: 'pending'
      },
      discoveryDate: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Análisis de impacto organizacional
    businessImpact: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    priorityLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    
    // Estado de remediación
    remediationStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'risk_accepted', 'not_applicable'],
      default: 'pending'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    dueDate: Date,
    completionDate: Date,
    
    // Notas específicas de la organización
    notes: String,
    lastAssessed: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Información de exploits conocidos
  exploitInformation: {
    hasKnownExploit: {
      type: Boolean,
      default: false
    },
    exploitSources: [{
      source: String,
      url: String,
      type: {
        type: String,
        enum: ['poc', 'exploit', 'metasploit', 'commercial']
      },
      dateFound: Date
    }],
    exploitProbability: {
      type: String,
      enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
      default: 'low'
    }
  },
  
  // Información de parches y mitigaciones
  mitigation: {
    patchAvailable: {
      type: Boolean,
      default: false
    },
    patchSources: [{
      vendor: String,
      url: String,
      version: String,
      releaseDate: Date
    }],
    workarounds: [{
      description: String,
      effectiveness: {
        type: String,
        enum: ['low', 'medium', 'high']
      },
      source: String
    }]
  },
  
  // Métricas de seguimiento
  tracking: {
    firstSeenDate: {
      type: Date,
      default: Date.now
    },
    trending: {
      type: Boolean,
      default: false
    },
    discussionActivity: {
      type: String,
      enum: ['none', 'low', 'medium', 'high'],
      default: 'none'
    },
    socialMediaMentions: {
      type: Number,
      default: 0
    }
  },
  
  // Clasificación por industria/sector
  sectorRelevance: {
    financial: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    healthcare: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    education: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    government: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    manufacturing: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    energy: {
      type: String,
      enum: ['none', 'low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  },
  
  // Geolocalización de amenaza (específico para Ecuador)
  geoRelevance: {
    ecuadorRelevance: {
      type: String,
      enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
      default: 'medium'
    },
    regionalFactors: {
      infrastructure: {
        type: String,
        enum: ['not_relevant', 'low', 'medium', 'high'],
        default: 'medium'
      },
      regulations: {
        type: String,
        enum: ['not_relevant', 'low', 'medium', 'high'],
        default: 'medium'
      },
      threatLandscape: {
        type: String,
        enum: ['not_relevant', 'low', 'medium', 'high'],
        default: 'medium'
      }
    }
  },
  
  // Machine Learning y análisis automático
  aiAnalysis: {
    riskPrediction: {
      type: Number,
      min: 0,
      max: 1
      // Predicción ML del riesgo real basado en patrones históricos
    },
    exploitProbabilityML: {
      type: Number,
      min: 0,
      max: 1
      // Probabilidad de exploit calculada por ML
    },
    similarCVEs: [{
      cveId: String,
      similarityScore: Number,
      reason: String
    }],
    lastMLAnalysis: Date,
    confidenceLevel: {
      type: Number,
      min: 0,
      max: 1
    }
  },
  
  // Integración con feeds de amenazas
  threatIntelligence: {
    iocCount: {
      type: Number,
      default: 0
      // Número de Indicadores de Compromiso relacionados
    },
    aptGroups: [{
      name: String,
      confidence: {
        type: String,
        enum: ['low', 'medium', 'high']
      }
    }],
    campaigns: [{
      name: String,
      firstSeen: Date,
      active: Boolean
    }],
    lastThreatUpdate: Date
  },
  
  // Métricas de sincronización con NVD
  syncMetadata: {
    nvdLastModified: Date,
    localLastSync: {
      type: Date,
      default: Date.now
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'error'],
      default: 'synced'
    },
    syncErrors: [{
      error: String,
      timestamp: Date
    }],
    dataSource: {
      type: String,
      enum: ['nvd_api', 'nvd_feed', 'manual_entry', 'third_party'],
      default: 'nvd_api'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimización de consultas
cveSchema.index({ cveId: 1 }, { unique: true });
cveSchema.index({ 'cvssV3.baseScore': -1 });
cveSchema.index({ 'cvssV3.baseSeverity': 1 });
cveSchema.index({ publishedDate: -1 });
cveSchema.index({ 'affectedProducts.vendor': 1, 'affectedProducts.product': 1 });
cveSchema.index({ 'organizationalImpact.organization': 1 });
cveSchema.index({ 'organizationalImpact.remediationStatus': 1 });
cveSchema.index({ 'exploitInformation.hasKnownExploit': 1 });
cveSchema.index({ 'tracking.trending': 1, 'cvssV3.baseScore': -1 });

// Virtual para edad del CVE en días
cveSchema.virtual('ageInDays').get(function() {
  const today = new Date();
  const published = new Date(this.publishedDate);
  const diffTime = Math.abs(today - published);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual para determinar si es un CVE crítico reciente
cveSchema.virtual('isCriticalRecent').get(function() {
  return this.cvssV3.baseSeverity === 'critical' && this.ageInDays <= 30;
});

// Virtual para calcular puntuación de prioridad organizacional
cveSchema.virtual('organizationalPriorityScore').get(function() {
  const baseScore = this.cvssV3.baseScore || 0;
  const exploitBonus = this.exploitInformation.hasKnownExploit ? 2 : 0;
  const ageBonus = this.ageInDays <= 7 ? 1 : (this.ageInDays <= 30 ? 0.5 : 0);
  const trendingBonus = this.tracking.trending ? 1 : 0;
  
  return Math.min(baseScore + exploitBonus + ageBonus + trendingBonus, 10);
});

// Método para obtener el nivel de severidad contextual
cveSchema.methods.getContextualSeverity = function(organizationId) {
  const orgImpact = this.organizationalImpact.find(
    impact => impact.organization.toString() === organizationId.toString()
  );
  
  if (!orgImpact) return this.cvssV3.baseSeverity;
  
  // Ajustar severidad basado en impacto organizacional
  const baseSeverityMap = {
    'none': 0, 'low': 1, 'medium': 2, 'high': 3, 'critical': 4
  };
  
  const businessImpactMap = {
    'none': -1, 'low': 0, 'medium': 0, 'high': 1, 'critical': 2
  };
  
  const baseSeverityNum = baseSeverityMap[this.cvssV3.baseSeverity];
  const businessImpactAdj = businessImpactMap[orgImpact.businessImpact];
  
  const adjustedSeverity = Math.max(0, Math.min(4, baseSeverityNum + businessImpactAdj));
  
  const severityLevels = ['none', 'low', 'medium', 'high', 'critical'];
  return severityLevels[adjustedSeverity];
};

// Método para verificar si afecta a productos específicos
cveSchema.methods.affectsProduct = function(vendor, product, version) {
  return this.affectedProducts.some(affected => {
    const vendorMatch = !vendor || affected.vendor.toLowerCase().includes(vendor.toLowerCase());
    const productMatch = !product || affected.product.toLowerCase().includes(product.toLowerCase());
    
    if (!vendorMatch || !productMatch) return false;
    
    if (!version) return true;
    
    // Verificación simplificada de versión
    if (affected.version === version) return true;
    if (affected.versionStartIncluding && version >= affected.versionStartIncluding) {
      if (!affected.versionEndIncluding || version <= affected.versionEndIncluding) {
        return true;
      }
    }
    
    return false;
  });
};

// Método para calcular factor de riesgo temporal
cveSchema.methods.calculateTemporalRiskFactor = function() {
  let factor = 1.0;
  
  // Factor por edad
  if (this.ageInDays <= 7) factor += 0.3;
  else if (this.ageInDays <= 30) factor += 0.2;
  else if (this.ageInDays <= 90) factor += 0.1;
  
  // Factor por exploit conocido
  if (this.exploitInformation.hasKnownExploit) {
    factor += 0.4;
    
    // Factor adicional por tipo de exploit
    const functionalExploits = this.exploitInformation.exploitSources.filter(
      source => source.type === 'exploit' || source.type === 'metasploit'
    );
    if (functionalExploits.length > 0) factor += 0.2;
  }
  
  // Factor por trending
  if (this.tracking.trending) factor += 0.2;
  
  // Factor por disponibilidad de parche
  if (!this.mitigation.patchAvailable) factor += 0.1;
  
  return Math.min(factor, 2.0); // Máximo 2x el riesgo base
};

// Método para generar recomendaciones automáticas
cveSchema.methods.generateRecommendations = function(organizationId) {
  const recommendations = [];
  const orgImpact = this.organizationalImpact.find(
    impact => impact.organization.toString() === organizationId.toString()
  );
  
  if (!orgImpact) return recommendations;
  
  // Recomendación de parcheo
  if (this.mitigation.patchAvailable) {
    recommendations.push({
      type: 'patch',
      priority: this.cvssV3.baseSeverity === 'critical' ? 'immediate' : 'high',
      action: 'Aplicar parche disponible',
      timeline: this.cvssV3.baseSeverity === 'critical' ? '24 horas' : '7 días'
    });
  }
  
  // Recomendación de workaround
  if (!this.mitigation.patchAvailable && this.mitigation.workarounds.length > 0) {
    recommendations.push({
      type: 'workaround',
      priority: 'medium',
      action: 'Implementar workaround temporal',
      timeline: '72 horas'
    });
  }
  
  // Recomendación de monitoreo
  if (this.exploitInformation.hasKnownExploit) {
    recommendations.push({
      type: 'monitoring',
      priority: 'high',
      action: 'Implementar monitoreo específico para detección de exploits',
      timeline: '24 horas'
    });
  }
  
  // Recomendación de evaluación de impacto
  if (orgImpact.verificationStatus === 'pending') {
    recommendations.push({
      type: 'assessment',
      priority: 'medium',
      action: 'Verificar aplicabilidad en infraestructura organizacional',
      timeline: '48 horas'
    });
  }
  
  return recommendations;
};

// Middleware pre-save para validaciones
cveSchema.pre('save', function(next) {
  // Validar consistencia de fechas
  if (this.lastModifiedDate < this.publishedDate) {
    return next(new Error('lastModifiedDate no puede ser anterior a publishedDate'));
  }
  
  // Actualizar syncMetadata.localLastSync
  this.syncMetadata.localLastSync = new Date();
  
  // Calcular trending automáticamente basado en actividad reciente
  const recentActivity = this.ageInDays <= 30 && 
                        (this.exploitInformation.hasKnownExploit || 
                         this.tracking.socialMediaMentions > 10);
  this.tracking.trending = recentActivity;
  
  next();
});

// Método estático para sincronización con NVD
cveSchema.statics.syncWithNVD = async function(startDate, endDate) {
  // Este método será implementado en el servicio CVE
  // Aquí solo definimos la interfaz
  throw new Error('syncWithNVD debe ser implementado en CVEIntegrationService');
};

// Método estático para obtener CVEs críticos recientes
cveSchema.statics.getCriticalRecent = async function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return await this.find({
    publishedDate: { $gte: cutoffDate },
    'cvssV3.baseSeverity': { $in: ['critical', 'high'] }
  })
  .sort({ 'cvssV3.baseScore': -1, publishedDate: -1 })
  .limit(100);
};

// Método estático para buscar CVEs por productos
cveSchema.statics.findByProducts = async function(products) {
  const searchConditions = products.map(product => ({
    'affectedProducts.vendor': new RegExp(product.vendor, 'i'),
    'affectedProducts.product': new RegExp(product.product, 'i')
  }));
  
  return await this.find({
    $or: searchConditions
  })
  .sort({ 'cvssV3.baseScore': -1 });
};

// Método estático para estadísticas organizacionales
cveSchema.statics.getOrganizationStats = async function(organizationId) {
  const totalCVEs = await this.countDocuments({
    'organizationalImpact.organization': organizationId
  });
  
  const severityStats = await this.aggregate([
    { $match: { 'organizationalImpact.organization': organizationId } },
    { $group: { _id: '$cvssV3.baseSeverity', count: { $sum: 1 } } }
  ]);
  
  const remediationStats = await this.aggregate([
    { $unwind: '$organizationalImpact' },
    { $match: { 'organizationalImpact.organization': organizationId } },
    { $group: { _id: '$organizationalImpact.remediationStatus', count: { $sum: 1 } } }
  ]);
  
  const trendingCount = await this.countDocuments({
    'organizationalImpact.organization': organizationId,
    'tracking.trending': true
  });
  
  return {
    totalCVEs,
    severityStats,
    remediationStats,
    trendingCount
  };
};

// Método estático para alertas automáticas
cveSchema.statics.generateAlerts = async function(organizationId) {
  const alerts = [];
  
  // CVEs críticos sin remediar
  const criticalUnremediated = await this.find({
    'organizationalImpact.organization': organizationId,
    'organizationalImpact.remediationStatus': { $in: ['pending', 'in_progress'] },
    'cvssV3.baseSeverity': 'critical',
    'organizationalImpact.dueDate': { $lt: new Date() }
  });
  
  if (criticalUnremediated.length > 0) {
    alerts.push({
      type: 'overdue_critical',
      count: criticalUnremediated.length,
      message: `${criticalUnremediated.length} CVEs críticos vencidos sin remediar`,
      severity: 'critical'
    });
  }
  
  // Nuevos CVEs con exploits conocidos
  const recentExploits = await this.find({
    'organizationalImpact.organization': organizationId,
    'exploitInformation.hasKnownExploit': true,
    publishedDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });
  
  if (recentExploits.length > 0) {
    alerts.push({
      type: 'new_exploits',
      count: recentExploits.length,
      message: `${recentExploits.length} nuevos CVEs con exploits conocidos en los últimos 7 días`,
      severity: 'high'
    });
  }
  
  return alerts;
};

module.exports = mongoose.model('CVE', cveSchema);