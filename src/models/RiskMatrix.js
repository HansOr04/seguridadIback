const mongoose = require('mongoose');

const riskMatrixSchema = new mongoose.Schema({
  // Identificación de la matriz
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  version: {
    type: String,
    default: '1.0'
  },
  
  // Configuración de dimensiones
  dimensions: {
    probability: {
      levels: {
        type: Number,
        required: true,
        min: 3,
        max: 7,
        default: 5
        // Típicamente 5 niveles: Muy Baja, Baja, Media, Alta, Muy Alta
      },
      scale: [{
        level: {
          type: Number,
          required: true,
          min: 1,
          max: 7
        },
        label: {
          type: String,
          required: true,
          // "Muy Baja", "Baja", "Media", "Alta", "Muy Alta"
        },
        description: {
          type: String,
          required: true
        },
        numericRange: {
          min: {
            type: Number,
            min: 0,
            max: 1
          },
          max: {
            type: Number,
            min: 0,
            max: 1
          }
        },
        qualitativeDescriptor: {
          type: String,
          // "Una vez cada 10 años", "Una vez al año", etc.
        },
        color: {
          type: String,
          match: /^#[0-9A-F]{6}$/i,
          // Color hex para visualización
        }
      }]
    },
    
    impact: {
      levels: {
        type: Number,
        required: true,
        min: 3,
        max: 7,
        default: 5
      },
      scale: [{
        level: {
          type: Number,
          required: true,
          min: 1,
          max: 7
        },
        label: {
          type: String,
          required: true
        },
        description: {
          type: String,
          required: true
        },
        financialRange: {
          min: {
            type: Number,
            default: 0
            // Impacto financiero mínimo en USD
          },
          max: {
            type: Number,
            default: 0
            // Impacto financiero máximo en USD
          }
        },
        businessImpact: {
          type: String,
          enum: ['minimal', 'minor', 'moderate', 'major', 'severe', 'catastrophic']
        },
        color: {
          type: String,
          match: /^#[0-9A-F]{6}$/i
        }
      }]
    }
  },
  
  // Configuración de la matriz de riesgo
  riskMatrix: {
    // Matriz bidimensional que define el nivel de riesgo
    // para cada combinación de probabilidad e impacto
    cells: [[{
      probabilityLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 7
      },
      impactLevel: {
        type: Number,
        required: true,
        min: 1,
        max: 7
      },
      riskLevel: {
        type: String,
        required: true,
        enum: ['very_low', 'low', 'medium', 'high', 'critical']
      },
      riskScore: {
        type: Number,
        required: true,
        min: 1,
        max: 49
        // Score = probabilityLevel × impactLevel
      },
      color: {
        type: String,
        required: true,
        match: /^#[0-9A-F]{6}$/i
      },
      action: {
        type: String,
        enum: ['accept', 'monitor', 'mitigate', 'transfer', 'avoid'],
        required: true
      },
      actionDescription: {
        type: String,
        required: true
      }
    }]]
  },
  
  // Umbrales de tolerancia al riesgo
  riskTolerance: {
    acceptable: {
      maxScore: {
        type: Number,
        default: 6
        // Riesgos con score <= 6 son aceptables
      },
      levels: {
        type: [String],
        enum: ['very_low', 'low', 'medium', 'high', 'critical'],
        default: ['very_low', 'low']
      }
    },
    tolerable: {
      maxScore: {
        type: Number,
        default: 12
      },
      levels: {
        type: [String],
        enum: ['very_low', 'low', 'medium', 'high', 'critical'],
        default: ['medium']
      }
    },
    unacceptable: {
      minScore: {
        type: Number,
        default: 13
      },
      levels: {
        type: [String],
        enum: ['very_low', 'low', 'medium', 'high', 'critical'],
        default: ['high', 'critical']
      }
    }
  },
  
  // Configuración de escalamiento automático
  escalation: {
    rules: [{
      condition: {
        riskLevel: {
          type: String,
          enum: ['very_low', 'low', 'medium', 'high', 'critical']
        },
        minScore: Number,
        maxScore: Number
      },
      actions: [{
        type: {
          type: String,
          enum: ['notify', 'assign', 'escalate', 'auto_mitigate'],
          required: true
        },
        target: {
          role: {
            type: String,
            enum: ['analyst', 'manager', 'executive', 'admin']
          },
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          },
          department: String
        },
        timeframe: {
          type: Number,
          // Tiempo en horas para la acción
        },
        message: String
      }]
    }]
  },
  
  // Configuración específica por sector (Ecuador)
  sectorConfiguration: {
    sector: {
      type: String,
      enum: ['financial', 'healthcare', 'education', 'government', 'energy', 'telecommunications', 'manufacturing'],
      required: true
    },
    regulatoryRequirements: {
      framework: {
        type: String,
        enum: ['iso27001', 'nist', 'cobit', 'magerit', 'pdp_ecuador'],
        default: 'magerit'
      },
      complianceLevel: {
        type: String,
        enum: ['basic', 'enhanced', 'advanced'],
        default: 'enhanced'
      },
      auditFrequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'biannually', 'annually'],
        default: 'quarterly'
      }
    },
    industryFactors: {
      riskMultiplier: {
        type: Number,
        default: 1.0,
        min: 0.5,
        max: 2.0
        // Factor multiplicador para ajustar riesgos por sector
      },
      criticalAssetFactor: {
        type: Number,
        default: 1.0,
        min: 0.8,
        max: 1.5
      }
    }
  },
  
  // Configuración de reporting automático
  reporting: {
    templates: [{
      name: String,
      type: {
        type: String,
        enum: ['executive', 'technical', 'compliance'],
        required: true
      },
      schedule: {
        frequency: {
          type: String,
          enum: ['daily', 'weekly', 'monthly', 'quarterly'],
          default: 'monthly'
        },
        dayOfWeek: Number, // 0-6 (domingo-sábado)
        dayOfMonth: Number, // 1-31
        recipients: [{
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          },
          role: String,
          email: String
        }]
      },
      includeCharts: {
        type: Boolean,
        default: true
      },
      includeRecommendations: {
        type: Boolean,
        default: true
      }
    }]
  },
  
  // Configuración de KPIs automáticos
  kpiConfiguration: {
    calculationFrequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'weekly'],
      default: 'daily'
    },
    kpis: [{
      name: {
        type: String,
        required: true
      },
      description: String,
      calculation: {
        type: String,
        enum: ['count', 'percentage', 'average', 'sum', 'ratio'],
        required: true
      },
      filters: {
        riskLevels: [String],
        categories: [String],
        dateRange: Number // días hacia atrás
      },
      thresholds: {
        green: {
          operator: {
            type: String,
            enum: ['<', '<=', '>', '>=', '=']
          },
          value: Number
        },
        yellow: {
          operator: String,
          value: Number
        },
        red: {
          operator: String,
          value: Number
        }
      }
    }]
  },
  
  // Metadatos organizacionales
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
    // Solo puede haber una matriz por defecto por organización
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Historial de cambios
  changeHistory: [{
    version: String,
    changes: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      reason: String
    }],
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changeDate: {
      type: Date,
      default: Date.now
    }
  }],
  
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
riskMatrixSchema.index({ organization: 1, isDefault: 1 });
riskMatrixSchema.index({ organization: 1, isActive: 1 });
riskMatrixSchema.index({ 'sectorConfiguration.sector': 1 });

