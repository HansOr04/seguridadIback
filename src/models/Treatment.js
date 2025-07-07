const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del tratamiento es requerido'],
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
  riskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Risk',
    required: true
  },
  assetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset',
    required: true
  },
  type: {
    type: String,
    enum: ['accept', 'mitigate', 'avoid', 'transfer'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['planned', 'in_progress', 'completed', 'cancelled'],
    default: 'planned'
  },
  controls: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Control'
  }],
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
  expectedBenefit: {
    type: Number,
    default: 0,
    min: [0, 'El beneficio esperado no puede ser negativo']
  },
  riskReduction: {
    type: Number,
    default: 0,
    min: [0, 'La reducción de riesgo no puede ser negativa'],
    max: [100, 'La reducción de riesgo no puede exceder 100%']
  },
  roi: {
    type: Number,
    default: 0
  },
  implementationDate: {
    type: Date
  },
  completionDate: {
    type: Date
  },
  reviewDate: {
    type: Date
  },
  responsible: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedDate: {
    type: Date
  },
  notes: {
    type: String,
    maxlength: [1000, 'Las notas no pueden exceder 1000 caracteres']
  },
  metrics: {
    effectiveness: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    efficiency: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    compliance: {
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
treatmentSchema.index({ organization: 1, status: 1 });
treatmentSchema.index({ riskId: 1 });
treatmentSchema.index({ assetId: 1 });
treatmentSchema.index({ type: 1, priority: 1 });

// Virtual para calcular el ROI
treatmentSchema.virtual('calculatedRoi').get(function() {
  if (this.implementationCost + this.maintenanceCost === 0) return 0;
  return ((this.expectedBenefit - (this.implementationCost + this.maintenanceCost)) / 
          (this.implementationCost + this.maintenanceCost)) * 100;
});

// Middleware para actualizar ROI antes de guardar
treatmentSchema.pre('save', function(next) {
  if (this.implementationCost + this.maintenanceCost > 0) {
    this.roi = ((this.expectedBenefit - (this.implementationCost + this.maintenanceCost)) / 
                (this.implementationCost + this.maintenanceCost)) * 100;
  }
  next();
});

// Método para calcular la efectividad del tratamiento
treatmentSchema.methods.calculateEffectiveness = function() {
  if (this.status === 'completed') {
    return this.metrics.effectiveness;
  }
  return 0;
};

// Método para verificar si el tratamiento está vencido
treatmentSchema.methods.isOverdue = function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return this.implementationDate && new Date() > this.implementationDate;
};

module.exports = mongoose.model('Treatment', treatmentSchema);