const mongoose = require('mongoose');

const controlSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del control es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    maxlength: [500, 'La descripción no puede exceder 500 caracteres']
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  category: {
    type: String,
    enum: [
      'access_control',
      'cryptography',
      'physical_security',
      'network_security',
      'incident_management',
      'business_continuity',
      'supplier_security',
      'human_resources',
      'asset_management',
      'information_classification',
      'operations_security',
      'communications_security',
      'system_development',
      'compliance'
    ],
    required: true
  },
  type: {
    type: String,
    enum: ['preventive', 'detective', 'corrective', 'compensating'],
    required: true
  },
  iso27002Reference: {
    type: String,
    trim: true,
    maxlength: [20, 'La referencia ISO no puede exceder 20 caracteres']
  },
  controlObjective: {
    type: String,
    required: true,
    maxlength: [300, 'El objetivo del control no puede exceder 300 caracteres']
  },
  implementation: {
    type: String,
    required: true,
    maxlength: [1000, 'La implementación no puede exceder 1000 caracteres']
  },
  guidance: {
    type: String,
    maxlength: [1000, 'La guía no puede exceder 1000 caracteres']
  },
  maturityLevel: {
    type: Number,
    enum: [1, 2, 3, 4, 5],
    default: 1
  },
  implementationCost: {
    type: Number,
    default: 0,
    min: [0, 'El costo no puede ser negativo']
  },
  maintenanceCost: {
    type: Number,
    default: 0,
    min: [0, 'El costo de mantenimiento no puede ser negativo']
  },
  effectiveness: {
    type: Number,
    min: [0, 'La efectividad no puede ser negativa'],
    max: [100, 'La efectividad no puede exceder 100%'],
    default: 0
  },
  status: {
    type: String,
    enum: ['planned', 'implementing', 'implemented', 'monitoring', 'needs_review'],
    default: 'planned'
  },
  threats: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Threat'
  }],
  vulnerabilities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vulnerability'
  }],
  assets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset'
  }],
  responsible: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  implementationDate: {
    type: Date
  },
  reviewDate: {
    type: Date
  },
  lastTestDate: {
    type: Date
  },
  testResults: [{
    date: {
      type: Date,
      default: Date.now
    },
    result: {
      type: String,
      enum: ['passed', 'failed', 'partial'],
      required: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    notes: {
      type: String,
      maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
    },
    testedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Control'
  }],
  metrics: {
    availability: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    reliability: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    performance: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimizar consultas
controlSchema.index({ organization: 1, category: 1 });
controlSchema.index({ type: 1, status: 1 });
controlSchema.index({ iso27002Reference: 1 });
controlSchema.index({ maturityLevel: 1 });

// Virtual para calcular el costo total
controlSchema.virtual('totalCost').get(function() {
  return this.implementationCost + this.maintenanceCost;
});

// Virtual para obtener el último resultado de prueba
controlSchema.virtual('lastTestResult').get(function() {
  if (this.testResults && this.testResults.length > 0) {
    return this.testResults[this.testResults.length - 1];
  }
  return null;
});

// Método para verificar si necesita revisión
controlSchema.methods.needsReview = function() {
  if (!this.reviewDate) return true;
  const monthsSinceReview = (Date.now() - this.reviewDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return monthsSinceReview > 12; // Revisión anual
};

// Método para calcular la efectividad promedio
controlSchema.methods.calculateAverageEffectiveness = function() {
  if (!this.testResults || this.testResults.length === 0) {
    return this.effectiveness;
  }
  
  const totalScore = this.testResults.reduce((sum, test) => sum + (test.score || 0), 0);
  return totalScore / this.testResults.length;
};

// Método para agregar resultado de prueba
controlSchema.methods.addTestResult = function(result, score, notes, testedBy) {
  this.testResults.push({
    result,
    score,
    notes,
    testedBy
  });
  this.lastTestDate = new Date();
  
  // Actualizar efectividad basada en el último resultado
  if (score !== undefined) {
    this.effectiveness = score;
  }
  
  return this.save();
};

module.exports = mongoose.model('Control', controlSchema);