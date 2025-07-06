// src/routes/users.js

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Función para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Errores de validación',
      errors: errors.array(),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Validaciones
const validateObjectId = (field) => [
  param(field)
    .isMongoId()
    .withMessage(`${field} debe ser un ID válido de MongoDB`)
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero mayor a 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe estar entre 1 y 100')
];

const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('Email válido es requerido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  body('profile.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  body('profile.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  body('role')
    .isIn(['admin', 'analyst', 'viewer'])
    .withMessage('Rol no válido')
];

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
    .matches(/^[\+]?[0-9\s\-\(\)]{10,15}$/)
    .withMessage('Número de teléfono no válido'),
  body('preferences.language')
    .optional()
    .isIn(['es', 'en'])
    .withMessage('Idioma no válido'),
  body('preferences.notifications')
    .optional()
    .isBoolean()
    .withMessage('Las notificaciones deben ser verdadero o falso')
];

// ===== APLICAR AUTENTICACIÓN A TODAS LAS RUTAS =====
router.use(auth);

// ===== RUTAS DE USUARIOS =====

/**
 * @route   GET /api/users
 * @desc    Listar usuarios (requiere ser admin o analyst)
 * @access  Private (admin, analyst)
 */
router.get('/', 
  authorize(['admin', 'analyst']),
  validatePagination,
  handleValidationErrors,
  userController.getUsers
);

/**
 * @route   GET /api/users/stats
 * @desc    Estadísticas de usuarios (solo admin)
 * @access  Private (admin)
 */
router.get('/stats', 
  authorize(['admin']), 
  userController.getUserStats
);

/**
 * @route   PUT /api/users/profile
 * @desc    Actualizar perfil propio
 * @access  Private (todos)
 */
router.put('/profile', 
  validateProfileUpdate,
  handleValidationErrors,
  userController.updateProfile
);

/**
 * @route   POST /api/users
 * @desc    Crear usuario (solo admin)
 * @access  Private (admin)
 */
router.post('/', 
  authorize(['admin']),
  validateUserRegistration,
  handleValidationErrors,
  userController.createUser
);

/**
 * @route   GET /api/users/:id
 * @desc    Obtener usuario específico
 * @access  Private (admin, analyst)
 */
router.get('/:id', 
  authorize(['admin', 'analyst']),
  validateObjectId('id'),
  handleValidationErrors,
  userController.getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Actualizar usuario (solo admin)
 * @access  Private (admin)
 */
router.put('/:id', 
  authorize(['admin']),
  validateObjectId('id'),
  validateProfileUpdate,
  handleValidationErrors,
  userController.updateUser
);

/**
 * @route   PATCH /api/users/:id/toggle-status
 * @desc    Activar/desactivar usuario (solo admin)
 * @access  Private (admin)
 */
router.patch('/:id/toggle-status', 
  authorize(['admin']),
  validateObjectId('id'),
  handleValidationErrors,
  userController.toggleUserStatus
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Eliminar usuario (solo admin)
 * @access  Private (admin)
 */
router.delete('/:id', 
  authorize(['admin']),
  validateObjectId('id'),
  handleValidationErrors,
  userController.deleteUser
);

module.exports = router;