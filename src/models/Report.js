const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del reporte es requerido'],
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
    enum: ['risk_assessment', 'compliance', 'executive_summary', 'technical_details', 'audit', 'kpi_dashboard'],
    required: true
  },
  format: {
    type: String,
    enum: ['pdf', 'excel', 'html', 'json'],
    default: 'pdf'
  },
  status: {
    type: String,
    enum: ['draft', 'generating', 'completed', 'error', 'scheduled'],
    default: 'draft'
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  generatedDate: {
    type: Date
  },
  scheduledDate: {
    type: Date
  },
  frequency: {
    type: String,
    enum: ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'annually'],
    default: 'once'
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  parameters: {
    dateRange: {
      start: {
        type: Date
      },
      end: {
        type: Date
      }
    },
    includeAssets: {
      type: Boolean,
      default: true
    },
    includeRisks: {
      type: Boolean,
      default: true
    },
    includeControls: {
      type: Boolean,
      default: true
    },
    includeTreatments: {
      type: Boolean,
      default: true
    },
    riskLevelFilter: {
      type: [String],
      enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
      default: ['low', 'medium', 'high', 'very_high']
    },
    assetTypes: {
      type: [String],
      default: []
    },
    customFilters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  template: {
    name: {
      type: String,
      default: 'standard'
    },
    customization: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  content: {
    executiveSummary: {
      type: String,
      maxlength: [2000, 'El resumen ejecutivo no puede exceder 2000 caracteres']
    },
    sections: [{
      title: {
        type: String,
        required: true
      },
      content: {
        type: mongoose.Schema.Types.Mixed
      },
      order: {
        type: Number,
        default: 0
      }
    }],
    charts: [{
      type: {
        type: String,
        enum: ['bar', 'pie', 'line', 'scatter', 'heatmap'],
        required: true
      },
      title: {
        type: String,
        required: true
      },
      data: {
        type: mongoose.Schema.Types.Mixed
      },
      config: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    }],
    tables: [{
      title: {
        type: String,
        required: true
      },
      headers: [{
        type: String
      }],
      rows: [{
        type: mongoose.Schema.Types.Mixed
      }]
    }]
  },
  fileInfo: {
    filename: {
      type: String
    },
    fileSize: {
      type: Number
    },
    filePath: {
      type: String
    },
    downloadCount: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    totalAssets: {
      type: Number,
      default: 0
    },
    totalRisks: {
      type: Number,
      default: 0
    },
    totalControls: {
      type: Number,
      default: 0
    },
    averageRiskLevel: {
      type: Number,
      default: 0
    },
    generationTime: {
      type: Number
    },
    dataVersion: {
      type: String
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
reportSchema.index({ organization: 1, type: 1 });
reportSchema.index({ status: 1, scheduledDate: 1 });
reportSchema.index({ generatedBy: 1, createdAt: -1 });

// Virtual para verificar si está programado
reportSchema.virtual('isScheduled').get(function() {
  return this.frequency !== 'once' && this.scheduledDate;
});

// Virtual para obtener el tamaño del archivo en formato legible
reportSchema.virtual('formattedFileSize').get(function() {
  if (!this.fileInfo.fileSize) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(this.fileInfo.fileSize) / Math.log(1024));
  return Math.round(this.fileInfo.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Método para programar próxima generación
reportSchema.methods.scheduleNext = function() {
  if (this.frequency === 'once') return;

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

  this.scheduledDate = next;
  return this.save();
};

// Método para marcar como completado
reportSchema.methods.markCompleted = function(filename, fileSize, filePath) {
  this.status = 'completed';
  this.generatedDate = new Date();
  this.fileInfo.filename = filename;
  this.fileInfo.fileSize = fileSize;
  this.fileInfo.filePath = filePath;
  
  return this.save();
};

// Método para incrementar contador de descarga
reportSchema.methods.incrementDownload = function() {
  this.fileInfo.downloadCount += 1;
  return this.save();
};

// Método para verificar si debe generarse
reportSchema.methods.shouldGenerate = function() {
  if (this.status !== 'scheduled') return false;
  if (!this.scheduledDate) return false;
  return new Date() >= this.scheduledDate;
};

module.exports = mongoose.model('Report', reportSchema);