// src/models/Asset.js

const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
  // Información básica
  name: {
    type: String,
    required: [true, 'El nombre del activo es requerido'],
    trim: true,
    maxLength: [200, 'El nombre no puede exceder 200 caracteres']
  },
  code: {
    type: String,
    required: [true, 'El código del activo es requerido'],
    trim: true,
    uppercase: true,
    maxLength: [20, 'El código no puede exceder 20 caracteres']
  },
  description: {
    type: String,
    trim: true,
    maxLength: [1000, 'La descripción no puede exceder 1000 caracteres']
  },
  
  // Taxonomía MAGERIT
  type: {
    type: String,
    required: [true, 'El tipo de activo es requerido'],
    enum: {
      values: ['I', 'S', 'SW', 'HW', 'COM', 'SI', 'AUX', 'L', 'P'],
      message: 'Tipo de activo no válido según taxonomía MAGERIT'
    }
  },
  subtype: {
    type: String,
    required: [true, 'El subtipo del activo es requerido']
  },
  
  // Valoración MAGERIT (0-10 cada dimensión)
  valuation: {
    confidentiality: {
      type: Number,
      min: [0, 'Confidencialidad mínima es 0'],
      max: [10, 'Confidencialidad máxima es 10'],
      default: 0
    },
    integrity: {
      type: Number,
      min: [0, 'Integridad mínima es 0'],
      max: [10, 'Integridad máxima es 10'],
      default: 0
    },
    availability: {
      type: Number,
      min: [0, 'Disponibilidad mínima es 0'],
      max: [10, 'Disponibilidad máxima es 10'],
      default: 0
    },
    authenticity: {
      type: Number,
      min: [0, 'Autenticidad mínima es 0'],
      max: [10, 'Autenticidad máxima es 10'],
      default: 0
    },
    traceability: {
      type: Number,
      min: [0, 'Trazabilidad mínima es 0'],
      max: [10, 'Trazabilidad máxima es 10'],
      default: 0
    }
  },
  
  // Valor económico
  economicValue: {
    type: Number,
    min: [0, 'El valor económico no puede ser negativo'],
    default: 0
  },
  
  // Factor sectorial para Ecuador
  sectoralFactor: {
    type: Number,
    min: [0.1, 'Factor sectorial mínimo es 0.1'],
    max: [3.0, 'Factor sectorial máximo es 3.0'],
    default: 1.0
  },
  
  // Responsables
  owner: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El propietario del activo es requerido']
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    department: {
      type: String,
      default: ''
    }
  },
  
  custodian: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    email: String,
    department: String
  },
  
  // Ubicación
  location: {
    building: String,
    floor: String,
    room: String,
    rack: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Estado del activo
  status: {
    type: String,
    enum: {
      values: ['PLANNED', 'ACTIVE', 'MAINTENANCE', 'DEPRECATED', 'RETIRED'],
      message: 'Estado de activo no válido'
    },
    default: 'PLANNED'
  },
  
  // Dependencias entre activos
  dependencies: [{
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: true
    },
    dependencyType: {
      type: String,
      enum: ['ESSENTIAL', 'IMPORTANT', 'NORMAL', 'WEAK'],
      default: 'NORMAL'
    },
    description: String,
    impactFactor: {
      type: Number,
      min: 0.1,
      max: 2.0,
      default: 1.0
    }
  }],
  
  // Metadatos adicionales
  metadata: {
    vendor: String,
    model: String,
    version: String,
    serialNumber: String,
    purchaseDate: Date,
    warrantyExpiry: Date,
    tags: [String],
    customFields: mongoose.Schema.Types.Mixed
  },
  
  // Organización (multi-tenant)
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'La organización es requerida']
  },
  
  // Auditoría
  auditTrail: [{
    action: {
      type: String,
      enum: ['CREATED', 'UPDATED', 'VALUED', 'DELETED', 'RESTORED'],
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: mongoose.Schema.Types.Mixed
  }]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para optimización
AssetSchema.index({ organization: 1, code: 1 }, { unique: true });
AssetSchema.index({ organization: 1, type: 1 });
AssetSchema.index({ organization: 1, status: 1 });
AssetSchema.index({ organization: 1, 'criticality.level': 1 });
AssetSchema.index({ 'owner.userId': 1 });
AssetSchema.index({ 'custodian.userId': 1 });

// Virtual para criticidad calculada
AssetSchema.virtual('criticality').get(function() {
  const { confidentiality, integrity, availability, authenticity, traceability } = this.valuation;
  
  // Calcular valor máximo según MAGERIT
  const maxValue = Math.max(confidentiality, integrity, availability, authenticity, traceability);
  
  // Aplicar factor sectorial
  const adjustedValue = maxValue * this.sectoralFactor;
  
  // Determinar nivel de criticidad
  let level;
  if (adjustedValue >= 9) level = 'CRITICAL';
  else if (adjustedValue >= 7) level = 'HIGH';
  else if (adjustedValue >= 5) level = 'MEDIUM';
  else if (adjustedValue >= 3) level = 'LOW';
  else level = 'VERY_LOW';
  
  return {
    score: Math.round(adjustedValue * 100) / 100,
    level,
    maxDimension: maxValue,
    sectoralAdjustment: this.sectoralFactor
  };
});

// Virtual para información del tipo
AssetSchema.virtual('typeInfo').get(function() {
  const types = Asset.getAssetTypes();
  return types[this.type] || null;
});

// Métodos de instancia
AssetSchema.methods.addDependency = function(assetId, dependencyType = 'NORMAL', description = '', impactFactor = 1.0) {
  // Evitar dependencias duplicadas
  const existingDep = this.dependencies.find(dep => dep.assetId.toString() === assetId.toString());
  if (existingDep) {
    existingDep.dependencyType = dependencyType;
    existingDep.description = description;
    existingDep.impactFactor = impactFactor;
  } else {
    this.dependencies.push({
      assetId,
      dependencyType,
      description,
      impactFactor
    });
  }
};

AssetSchema.methods.removeDependency = function(assetId) {
  this.dependencies = this.dependencies.filter(dep => dep.assetId.toString() !== assetId.toString());
};

AssetSchema.methods.calculateDependencyImpact = function() {
  return this.dependencies.reduce((total, dep) => {
    const weights = { 'ESSENTIAL': 1.0, 'IMPORTANT': 0.7, 'NORMAL': 0.5, 'WEAK': 0.3 };
    const weight = weights[dep.dependencyType] || 0.5;
    return total + (weight * dep.impactFactor);
  }, 0);
};

AssetSchema.methods.getFormattedValuation = function() {
  return {
    confidentiality: { value: this.valuation.confidentiality, level: this.getValueLevel(this.valuation.confidentiality) },
    integrity: { value: this.valuation.integrity, level: this.getValueLevel(this.valuation.integrity) },
    availability: { value: this.valuation.availability, level: this.getValueLevel(this.valuation.availability) },
    authenticity: { value: this.valuation.authenticity, level: this.getValueLevel(this.valuation.authenticity) },
    traceability: { value: this.valuation.traceability, level: this.getValueLevel(this.valuation.traceability) }
  };
};

AssetSchema.methods.getValueLevel = function(value) {
  if (value >= 9) return 'MUY_ALTO';
  if (value >= 7) return 'ALTO';
  if (value >= 5) return 'MEDIO';
  if (value >= 3) return 'BAJO';
  return 'MUY_BAJO';
};

// Métodos estáticos
AssetSchema.statics.validateSubtype = function(type, subtype) {
  const types = this.getAssetTypes();
  const typeInfo = types[type];
  
  if (!typeInfo) return false;
  
  // Para simplicidad, aceptar cualquier subtipo que comience con el tipo
  return subtype.startsWith(type + '.');
};

AssetSchema.statics.getAssetTypes = function() {
  return {
    'I': {
      code: 'I',
      name: 'Información',
      description: 'Datos e información en cualquier formato',
      subtypes: {
        'I.1': { code: 'I.1', name: 'Información Confidencial' },
        'I.2': { code: 'I.2', name: 'Información Personal' },
        'I.3': { code: 'I.3', name: 'Información Pública' },
        'I.4': { code: 'I.4', name: 'Información Financiera' }
      }
    },
    'S': {
      code: 'S',
      name: 'Servicios',
      description: 'Servicios proporcionados por la organización',
      subtypes: {
        'S.1': { code: 'S.1', name: 'Servicios de TI' },
        'S.2': { code: 'S.2', name: 'Servicios de Red' },
        'S.3': { code: 'S.3', name: 'Servicios de Aplicación' },
        'S.4': { code: 'S.4', name: 'Servicios de Datos' }
      }
    },
    'SW': {
      code: 'SW',
      name: 'Software',
      description: 'Aplicaciones y programas informáticos',
      subtypes: {
        'SW.1': { code: 'SW.1', name: 'Sistema Operativo' },
        'SW.2': { code: 'SW.2', name: 'Aplicaciones' },
        'SW.3': { code: 'SW.3', name: 'Middleware' },
        'SW.4': { code: 'SW.4', name: 'Herramientas de Desarrollo' }
      }
    },
    'HW': {
      code: 'HW',
      name: 'Hardware',
      description: 'Equipos y dispositivos físicos',
      subtypes: {
        'HW.1': { code: 'HW.1', name: 'Servidores' },
        'HW.2': { code: 'HW.2', name: 'Equipos de Red' },
        'HW.3': { code: 'HW.3', name: 'Estaciones de Trabajo' },
        'HW.4': { code: 'HW.4', name: 'Dispositivos Móviles' }
      }
    },
    'COM': {
      code: 'COM',
      name: 'Comunicaciones',
      description: 'Sistemas de comunicación y red',
      subtypes: {
        'COM.1': { code: 'COM.1', name: 'Redes LAN' },
        'COM.2': { code: 'COM.2', name: 'Redes WAN' },
        'COM.3': { code: 'COM.3', name: 'Comunicaciones Inalámbricas' },
        'COM.4': { code: 'COM.4', name: 'Telefonía' }
      }
    },
    'SI': {
      code: 'SI',
      name: 'Soportes de Información',
      description: 'Medios de almacenamiento de información',
      subtypes: {
        'SI.1': { code: 'SI.1', name: 'Medios Magnéticos' },
        'SI.2': { code: 'SI.2', name: 'Medios Ópticos' },
        'SI.3': { code: 'SI.3', name: 'Medios Electrónicos' },
        'SI.4': { code: 'SI.4', name: 'Documentos Físicos' }
      }
    },
    'AUX': {
      code: 'AUX',
      name: 'Equipamiento Auxiliar',
      description: 'Equipos de apoyo a la infraestructura',
      subtypes: {
        'AUX.1': { code: 'AUX.1', name: 'UPS' },
        'AUX.2': { code: 'AUX.2', name: 'Aire Acondicionado' },
        'AUX.3': { code: 'AUX.3', name: 'Sistemas de Seguridad' },
        'AUX.4': { code: 'AUX.4', name: 'Mobiliario' }
      }
    },
    'L': {
      code: 'L',
      name: 'Instalaciones',
      description: 'Espacios físicos e instalaciones',
      subtypes: {
        'L.1': { code: 'L.1', name: 'Centros de Datos' },
        'L.2': { code: 'L.2', name: 'Oficinas' },
        'L.3': { code: 'L.3', name: 'Almacenes' },
        'L.4': { code: 'L.4', name: 'Instalaciones Externas' }
      }
    },
    'P': {
      code: 'P',
      name: 'Personal',
      description: 'Recursos humanos de la organización',
      subtypes: {
        'P.1': { code: 'P.1', name: 'Personal Interno' },
        'P.2': { code: 'P.2', name: 'Personal Externo' },
        'P.3': { code: 'P.3', name: 'Administradores' },
        'P.4': { code: 'P.4', name: 'Usuarios Finales' }
      }
    }
  };
};

// Middleware pre-save
AssetSchema.pre('save', function(next) {
  // Agregar entrada de auditoría para nuevos activos
  if (this.isNew) {
    this.auditTrail.push({
      action: 'CREATED',
      performedBy: this.owner.userId,
      details: {
        initialValuation: this.valuation,
        initialType: this.type,
        initialSubtype: this.subtype
      }
    });
  }
  
  next();
});

// Middleware post-save
AssetSchema.post('save', function(doc, next) {
  console.log(`✅ Activo ${doc.code} guardado exitosamente`);
  next();
});

module.exports = mongoose.model('Asset', AssetSchema);