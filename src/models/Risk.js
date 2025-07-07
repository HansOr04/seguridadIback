const mongoose = require('mongoose');

const riskSchema = new mongoose.Schema({
  // Identificación del riesgo
  riskId: {
    type: String,
    required: true,
    unique: true,
    // Formato: ORG-ASSET-THREAT-001
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  
  // Elementos del riesgo (tripleta MAGERIT)
  asset: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true
  },
  threat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Threat',
    required: true
  },
  vulnerability: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vulnerability',
    required: true
  },
  
  // Cálculos cuantitativos base MAGERIT
  calculation: {
    // Valores base (0-1)
    threatProbability: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    vulnerabilityLevel: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    
    // Impacto por dimensión (0-1)
    impact: {
      confidentiality: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      integrity: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      availability: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      authenticity: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      },
      traceability: {
        type: Number,
        min: 0,
        max: 1,
        default: 0
      }
    },
    
    // Impacto agregado ponderado
    aggregatedImpact: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    
    // Factores de ajuste
    temporalFactor: {
      type: Number,
      default: 1.0,
      min: 0.1,
      max: 3.0
      // Factor que ajusta la probabilidad por tiempo
    },
    environmentalFactor: {
      type: Number,
      default: 1.0,
      min: 0.1,
      max: 3.0
      // Factor que ajusta por entorno organizacional
    },
    
    // Riesgo calculado (fórmula MAGERIT)
    baseRisk: {
      type: Number,
      required: true,
      min: 0,
      max: 1
      // Riesgo = Probabilidad × Vulnerabilidad × Impacto
    },
    adjustedRisk: {
      type: Number,
      required: true,
      min: 0,
      max: 1
      // Riesgo ajustado por factores temporales y ambientales
    },
    
    // Valor económico del riesgo
    economicImpact: {
      potentialLoss: {
        type: Number,
        default: 0
        // Pérdida potencial en USD
      },
      expectedLoss: {
        type: Number,
        default: 0
        // Pérdida esperada = Riesgo × Valor del activo
      },
      annualizedLoss: {
        type: Number,
        default: 0
        // Pérdida anualizada esperada (ALE)
      }
    }
  },
  
  // Clasificación de riesgo
  classification: {
    riskLevel: {
      type: String,
      required: true,
      enum: ['very_low', 'low', 'medium', 'high', 'critical']
    },
    riskCategory: {
      type: String,
      required: true,
      enum: ['operational', 'strategic', 'financial', 'compliance', 'reputational', 'technical']
    },
    businessFunction: {
      type: String,
      enum: ['core_business', 'support', 'management', 'compliance']
    }
  },
  
  // Matriz de riesgo (posición en matriz 5x5)
  riskMatrix: {
    probabilityLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 5
      // 1=Muy Baja, 2=Baja, 3=Media, 4=Alta, 5=Muy Alta
    },
    impactLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    matrixPosition: {
      type: String,
      required: true,
      match: /^[1-5][1-5]$/
      // Posición en matriz: "11", "23", "55", etc.
    },
    riskScore: {
      type: Number,
      required: true,
      min: 1,
      max: 25
      // Probabilidad × Impacto (1-25)
    }
  },
  
  // Análisis cuantitativo avanzado
  quantitativeAnalysis: {
    // Simulación Monte Carlo
    monteCarlo: {
      iterations: {
        type: Number,
        default: 10000
      },
      confidenceInterval: {
        p5: Number,    // Percentil 5%
        p50: Number,   // Mediana
        p95: Number    // Percentil 95%
      },
      lastSimulation: {
        type: Date
      }
    },
    
    // Value at Risk
    valueAtRisk: {
      var95: {
        type: Number,
        // VaR al 95% de confianza
      },
      var99: {
        type: Number,
        // VaR al 99% de confianza
      },
      expectedShortfall: {
        type: Number,
        // Expected Shortfall (CVaR)
      }
    },
    
    // Análisis de sensibilidad
    sensitivity: {
      probabilitySensitivity: {
        type: Number,
        // Sensibilidad a cambios en probabilidad
      },
      impactSensitivity: {
        type: Number,
        // Sensibilidad a cambios en impacto
      },
      lastAnalysis: {
        type: Date
      }
    }
  },
  
  // Tratamiento de riesgo
  treatment: {
    strategy: {
      type: String,
      enum: ['accept', 'mitigate', 'transfer', 'avoid'],
      default: 'mitigate'
    },
    status: {
      type: String,
      enum: ['identified', 'analyzed', 'treatment_planned', 'treatment_in_progress', 'monitored', 'closed'],
      default: 'identified'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    
    // Controles aplicados
    appliedControls: [{
      control: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Control'
      },
      effectiveness: {
        type: Number,
        min: 0,
        max: 1
        // Efectividad del control (0-100%)
      },
      implementationCost: {
        type: Number,
        default: 0
      },
      implementationDate: {
        type: Date
      },
      status: {
        type: String,
        enum: ['planned', 'implementing', 'implemented', 'not_effective'],
        default: 'planned'
      }
    }],
    
    // Riesgo residual
    residualRisk: {
      probability: {
        type: Number,
        min: 0,
        max: 1
      },
      impact: {
        type: Number,
        min: 0,
        max: 1
      },
      riskLevel: {
        type: String,
        enum: ['very_low', 'low', 'medium', 'high', 'critical']
      },
      acceptanceDate: {
        type: Date
      },
      acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    
    // ROI del tratamiento
    treatmentROI: {
      investmentCost: {
        type: Number,
        default: 0
      },
      annualSavings: {
        type: Number,
        default: 0
      },
      paybackPeriod: {
        type: Number,
        // Período de retorno en años
      },
      netPresentValue: {
        type: Number,
        // Valor presente neto
      }
    }
  },
  
  // Monitoreo y seguimiento
  monitoring: {
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewFrequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'annually'],
      default: 'quarterly'
    },
    nextReviewDate: {
      type: Date
    },
    lastReviewDate: {
      type: Date
    },
    kpis: [{
      name: String,
      value: Number,
      target: Number,
      unit: String,
      lastUpdate: Date
    }],
    alerts: [{
      type: {
        type: String,
        enum: ['threshold_exceeded', 'control_failed', 'new_vulnerability', 'external_event']
      },
      message: String,
      severity: {
        type: String,
        enum: ['info', 'warning', 'critical']
      },
      date: {
        type: Date,
        default: Date.now
      },
      resolved: {
        type: Boolean,
        default: false
      }
    }]
  },
  
  // Historial de cambios
  riskHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    version: String,
    changes: {
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    },
    reason: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Escenarios de riesgo
  scenarios: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    probability: {
      type: Number,
      min: 0,
      max: 1
    },
    impact: {
      type: Number,
      min: 0,
      max: 1
    },
    potentialLoss: Number,
    likelihood: {
      type: String,
      enum: ['very_unlikely', 'unlikely', 'possible', 'likely', 'very_likely']
    }
  }],
  
  // Metadatos organizacionales
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  
  // Control de versiones
  version: {
    type: String,
    default: '1.0'
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
riskSchema.index({ organization: 1, 'classification.riskLevel': 1 });
riskSchema.index({ organization: 1, asset: 1 });
riskSchema.index({ organization: 1, 'treatment.status': 1 });
riskSchema.index({ 'monitoring.nextReviewDate': 1 });
riskSchema.index({ 'calculation.adjustedRisk': -1 });
riskSchema.index({ riskId: 1 }, { unique: true });

// Virtual para obtener el nivel de riesgo inherente
riskSchema.virtual('inherentRiskLevel').get(function() {
  const risk = this.calculation.baseRisk;
  if (risk >= 0.8) return 'critical';
  if (risk >= 0.6) return 'high';
  if (risk >= 0.4) return 'medium';
  if (risk >= 0.2) return 'low';
  return 'very_low';
});

// Virtual para calcular efectividad total de controles
riskSchema.virtual('totalControlEffectiveness').get(function() {
  if (!this.treatment.appliedControls.length) return 0;
  
  const implementedControls = this.treatment.appliedControls.filter(
    control => control.status === 'implemented'
  );
  
  if (!implementedControls.length) return 0;
  
  // Calcular efectividad combinada (no aditiva)
  let combinedEffectiveness = 0;
  for (const control of implementedControls) {
    combinedEffectiveness = combinedEffectiveness + control.effectiveness * (1 - combinedEffectiveness);
  }
  
  return combinedEffectiveness;
});

// Método para calcular riesgo residual
riskSchema.methods.calculateResidualRisk = function() {
  const controlEffectiveness = this.totalControlEffectiveness || 0;
  
  const residualProbability = this.calculation.threatProbability * (1 - controlEffectiveness);
  const residualImpact = this.calculation.aggregatedImpact * (1 - controlEffectiveness * 0.5);
  
  const residualRisk = residualProbability * this.calculation.vulnerabilityLevel * residualImpact;
  
  // Actualizar riesgo residual
  this.treatment.residualRisk.probability = residualProbability;
  this.treatment.residualRisk.impact = residualImpact;
  
  if (residualRisk >= 0.8) this.treatment.residualRisk.riskLevel = 'critical';
  else if (residualRisk >= 0.6) this.treatment.residualRisk.riskLevel = 'high';
  else if (residualRisk >= 0.4) this.treatment.residualRisk.riskLevel = 'medium';
  else if (residualRisk >= 0.2) this.treatment.residualRisk.riskLevel = 'low';
  else this.treatment.residualRisk.riskLevel = 'very_low';
  
  return residualRisk;
};

// Método para calcular ROI del tratamiento
riskSchema.methods.calculateTreatmentROI = function(assetValue) {
  const riskReduction = this.calculation.adjustedRisk - this.calculateResidualRisk();
  const annualSavings = riskReduction * (assetValue || 0);
  
  const totalInvestment = this.treatment.appliedControls.reduce(
    (sum, control) => sum + (control.implementationCost || 0), 0
  );
  
  if (totalInvestment === 0) return { roi: 0, paybackPeriod: Infinity };
  
  const roi = ((annualSavings - totalInvestment) / totalInvestment) * 100;
  const paybackPeriod = totalInvestment / annualSavings;
  
  this.treatment.treatmentROI.investmentCost = totalInvestment;
  this.treatment.treatmentROI.annualSavings = annualSavings;
  this.treatment.treatmentROI.paybackPeriod = paybackPeriod;
  
  return { roi, paybackPeriod, annualSavings };
};

// Método para simular Monte Carlo
riskSchema.methods.runMonteCarloSimulation = function(iterations = 10000) {
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    // Generar variaciones aleatorias
    const probVariation = this.calculation.threatProbability * (0.8 + Math.random() * 0.4);
    const vulnVariation = this.calculation.vulnerabilityLevel * (0.9 + Math.random() * 0.2);
    const impactVariation = this.calculation.aggregatedImpact * (0.85 + Math.random() * 0.3);
    
    const simulatedRisk = probVariation * vulnVariation * impactVariation;
    results.push(Math.min(simulatedRisk, 1.0));
  }
  
  results.sort((a, b) => a - b);
  
  const p5Index = Math.floor(iterations * 0.05);
  const p50Index = Math.floor(iterations * 0.5);
  const p95Index = Math.floor(iterations * 0.95);
  
  this.quantitativeAnalysis.monteCarlo = {
    iterations: iterations,
    confidenceInterval: {
      p5: results[p5Index],
      p50: results[p50Index],
      p95: results[p95Index]
    },
    lastSimulation: new Date()
  };
  
  return this.quantitativeAnalysis.monteCarlo.confidenceInterval;
};

