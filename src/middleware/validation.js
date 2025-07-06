const { body, param, query, validationResult } = require('express-validator');

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Errores de validación',
      errors: errorMessages
    });
  }
  
  next();
};

// Validaciones para registro de usuario
const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('Debe proporcionar un email válido')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  
  body('profile.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
  
  body('profile.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El apellido solo puede contener letras y espacios'),
  
  body('profile.phone')
    .optional()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Formato de teléfono inválido'),
  
  body('role')
    .optional()
    .isIn(['admin', 'analyst', 'viewer'])
    .withMessage('Rol no válido'),
  
  handleValidationErrors
];

// Validaciones para login
const validateUserLogin = [
  body('email')
    .isEmail()
    .withMessage('Debe proporcionar un email válido')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
  
  handleValidationErrors
];

// Validaciones para actualización de perfil
const validateProfileUpdate = [
  body('profile.firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  
  body('profile.lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  
  body('profile.phone')
    .optional()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Formato de teléfono inválido'),
  
  body('preferences.language')
    .optional()
    .isIn(['es', 'en'])
    .withMessage('Idioma no válido'),
  
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Tema no válido'),
  
  handleValidationErrors
];

// Validaciones para cambio de contraseña
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La nueva contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validaciones para registro de organización
const validateOrganizationRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('El nombre de la organización debe tener entre 2 y 200 caracteres'),
  
  body('ruc')
    .matches(/^\d{13}$/)
    .withMessage('El RUC debe tener exactamente 13 dígitos'),
  
  body('type')
    .isIn(['comercial', 'financiera', 'salud', 'educativa', 'gubernamental', 'manufactura', 'servicios', 'tecnologia', 'ong', 'otro'])
    .withMessage('Tipo de organización no válido'),
  
  body('sector')
    .isIn(['publico', 'privado', 'mixto'])
    .withMessage('Sector no válido'),
  
  body('size')
    .isIn(['micro', 'pequena', 'mediana', 'grande'])
    .withMessage('Tamaño de empresa no válido'),
  
  body('contact.email')
    .optional()
    .isEmail()
    .withMessage('Email de contacto inválido')
    .normalizeEmail(),
  
  body('contact.phone')
    .optional()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Formato de teléfono inválido'),
  
  handleValidationErrors
];

// Validaciones para parámetros de ID
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} debe ser un ID válido`),
  
  handleValidationErrors
];

// Validaciones para paginación
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero mayor a 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100'),
  
  query('sort')
    .optional()
    .isIn(['asc', 'desc', '1', '-1'])
    .withMessage('Orden no válido'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateProfileUpdate,
  validatePasswordChange,
  validateOrganizationRegistration,
  validateObjectId,
  validatePagination
};
const { validationResult } = require('express-validator');
const Asset = require('../models/Asset');

/**
 * Middleware de validación personalizado para SIGRISK-EC
 * Incluye validaciones específicas para MAGERIT y normativas ecuatorianas
 */

/**
 * Validar resultados de express-validator
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Datos de entrada inválidos',
      errors: formattedErrors,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * Validar que el subtipo corresponda al tipo según taxonomía MAGERIT
 */
const validateMageritTaxonomy = async (req, res, next) => {
  try {
    const { type, subtype } = req.body;
    
    if (type && subtype) {
      const isValid = Asset.validateSubtype(type, subtype);
      
      if (!isValid) {
        return res.status(400).json({
          status: 'error',
          message: 'Combinación tipo-subtipo no válida según taxonomía MAGERIT',
          details: {
            type: type,
            subtype: subtype,
            suggestion: 'Consulte la taxonomía MAGERIT v3.0 para combinaciones válidas'
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error validating MAGERIT taxonomy:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno validando taxonomía MAGERIT',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Validar código único de activo en la organización
 */
const validateUniqueAssetCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    const assetId = req.params.id; // Para actualizaciones
    
    if (code) {
      const query = {
        organization: req.user.organization,
        code: code.toUpperCase()
      };
      
      // Si es actualización, excluir el activo actual
      if (assetId) {
        query._id = { $ne: assetId };
      }
      
      const existingAsset = await Asset.findOne(query).select('name code');
      
      if (existingAsset) {
        return res.status(409).json({
          status: 'error',
          message: 'Ya existe un activo con este código en la organización',
          details: {
            existingAsset: {
              id: existingAsset._id,
              name: existingAsset.name,
              code: existingAsset.code
            },
            suggestion: 'Utilice un código diferente o modifique el activo existente'
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error validating unique asset code:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno validando código de activo',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Validar valoración MAGERIT coherente
 */
const validateMageritValuation = (req, res, next) => {
  try {
    const { valuation } = req.body;
    
    if (valuation) {
      const dimensions = ['confidentiality', 'integrity', 'availability', 'authenticity', 'traceability'];
      const issues = [];
      
      // Verificar que al menos una dimensión tenga valor
      const hasAnyValue = dimensions.some(dim => 
        valuation[dim] !== undefined && valuation[dim] > 0
      );
      
      if (!hasAnyValue) {
        issues.push('Al menos una dimensión debe tener un valor mayor a 0');
      }
      
      // Validaciones de coherencia específicas
      
      // Si es información personal (I.4), confidencialidad debe ser alta
      if (req.body.subtype === 'I.4' && valuation.confidentiality < 7) {
        issues.push('Datos de carácter personal requieren confidencialidad alta (≥7)');
      }
      
      // Si es sistema crítico de disponibilidad, disponibilidad debe ser alta
      if (['S.1', 'S.3', 'HW.1'].includes(req.body.subtype) && valuation.availability < 6) {
        issues.push('Sistemas críticos requieren disponibilidad alta (≥6)');
      }
      
      // Si es información financiera (I.6), integridad debe ser alta
      if (req.body.subtype === 'I.6' && valuation.integrity < 7) {
        issues.push('Información financiera requiere integridad alta (≥7)');
      }
      
      // Advertencias de coherencia
      const warnings = [];
      
      // Verificar coherencia entre dimensiones relacionadas
      if (valuation.confidentiality >= 8 && valuation.authenticity < 5) {
        warnings.push('Información altamente confidencial debería tener autenticidad robusta');
      }
      
      if (valuation.integrity >= 8 && valuation.traceability < 5) {
        warnings.push('Información crítica en integridad debería tener trazabilidad adecuada');
      }
      
      if (issues.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Valoración MAGERIT inconsistente',
          issues: issues,
          warnings: warnings,
          timestamp: new Date().toISOString()
        });
      }
      
      // Si hay advertencias pero no errores críticos, continuar pero informar
      if (warnings.length > 0) {
        req.valuationWarnings = warnings;
      }
    }
    
    next();
  } catch (error) {
    console.error('Error validating MAGERIT valuation:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno validando valoración MAGERIT',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Validar dependencias circulares
 */
const validateNonCircularDependencies = async (req, res, next) => {
  try {
    const { dependencies } = req.body;
    const assetId = req.params.id;
    
    if (dependencies && dependencies.length > 0 && assetId) {
      // Verificar dependencias directas circulares
      const directCircular = dependencies.find(dep => 
        dep.assetId.toString() === assetId.toString()
      );
      
      if (directCircular) {
        return res.status(400).json({
          status: 'error',
          message: 'Un activo no puede depender de sí mismo',
          details: {
            circularDependency: {
              assetId: assetId,
              type: 'SELF_REFERENCE'
            }
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Verificar dependencias circulares indirectas
      for (const dependency of dependencies) {
        const hasCircularPath = await checkCircularDependency(assetId, dependency.assetId, req.user.organization);
        
        if (hasCircularPath) {
          const dependentAsset = await Asset.findById(dependency.assetId).select('name code');
          
          return res.status(400).json({
            status: 'error',
            message: 'Dependencia circular detectada',
            details: {
              circularDependency: {
                sourceAsset: assetId,
                targetAsset: dependency.assetId,
                targetAssetInfo: dependentAsset ? {
                  name: dependentAsset.name,
                  code: dependentAsset.code
                } : null,
                type: 'INDIRECT_CIRCULAR'
              },
              suggestion: 'Revise la cadena de dependencias para evitar ciclos'
            },
            timestamp: new Date().toISOString()
          });
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Error validating circular dependencies:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno validando dependencias circulares',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Verificar si existe una dependencia circular
 * @param {String} sourceAssetId - ID del activo origen
 * @param {String} targetAssetId - ID del activo destino
 * @param {String} organizationId - ID de la organización
 * @param {Set} visited - Set de IDs visitados (para evitar loops infinitos)
 * @returns {Boolean} True si existe dependencia circular
 */
const checkCircularDependency = async (sourceAssetId, targetAssetId, organizationId, visited = new Set()) => {
  // Si ya visitamos este nodo, hay un ciclo
  if (visited.has(targetAssetId)) {
    return true;
  }
  
  // Si el destino depende del origen, hay ciclo directo
  const targetAsset = await Asset.findOne({
    _id: targetAssetId,
    organization: organizationId
  }).select('dependencies');
  
  if (!targetAsset) {
    return false;
  }
  
  // Verificar si el destino tiene dependencia directa con el origen
  const hasDirectDependency = targetAsset.dependencies.some(dep => 
    dep.assetId.toString() === sourceAssetId.toString()
  );
  
  if (hasDirectDependency) {
    return true;
  }
  
  // Agregar al conjunto de visitados
  visited.add(targetAssetId);
  
  // Verificar dependencias indirectas recursivamente
  for (const dependency of targetAsset.dependencies) {
    const hasIndirectCircular = await checkCircularDependency(
      sourceAssetId, 
      dependency.assetId.toString(), 
      organizationId, 
      new Set(visited)
    );
    
    if (hasIndirectCircular) {
      return true;
    }
  }
  
  return false;
};

/**
 * Validar límites organizacionales
 */
const validateOrganizationalLimits = async (req, res, next) => {
  try {
    const Organization = require('../models/Organization');
    
    const organization = await Organization.findById(req.user.organization)
      .select('subscriptionPlan limits');
    
    if (!organization) {
      return res.status(404).json({
        status: 'error',
        message: 'Organización no encontrada',
        timestamp: new Date().toISOString()
      });
    }
    
    // Verificar límite de activos
    if (req.method === 'POST' && req.baseUrl.includes('/assets')) {
      const currentAssetCount = await Asset.countDocuments({
        organization: req.user.organization,
        status: { $ne: 'RETIRED' }
      });
      
      const assetLimit = organization.limits?.maxAssets || 1000;
      
      if (currentAssetCount >= assetLimit) {
        return res.status(429).json({
          status: 'error',
          message: 'Límite de activos alcanzado',
          details: {
            currentCount: currentAssetCount,
            limit: assetLimit,
            subscriptionPlan: organization.subscriptionPlan,
            suggestion: 'Considere actualizar su plan de suscripción'
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Verificar límite de dependencias por activo
    if (req.body.dependencies && req.body.dependencies.length > 0) {
      const dependencyLimit = organization.limits?.maxDependenciesPerAsset || 20;
      
      if (req.body.dependencies.length > dependencyLimit) {
        return res.status(400).json({
          status: 'error',
          message: 'Límite de dependencias por activo excedido',
          details: {
            currentCount: req.body.dependencies.length,
            limit: dependencyLimit,
            suggestion: 'Reduzca el número de dependencias o agrúpelas en activos intermedios'
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error validating organizational limits:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno validando límites organizacionales',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Validar permisos sobre activo específico
 */
const validateAssetPermissions = async (req, res, next) => {
  try {
    const assetId = req.params.id;
    const userRole = req.user.role;
    const userId = req.user._id;
    
    if (!assetId) {
      return next();
    }
    
    const asset = await Asset.findOne({
      _id: assetId,
      organization: req.user.organization
    }).select('owner custodian');
    
    if (!asset) {
      return res.status(404).json({
        status: 'error',
        message: 'Activo no encontrado',
        timestamp: new Date().toISOString()
      });
    }
    
    // Admin puede hacer todo
    if (userRole === 'admin' || userRole === 'super_admin') {
      return next();
    }
    
    // Para operaciones de escritura (PUT, DELETE, POST)
    if (['PUT', 'DELETE', 'POST'].includes(req.method)) {
      // Analyst puede editar si es propietario o custodio
      if (userRole === 'analyst') {
        const isOwner = asset.owner.userId.toString() === userId.toString();
        const isCustodian = asset.custodian?.userId?.toString() === userId.toString();
        
        if (!isOwner && !isCustodian) {
          return res.status(403).json({
            status: 'error',
            message: 'No tiene permisos para modificar este activo',
            details: {
              reason: 'Solo el propietario, custodio o administradores pueden modificar el activo',
              yourRole: userRole,
              assetOwner: asset.owner.name
            },
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Viewer no puede hacer operaciones de escritura
        return res.status(403).json({
          status: 'error',
          message: 'Permisos insuficientes para esta operación',
          details: {
            requiredPermissions: ['admin', 'analyst'],
            yourRole: userRole
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error validating asset permissions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno validando permisos del activo',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Validar coherencia sectorial ecuatoriana
 */
const validateSectoralCompliance = (req, res, next) => {
  try {
    const { type, subtype, valuation, economicValue } = req.body;
    const warnings = [];
    const issues = [];
    
    // Validaciones específicas para sector financiero
    if (req.user.organization.sector === 'FINANCIAL') {
      // Datos financieros deben tener alta integridad
      if (subtype === 'I.6' && valuation?.integrity < 8) {
        issues.push('Sector financiero: Información financiera requiere integridad ≥8');
      }
      
      // Sistemas de procesamiento de pagos
      if (subtype === 'SW.2' && economicValue > 50000 && valuation?.availability < 8) {
        warnings.push('Sistemas financieros críticos deberían tener disponibilidad ≥8');
      }
    }
    
    // Validaciones para sector salud
    if (req.user.organization.sector === 'HEALTHCARE') {
      // Datos médicos personales
      if (subtype === 'I.4' && valuation?.confidentiality < 8) {
        issues.push('Sector salud: Datos médicos personales requieren confidencialidad ≥8');
      }
      
      // Sistemas de soporte vital
      if (['HW.1', 'SW.2'].includes(subtype) && valuation?.availability < 9) {
        warnings.push('Sistemas médicos críticos deberían tener disponibilidad máxima');
      }
    }
    
    // Validaciones para sector gobierno
    if (req.user.organization.sector === 'GOVERNMENT') {
      // Información clasificada
      if (type === 'I' && valuation?.confidentiality >= 7 && valuation?.traceability < 6) {
        warnings.push('Información gubernamental sensible requiere trazabilidad adecuada');
      }
    }
    
    // Validaciones para infraestructura crítica
    if (req.user.organization.sector === 'CRITICAL_INFRASTRUCTURE') {
      // Sistemas de control industrial
      if (['HW.1', 'SW.1', 'COM.1'].includes(subtype) && valuation?.availability < 8) {
        issues.push('Infraestructura crítica: Sistemas de control requieren disponibilidad ≥8');
      }
    }
    
    if (issues.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Incumplimiento de normativas sectoriales ecuatorianas',
        issues: issues,
        warnings: warnings,
        timestamp: new Date().toISOString()
      });
    }
    
    if (warnings.length > 0) {
      req.sectoralWarnings = warnings;
    }
    
    next();
  } catch (error) {
    console.error('Error validating sectoral compliance:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno validando cumplimiento sectorial',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Validar formato de archivo de importación
 */
const validateImportFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'No se ha proporcionado archivo para importación',
      timestamp: new Date().toISOString()
    });
  }
  
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv'
  ];
  
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      status: 'error',
      message: 'Formato de archivo no válido',
      details: {
        receivedType: req.file.mimetype,
        allowedTypes: ['Excel (.xlsx, .xls)', 'CSV (.csv)'],
        fileSize: req.file.size
      },
      timestamp: new Date().toISOString()
    });
  }
  
  // Verificar tamaño del archivo
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      status: 'error',
      message: 'Archivo demasiado grande',
      details: {
        fileSize: req.file.size,
        maxSize: maxSize,
        suggestion: 'Divida el archivo en partes más pequeñas'
      },
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * Sanitizar datos de entrada
 */
const sanitizeInput = (req, res, next) => {
  try {
    // Sanitizar strings comunes
    const stringFields = ['name', 'description', 'code'];
    
    stringFields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        // Remover caracteres potencialmente peligrosos
        req.body[field] = req.body[field]
          .replace(/[<>\"']/g, '') // Remover caracteres HTML/JS
          .replace(/\s+/g, ' ')    // Normalizar espacios
          .trim();
      }
    });
    
    // Sanitizar código de activo
    if (req.body.code) {
      req.body.code = req.body.code
        .toUpperCase()
        .replace(/[^A-Z0-9\-_.]/g, ''); // Solo permitir caracteres válidos
    }
    
    // Sanitizar valores numéricos
    const numericFields = ['economicValue', 'sectoralFactor'];
    numericFields.forEach(field => {
      if (req.body[field] !== undefined) {
        const numValue = parseFloat(req.body[field]);
        req.body[field] = isNaN(numValue) ? 0 : numValue;
      }
    });
    
    // Sanitizar valoración MAGERIT
    if (req.body.valuation) {
      Object.keys(req.body.valuation).forEach(dimension => {
        const value = parseInt(req.body.valuation[dimension]);
        req.body.valuation[dimension] = isNaN(value) ? 0 : Math.max(0, Math.min(10, value));
      });
    }
    
    next();
  } catch (error) {
    console.error('Error sanitizing input:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error interno procesando datos de entrada',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Middleware combinado para validación completa de activos
 */
const validateAssetComplete = [
  sanitizeInput,
  validateRequest,
  validateMageritTaxonomy,
  validateUniqueAssetCode,
  validateMageritValuation,
  validateSectoralCompliance,
  validateOrganizationalLimits
];

/**
 * Middleware combinado para validación de dependencias
 */
const validateDependenciesComplete = [
  validateRequest,
  validateNonCircularDependencies,
  validateOrganizationalLimits
];

module.exports = {
  validateRequest,
  validateMageritTaxonomy,
  validateUniqueAssetCode,
  validateMageritValuation,
  validateNonCircularDependencies,
  validateOrganizationalLimits,
  validateAssetPermissions,
  validateSectoralCompliance,
  validateImportFile,
  sanitizeInput,
  
  // Middleware combinados
  validateAssetComplete,
  validateDependenciesComplete,
  
  // Función auxiliar exportada para testing
  checkCircularDependency
};