// Virtual para obtener el tamaño total de la matriz
riskMatrixSchema.virtual('matrixSize').get(function() {
  return this.dimensions.probability.levels * this.dimensions.impact.levels;
});

// Virtual para validar consistencia de la matriz
riskMatrixSchema.virtual('isValidMatrix').get(function() {
  const expectedCells = this.dimensions.probability.levels * this.dimensions.impact.levels;
  return this.riskMatrix.cells.length === expectedCells;
});

// Método para obtener el nivel de riesgo basado en probabilidad e impacto
riskMatrixSchema.methods.getRiskLevel = function(probabilityLevel, impactLevel) {
  const cell = this.riskMatrix.cells.find(cell => 
    cell.probabilityLevel === probabilityLevel && 
    cell.impactLevel === impactLevel
  );
  
  return cell ? {
    riskLevel: cell.riskLevel,
    riskScore: cell.riskScore,
    color: cell.color,
    action: cell.action,
    actionDescription: cell.actionDescription
  } : null;
};

// Método para convertir valor numérico a nivel de escala
riskMatrixSchema.methods.getScaleLevel = function(dimension, numericValue) {
  const scale = this.dimensions[dimension].scale;
  
  for (const level of scale) {
    if (numericValue >= level.numericRange.min && numericValue <= level.numericRange.max) {
      return level;
    }
  }
  
  // Si no encuentra coincidencia, devolver el nivel más bajo
  return scale[0];
};

