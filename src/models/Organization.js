const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  // Información básica
  name: {
    type: String,
    required: [true, 'El nombre de la organización es requerido'],
    trim: true,
    maxlength: [200, 'El nombre no puede exceder 200 caracteres']
  },
  legalName: {
    type: String,
    trim: true,
    maxlength: [250, 'La razón social no puede exceder 250 caracteres']
  },
  
  // Identificación legal Ecuador
  ruc: {
    type: String,
    required: [true, 'El RUC es requerido'],
    unique: true,
    trim: true,
    match: [/^\d{13}$/, 'El RUC debe tener 13 dígitos']
  },
  
  // Clasificación
  type: {
    type: String,
    enum: {
      values: [
        'comercial',
        'financiera', 
        'salud',
        'educativa',
        'gubernamental',
        'manufactura',
        'servicios',
        'tecnologia',
        'ong',
        'otro'
      ],
      message: 'Tipo de organización no válido'
    },
    required: [true, 'El tipo de organización es requerido']
  },
  
  sector: {
    type: String,
    enum: {
      values: [
        'publico',
        'privado',
        'mixto'
      ],
      message: 'Sector no válido'
    },
    required: [true, 'El sector es requerido']
  },
  
  size: {
    type: String,
    enum: {
      values: ['micro', 'pequena', 'mediana', 'grande'],
      message: 'Tamaño de empresa no válido'
    },
    required: [true, 'El tamaño de la empresa es requerido']
  },

  // Información de contacto
  contact: {
    address: {
      street: String,
      city: String,
      province: String,
      postalCode: String,
      country: {
        type: String,
        default: 'Ecuador'
      }
    },
    phone: {
      type: String,
      match: [/^[0-9+\-\s()]+$/, 'Formato de teléfono inválido']
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Email inválido'
      ]
    },
    website: {
      type: String,
      trim: true
    }
  },

  // Configuración MAGERIT
  mageritConfig: {
    // Factor multiplicador sectorial para cálculos económicos
    sectoralFactor: {
      type: Number,
      default: 1.0,
      min: [0.1, 'Factor sectorial mínimo es 0.1'],
      max: [5.0, 'Factor sectorial máximo es 5.0']
    },
    
    // Escala de valoración personalizada (0-10 por defecto)
    valuationScale: {
      min: {
        type: Number,
        default: 0
      },
      max: {
        type: Number,
        default: 10
      }
    },
    
    // Configuración de dependencias
    dependencySettings: {
      maxDepth: {
        type: Number,
        default: 5,
        min: 1,
        max: 10
      },
      includeTransitive: {
        type: Boolean,
        default: true
      }
    }
  },

  // Configuración de riesgos
  riskConfig: {
    // Matriz de riesgo personalizada
    riskMatrix: {
      dimensions: {
        type: Number,
        default: 5,
        enum: [3, 4, 5]
      },
      probabilityLabels: {
        type: [String],
        default: ['Muy Baja', 'Baja', 'Media', 'Alta', 'Muy Alta']
      },
      impactLabels: {
        type: [String],
        default: ['Insignificante', 'Menor', 'Moderado', 'Mayor', 'Catastrófico']
      }
    },
    
    // Umbrales de riesgo
    riskThresholds: {
      low: {
        type: Number,
        default: 25
      },
      medium: {
        type: Number,
        default: 50
      },
      high: {
        type: Number,
        default: 75
      }
    },
    
    // Apetito de riesgo organizacional
    riskAppetite: {
      level: {
        type: String,
        enum: ['conservative', 'moderate', 'aggressive'],
        default: 'moderate'
      },
      maxAcceptableRisk: {
        type: Number,
        default: 50,
        min: 0,
        max: 100
      }
    }
  },

  // Configuración CVE
  cveConfig: {
    autoSync: {
      type: Boolean,
      default: true
    },
    syncFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'manual'],
      default: 'daily'
    },
    severityThreshold: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    alertCritical: {
      type: Boolean,
      default: true
    }
  },

  // Configuración de cumplimiento
  complianceConfig: {
    dataProtectionLaw: {
      enabled: {
        type: Boolean,
        default: true
      },
      dpoAssigned: {
        type: Boolean,
        default: false
      },
      dpoContact: String
    },
    iso27001: {
      certified: {
        type: Boolean,
        default: false
      },
      certificationDate: Date,
      certificationExpiry: Date,
      certifyingBody: String
    },
    sectoralRegulations: [String]
  },

  // Configuración de reportes
  reportConfig: {
    autoGeneration: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly'],
      default: 'monthly'
    },
    recipients: [String],
    includeExecutiveSummary: {
      type: Boolean,
      default: true
    }
  },

  // Límites y cuotas
  limits: {
    maxUsers: {
      type: Number,
      default: 10
    },
    maxAssets: {
      type: Number,
      default: 1000
    },
    maxReports: {
      type: Number,
      default: 50
    },
    storageQuota: {
      type: Number,
      default: 1024 * 1024 * 1024 // 1GB en bytes
    }
  },

  // Información de suscripción
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'professional', 'enterprise'],
      default: 'free'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    paymentStatus: {
      type: String,
      enum: ['active', 'pending', 'overdue', 'cancelled'],
      default: 'active'
    }
  },

  // Control de estado
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  
  // Auditoría
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// ===== ÍNDICES =====
organizationSchema.index({ ruc: 1 });
organizationSchema.index({ type: 1, sector: 1 });
organizationSchema.index({ 'subscription.plan': 1 });
organizationSchema.index({ isActive: 1, isDeleted: 1 });

// ===== VIRTUALS =====
organizationSchema.virtual('userCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'organization',
  count: true,
  match: { isActive: true, isDeleted: false }
});

organizationSchema.virtual('assetCount', {
  ref: 'Asset',
  localField: '_id',
  foreignField: 'organization',
  count: true,
  match: { isDeleted: false }
});

// ===== MÉTODOS =====
organizationSchema.methods.isWithinLimits = function(resourceType, currentCount) {
  const limit = this.limits[`max${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`];
  return currentCount < limit;
};

organizationSchema.methods.calculateStorageUsage = async function() {
  // Implementar cálculo de uso de almacenamiento
  // Por ahora retornamos 0
  return 0;
};

module.exports = mongoose.model('Organization', organizationSchema);