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