// Método para obtener recomendaciones de tratamiento
riskMatrixSchema.methods.getTreatmentRecommendations = function(riskScore, riskLevel) {
  const recommendations = [];
  
  if (this.riskTolerance.unacceptable.levels.includes(riskLevel)) {
    recommendations.push({
      priority: 'immediate',
      action: 'mitigate',
      description: 'Riesgo inaceptable - requiere mitigación inmediata',
      timeframe: '24 horas'
    });
  } else if (this.riskTolerance.tolerable.levels.includes(riskLevel)) {
    recommendations.push({
      priority: 'high',
      action: 'monitor',
      description: 'Riesgo tolerable - requiere monitoreo y plan de mitigación',
      timeframe: '1 semana'
    });
  } else {
    recommendations.push({
      priority: 'low',
      action: 'accept',
      description: 'Riesgo aceptable - mantener monitoreo rutinario',
      timeframe: '1 mes'
    });
  }
  
  return recommendations;
};

// Método para aplicar escalamiento automático
riskMatrixSchema.methods.checkEscalationRules = function(risk) {
  const applicableRules = this.escalation.rules.filter(rule => {
    const condition = rule.condition;
    
    // Verificar nivel de riesgo
    if (condition.riskLevel && condition.riskLevel !== risk.classification.riskLevel) {
      return false;
    }
    
    // Verificar rango de score
    if (condition.minScore && risk.riskMatrix.riskScore < condition.minScore) {
      return false;
    }
    
    if (condition.maxScore && risk.riskMatrix.riskScore > condition.maxScore) {
      return false;
    }
    
    return true;
  });
  
  return applicableRules.map(rule => ({
    rule: rule,
    actions: rule.actions,
    triggerTime: new Date()
  }));
};

// Método para calcular KPIs automáticamente
riskMatrixSchema.methods.calculateKPIs = function(risks) {
  const kpiResults = [];
  
  this.kpiConfiguration.kpis.forEach(kpiConfig => {
    let filteredRisks = risks;
    
    // Aplicar filtros
    if (kpiConfig.filters.riskLevels && kpiConfig.filters.riskLevels.length > 0) {
      filteredRisks = filteredRisks.filter(risk => 
        kpiConfig.filters.riskLevels.includes(risk.classification.riskLevel)
      );
    }
    
    if (kpiConfig.filters.categories && kpiConfig.filters.categories.length > 0) {
      filteredRisks = filteredRisks.filter(risk => 
        kpiConfig.filters.categories.includes(risk.classification.riskCategory)
      );
    }
    
    if (kpiConfig.filters.dateRange) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - kpiConfig.filters.dateRange);
      filteredRisks = filteredRisks.filter(risk => 
        risk.createdAt >= cutoffDate
      );
    }
    
    // Calcular valor del KPI
    let value = 0;
    switch (kpiConfig.calculation) {
      case 'count':
        value = filteredRisks.length;
        break;
      case 'percentage':
        value = risks.length > 0 ? (filteredRisks.length / risks.length) * 100 : 0;
        break;
      case 'average':
        value = filteredRisks.length > 0 
          ? filteredRisks.reduce((sum, risk) => sum + risk.calculation.adjustedRisk, 0) / filteredRisks.length 
          : 0;
        break;
      case 'sum':
        value = filteredRisks.reduce((sum, risk) => sum + risk.calculation.adjustedRisk, 0);
        break;
    }
    
    // Determinar estado basado en umbrales
    let status = 'green';
    if (kpiConfig.thresholds.red && this.evaluateThreshold(value, kpiConfig.thresholds.red)) {
      status = 'red';
    } else if (kpiConfig.thresholds.yellow && this.evaluateThreshold(value, kpiConfig.thresholds.yellow)) {
      status = 'yellow';
    }
    
    kpiResults.push({
      name: kpiConfig.name,
      value: value,
      status: status,
      calculatedAt: new Date()
    });
  });
  
  return kpiResults;
};

// Método auxiliar para evaluar umbrales
riskMatrixSchema.methods.evaluateThreshold = function(value, threshold) {
  switch (threshold.operator) {
    case '<': return value < threshold.value;
    case '<=': return value <= threshold.value;
    case '>': return value > threshold.value;
    case '>=': return value >= threshold.value;
    case '=': return value === threshold.value;
    default: return false;
  }
};

