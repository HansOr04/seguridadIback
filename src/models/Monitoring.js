const mongoose = require('mongoose');

const monitoringSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del monitoreo es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  description: {
    type: String,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres']
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  type: {
    type: String,
    enum: ['risk_assessment', 'control_testing', 'vulnerability_scan', 'compliance_check', 'kpi_monitoring'],
    required: true
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'paused', 'error'],
    default: 'active'
  },
  assets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Asset'
  }],
  controls: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Control'
  }],
  risks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Risk'
  }],
  lastExecuted: {
    type: Date
  },
  nextExecution: {
    type: Date
  },
  responsible: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    recipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    threshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 80
    }
  },
  metrics: {
    totalExecutions: {
      type: Number,
      default: 0
    },
    successfulExecutions: {
      type: Number,
      default: 0
    },
    failedExecutions: {
      type: Number,
      default: 0
    },
    averageExecutionTime: {
      type: Number,
      default: 0
    },
    lastExecutionTime: {
      type: Number
    }
  },
  results: [{
    date: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['success', 'warning', 'error', 'info'],
      required: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    message: {
      type: String,
      maxlength: [500, 'El mensaje no puede exceder 500 caracteres']
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    },
    executionTime: {
      type: Number
    }
  }],
  configuration: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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
monitoringSchema.index({ organization: 1, type: 1 });
monitoringSchema.index({ status: 1, nextExecution: 1 });
monitoringSchema.index({ frequency: 1 });

// Virtual para calcular la tasa de éxito
monitoringSchema.virtual('successRate').get(function() {
  if (this.metrics.totalExecutions === 0) return 0;
  return (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100;
});

// Virtual para obtener el último resultado
monitoringSchema.virtual('lastResult').get(function() {
  if (this.results && this.results.length > 0) {
    return this.results[this.results.length - 1];
  }
  return null;
});

// Método para programar próxima ejecución
monitoringSchema.methods.scheduleNext = function() {
  const now = new Date();
  let next = new Date(now);

  switch (this.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  this.nextExecution = next;
  return this.save();
};

// Método para agregar resultado
monitoringSchema.methods.addResult = function(status, score, message, details, executionTime) {
  this.results.push({
    status,
    score,
    message,
    details,
    executionTime
  });

  // Actualizar métricas
  this.metrics.totalExecutions += 1;
  
  if (status === 'success') {
    this.metrics.successfulExecutions += 1;
  } else if (status === 'error') {
    this.metrics.failedExecutions += 1;
  }

  if (executionTime) {
    this.metrics.lastExecutionTime = executionTime;
    this.metrics.averageExecutionTime = 
      ((this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1)) + executionTime) / 
      this.metrics.totalExecutions;
  }

  this.lastExecuted = new Date();
  
  // Mantener solo los últimos 100 resultados
  if (this.results.length > 100) {
    this.results = this.results.slice(-100);
  }

  return this.save();
};

// Método para verificar si debe ejecutarse
monitoringSchema.methods.shouldExecute = function() {
  if (this.status !== 'active') return false;
  if (!this.nextExecution) return true;
  return new Date() >= this.nextExecution;
};

module.exports = mongoose.model('Monitoring', monitoringSchema);