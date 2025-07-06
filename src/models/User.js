const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Información básica
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Por favor ingrese un email válido'
    ]
  },
  password: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    select: false // No incluir en consultas por defecto
  },
  
  // Perfil del usuario
  profile: {
    firstName: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
      maxlength: [50, 'El nombre no puede exceder 50 caracteres']
    },
    lastName: {
      type: String,
      required: [true, 'El apellido es requerido'],
      trim: true,
      maxlength: [50, 'El apellido no puede exceder 50 caracteres']
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9+\-\s()]+$/, 'Formato de teléfono inválido']
    },
    position: {
      type: String,
      trim: true,
      maxlength: [100, 'El cargo no puede exceder 100 caracteres']
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'El departamento no puede exceder 100 caracteres']
    }
  },

  // Rol y permisos
  role: {
    type: String,
    enum: {
      values: ['super_admin', 'admin', 'analyst', 'viewer'],
      message: 'Rol no válido'
    },
    default: 'viewer'
  },

  // Organización asociada
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: [true, 'El usuario debe estar asociado a una organización']
  },

  // Configuraciones y preferencias
  preferences: {
    language: {
      type: String,
      enum: ['es', 'en'],
      default: 'es'
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      riskAlerts: {
        type: Boolean,
        default: true
      },
      cveAlerts: {
        type: Boolean,
        default: true
      },
      reportGeneration: {
        type: Boolean,
        default: true
      }
    },
    dashboard: {
      layout: {
        type: String,
        enum: ['compact', 'detailed', 'custom'],
        default: 'detailed'
      },
      defaultTimeRange: {
        type: String,
        enum: ['7d', '30d', '90d', '1y'],
        default: '30d'
      }
    }
  },

  // Seguridad y acceso
  security: {
    lastLogin: {
      type: Date
    },
    lastLoginIP: {
      type: String
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    accountLockedUntil: {
      type: Date
    },
    passwordResetToken: {
      type: String
    },
    passwordResetExpires: {
      type: Date
    },
    emailVerificationToken: {
      type: String
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerifiedAt: {
      type: Date
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: {
      type: String,
      select: false
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
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// ===== ÍNDICES =====
userSchema.index({ email: 1 });
userSchema.index({ organization: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'security.emailVerified': 1 });
userSchema.index({ isActive: 1, isDeleted: 1 });

// ===== VIRTUALS =====
userSchema.virtual('fullName').get(function() {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

userSchema.virtual('isAccountLocked').get(function() {
  return this.security.accountLockedUntil && this.security.accountLockedUntil > Date.now();
});

// ===== MIDDLEWARE PRE =====

// Hash password antes de guardar
userSchema.pre('save', async function(next) {
  // Solo hash la contraseña si ha sido modificada
  if (!this.isModified('password')) return next();

  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Actualizar timestamps de modificación
userSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// ===== MÉTODOS DE INSTANCIA =====

// Verificar contraseña
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Incrementar intentos fallidos de login
userSchema.methods.incrementLoginAttempts = function() {
  // Si ya tenemos un lock previo y ha expirado, reiniciar
  if (this.security.accountLockedUntil && this.security.accountLockedUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        'security.accountLockedUntil': 1,
        'security.failedLoginAttempts': 1
      }
    });
  }

  const updates = { $inc: { 'security.failedLoginAttempts': 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 horas

  // Si alcanzamos el máximo de intentos y no estamos ya bloqueados
  if (this.security.failedLoginAttempts + 1 >= maxAttempts && !this.isAccountLocked) {
    updates.$set = {
      'security.accountLockedUntil': Date.now() + lockTime
    };
  }

  return this.updateOne(updates);
};

// Resetear intentos de login después de login exitoso
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'security.accountLockedUntil': 1,
      'security.failedLoginAttempts': 1
    },
    $set: {
      'security.lastLogin': new Date(),
      'security.lastLoginIP': this.lastLoginIP
    }
  });
};

// Generar token de reset de contraseña
userSchema.methods.createPasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.security.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.security.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutos
  
  return resetToken;
};

// ===== MÉTODOS ESTÁTICOS =====

// Buscar usuario activo por email
userSchema.statics.findActiveByEmail = function(email) {
  return this.findOne({
    email: email.toLowerCase(),
    isActive: true,
    isDeleted: false
  });
};

// Buscar usuarios por organización
userSchema.statics.findByOrganization = function(organizationId, options = {}) {
  const query = {
    organization: organizationId,
    isDeleted: false
  };

  if (options.activeOnly !== false) {
    query.isActive = true;
  }

  return this.find(query)
    .populate('organization', 'name type')
    .sort({ 'profile.firstName': 1 });
};

module.exports = mongoose.model('User', userSchema);