// Método para generar matriz visual
riskMatrixSchema.methods.generateMatrixVisualization = function() {
  const matrix = [];
  
  for (let i = this.dimensions.impact.levels; i >= 1; i--) {
    const row = [];
    for (let j = 1; j <= this.dimensions.probability.levels; j++) {
      const cell = this.getRiskLevel(j, i);
      row.push({
        x: j,
        y: i,
        riskLevel: cell?.riskLevel || 'unknown',
        riskScore: cell?.riskScore || 0,
        color: cell?.color || '#CCCCCC',
        action: cell?.action || 'review'
      });
    }
    matrix.push(row);
  }
  
  return {
    matrix: matrix,
    probabilityLabels: this.dimensions.probability.scale.map(s => s.label),
    impactLabels: this.dimensions.impact.scale.map(s => s.label)
  };
};

// Método para validar configuración de matriz
riskMatrixSchema.methods.validateConfiguration = function() {
  const errors = [];
  
  // Validar que las escalas estén completas
  if (this.dimensions.probability.scale.length !== this.dimensions.probability.levels) {
    errors.push('Escala de probabilidad incompleta');
  }
  
  if (this.dimensions.impact.scale.length !== this.dimensions.impact.levels) {
    errors.push('Escala de impacto incompleta');
  }
  
  // Validar que todos los valores numéricos estén ordenados
  const probRanges = this.dimensions.probability.scale.map(s => s.numericRange);
  for (let i = 1; i < probRanges.length; i++) {
    if (probRanges[i].min <= probRanges[i-1].max) {
      errors.push('Rangos de probabilidad se superponen');
      break;
    }
  }
  
  // Validar que la matriz esté completa
  const expectedCells = this.dimensions.probability.levels * this.dimensions.impact.levels;
  if (this.riskMatrix.cells.length !== expectedCells) {
    errors.push('Matriz de riesgo incompleta');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

// Middleware pre-save para validaciones
riskMatrixSchema.pre('save', async function(next) {
  // Validar que solo haya una matriz por defecto por organización
  if (this.isDefault) {
    const existingDefault = await this.constructor.findOne({
      organization: this.organization,
      isDefault: true,
      _id: { $ne: this._id }
    });
    
    if (existingDefault) {
      existingDefault.isDefault = false;
      await existingDefault.save();
    }
  }
  
  // Validar configuración de matriz
  const validation = this.validateConfiguration();
  if (!validation.isValid) {
    return next(new Error(`Configuración de matriz inválida: ${validation.errors.join(', ')}`));
  }
  
  // Generar celdas de matriz si no existen
  if (this.riskMatrix.cells.length === 0) {
    this.generateDefaultMatrix();
  }
  
  next();
});

// Método para generar matriz por defecto
riskMatrixSchema.methods.generateDefaultMatrix = function() {
  const cells = [];
  
  for (let prob = 1; prob <= this.dimensions.probability.levels; prob++) {
    for (let impact = 1; impact <= this.dimensions.impact.levels; impact++) {
      const score = prob * impact;
      let riskLevel, color, action;
      
      // Lógica por defecto para asignar niveles de riesgo
      if (score <= 4) {
        riskLevel = 'very_low';
        color = '#4CAF50';
        action = 'accept';
      } else if (score <= 8) {
        riskLevel = 'low';
        color = '#8BC34A';
        action = 'monitor';
      } else if (score <= 12) {
        riskLevel = 'medium';
        color = '#FFC107';
        action = 'mitigate';
      } else if (score <= 16) {
        riskLevel = 'high';
        color = '#FF9800';
        action = 'mitigate';
      } else {
        riskLevel = 'critical';
        color = '#F44336';
        action = 'avoid';
      }
      
      cells.push({
        probabilityLevel: prob,
        impactLevel: impact,
        riskLevel: riskLevel,
        riskScore: score,
        color: color,
        action: action,
        actionDescription: `Acción recomendada: ${action}`
      });
    }
  }
  
  this.riskMatrix.cells = cells;
};

// Método estático para crear matriz estándar MAGERIT
riskMatrixSchema.statics.createMageritStandard = async function(organizationId, userId) {
  const standardMatrix = new this({
    name: 'Matriz MAGERIT Estándar',
    description: 'Matriz de riesgo estándar basada en metodología MAGERIT v3.0',
    organization: organizationId,
    isDefault: true,
    
    dimensions: {
      probability: {
        levels: 5,
        scale: [
          {
            level: 1,
            label: 'Muy Baja',
            description: 'Muy improbable que ocurra (menos de una vez cada 10 años)',
            numericRange: { min: 0, max: 0.2 },
            qualitativeDescriptor: '< 1 vez cada 10 años',
            color: '#E8F5E8'
          },
          {
            level: 2,
            label: 'Baja',
            description: 'Improbable que ocurra (una vez cada 5-10 años)',
            numericRange: { min: 0.2, max: 0.4 },
            qualitativeDescriptor: '1 vez cada 5-10 años',
            color: '#C8E6C9'
          },
          {
            level: 3,
            label: 'Media',
            description: 'Puede ocurrir (una vez cada 2-5 años)',
            numericRange: { min: 0.4, max: 0.6 },
            qualitativeDescriptor: '1 vez cada 2-5 años',
            color: '#FFF3E0'
          },
          {
            level: 4,
            label: 'Alta',
            description: 'Probable que ocurra (una vez al año)',
            numericRange: { min: 0.6, max: 0.8 },
            qualitativeDescriptor: '1 vez al año',
            color: '#FFE0B2'
          },
          {
            level: 5,
            label: 'Muy Alta',
            description: 'Muy probable que ocurra (varias veces al año)',
            numericRange: { min: 0.8, max: 1.0 },
            qualitativeDescriptor: 'Varias veces al año',
            color: '#FFCDD2'
          }
        ]
      },
      
      impact: {
        levels: 5,
        scale: [
          {
            level: 1,
            label: 'Muy Bajo',
            description: 'Impacto despreciable en la organización',
            financialRange: { min: 0, max: 10000 },
            businessImpact: 'minimal',
            color: '#E8F5E8'
          },
          {
            level: 2,
            label: 'Bajo',
            description: 'Impacto menor pero gestionable',
            financialRange: { min: 10000, max: 50000 },
            businessImpact: 'minor',
            color: '#C8E6C9'
          },
          {
            level: 3,
            label: 'Medio',
            description: 'Impacto significativo que requiere atención',
            financialRange: { min: 50000, max: 250000 },
            businessImpact: 'moderate',
            color: '#FFF3E0'
          },
          {
            level: 4,
            label: 'Alto',
            description: 'Impacto severo en operaciones críticas',
            financialRange: { min: 250000, max: 1000000 },
            businessImpact: 'major',
            color: '#FFE0B2'
          },
          {
            level: 5,
            label: 'Muy Alto',
            description: 'Impacto catastrófico para la organización',
            financialRange: { min: 1000000, max: Number.MAX_SAFE_INTEGER },
            businessImpact: 'catastrophic',
            color: '#FFCDD2'
          }
        ]
      }
    },
    
    riskTolerance: {
      acceptable: {
        maxScore: 6,
        levels: ['very_low', 'low']
      },
      tolerable: {
        maxScore: 12,
        levels: ['medium']
      },
      unacceptable: {
        minScore: 13,
        levels: ['high', 'critical']
      }
    },
    
    sectorConfiguration: {
      sector: 'government',
      regulatoryRequirements: {
        framework: 'magerit',
        complianceLevel: 'enhanced',
        auditFrequency: 'quarterly'
      }
    },
    
    createdBy: userId,
    updatedBy: userId
  });
  
  standardMatrix.generateDefaultMatrix();
  
  try {
    await standardMatrix.save();
    return standardMatrix;
  } catch (error) {
    throw new Error(`Error creando matriz estándar: ${error.message}`);
  }
};

// Método estático para obtener matriz activa de organización
riskMatrixSchema.statics.getActiveMatrix = async function(organizationId) {
  return await this.findOne({
    organization: organizationId,
    isActive: true,
    isDefault: true
  });
};

// Método estático para clonar matriz
riskMatrixSchema.statics.cloneMatrix = async function(sourceMatrixId, newName, organizationId, userId) {
  const sourceMatrix = await this.findById(sourceMatrixId);
  if (!sourceMatrix) {
    throw new Error('Matriz fuente no encontrada');
  }
  
  const clonedMatrix = new this({
    ...sourceMatrix.toObject(),
    _id: undefined,
    name: newName,
    organization: organizationId,
    isDefault: false,
    version: '1.0',
    createdBy: userId,
    updatedBy: userId,
    changeHistory: []
  });
  
  return await clonedMatrix.save();
};

module.exports = mongoose.model('RiskMatrix', riskMatrixSchema);