// Método para actualizar próxima fecha de revisión
riskSchema.methods.updateNextReviewDate = function() {
  const today = new Date();
  let nextDate = new Date(today);
  
  switch (this.monitoring.reviewFrequency) {
    case 'weekly':
      nextDate.setDate(today.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(today.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(today.getMonth() + 3);
      break;
    case 'annually':
      nextDate.setFullYear(today.getFullYear() + 1);
      break;
  }
  
  this.monitoring.nextReviewDate = nextDate;
  return nextDate;
};

// Middleware pre-save para validaciones y cálculos
riskSchema.pre('save', function(next) {
  // Calcular riesgo base si no existe
  if (!this.calculation.baseRisk) {
    this.calculation.baseRisk = 
      this.calculation.threatProbability * 
      this.calculation.vulnerabilityLevel * 
      this.calculation.aggregatedImpact;
  }
  
  // Calcular riesgo ajustado
  this.calculation.adjustedRisk = Math.min(
    this.calculation.baseRisk * 
    this.calculation.temporalFactor * 
    this.calculation.environmentalFactor,
    1.0
  );
  
  // Actualizar clasificación de riesgo
  const risk = this.calculation.adjustedRisk;
  if (risk >= 0.8) this.classification.riskLevel = 'critical';
  else if (risk >= 0.6) this.classification.riskLevel = 'high';
  else if (risk >= 0.4) this.classification.riskLevel = 'medium';
  else if (risk >= 0.2) this.classification.riskLevel = 'low';
  else this.classification.riskLevel = 'very_low';
  
  // Convertir a escala 1-5 para matriz
  this.riskMatrix.probabilityLevel = Math.ceil(this.calculation.threatProbability * 5);
  this.riskMatrix.impactLevel = Math.ceil(this.calculation.aggregatedImpact * 5);
  this.riskMatrix.matrixPosition = `${this.riskMatrix.probabilityLevel}${this.riskMatrix.impactLevel}`;
  this.riskMatrix.riskScore = this.riskMatrix.probabilityLevel * this.riskMatrix.impactLevel;
  
  // Actualizar próxima revisión si no existe
  if (!this.monitoring.nextReviewDate) {
    this.updateNextReviewDate();
  }
  
  next();
});

// Método estático para obtener dashboard de riesgos
riskSchema.statics.getDashboardData = async function(organizationId) {
  const totalRisks = await this.countDocuments({ organization: organizationId });
  
  const risksByLevel = await this.aggregate([
    { $match: { organization: organizationId } },
    { $group: { _id: '$classification.riskLevel', count: { $sum: 1 } } }
  ]);
  
  const risksByCategory = await this.aggregate([
    { $match: { organization: organizationId } },
    { $group: { _id: '$classification.riskCategory', count: { $sum: 1 } } }
  ]);
  
  const treatmentStatus = await this.aggregate([
    { $match: { organization: organizationId } },
    { $group: { _id: '$treatment.status', count: { $sum: 1 } } }
  ]);
  
  const avgRisk = await this.aggregate([
    { $match: { organization: organizationId } },
    { $group: { _id: null, avgRisk: { $avg: '$calculation.adjustedRisk' } } }
  ]);
  
  return {
    totalRisks,
    risksByLevel,
    risksByCategory,
    treatmentStatus,
    averageRisk: avgRisk[0]?.avgRisk || 0
  };
};

// Método estático para cálculo de VaR organizacional
riskSchema.statics.calculateOrganizationalVaR = async function(organizationId, confidenceLevel = 0.95) {
  const risks = await this.find(
    { organization: organizationId },
    'calculation.adjustedRisk calculation.economicImpact.expectedLoss'
  );
  
  const totalExpectedLoss = risks.reduce(
    (sum, risk) => sum + (risk.calculation.economicImpact.expectedLoss || 0), 0
  );
  
  // Simulación simplificada para VaR organizacional
  const simulationResults = [];
  for (let i = 0; i < 10000; i++) {
    let simulatedLoss = 0;
    risks.forEach(risk => {
      if (Math.random() < risk.calculation.adjustedRisk) {
        simulatedLoss += risk.calculation.economicImpact.expectedLoss || 0;
      }
    });
    simulationResults.push(simulatedLoss);
  }
  
  simulationResults.sort((a, b) => b - a);
  const varIndex = Math.floor(simulationResults.length * (1 - confidenceLevel));
  
  return {
    var: simulationResults[varIndex],
    expectedLoss: totalExpectedLoss,
    confidenceLevel: confidenceLevel
  };
};

module.exports = mongoose.model('Risk', riskSchema);