// src/routes/auth.js

const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

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

// ===== RUTAS PÚBLICAS =====

/**
 * @route   POST /api/auth/register-organization
 * @desc    Registrar nueva organización con usuario admin
 * @access  Public
 */
router.post('/register-organization', [
  // Validar organización
  body('organization.name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('El nombre de la organización debe tener entre 2 y 200 caracteres'),
  
  body('organization.ruc')
    .matches(/^\d{13}$/)
    .withMessage('El RUC debe tener exactamente 13 dígitos'),
  
  body('organization.type')
    .isIn(['comercial', 'financiera', 'salud', 'educativa', 'gubernamental', 'manufactura', 'servicios', 'tecnologia', 'ong', 'otro'])
    .withMessage('Tipo de organización no válido'),
  
  body('organization.sector')
    .isIn(['publico', 'privado', 'mixto'])
    .withMessage('Sector no válido'),
  
  body('organization.size')
    .isIn(['micro', 'pequena', 'mediana', 'grande'])
    .withMessage('Tamaño de empresa no válido'),

  // Validar usuario administrador
  body('user.email')
    .isEmail()
    .withMessage('Debe proporcionar un email válido')
    .normalizeEmail()
    .toLowerCase(),
  
  body('user.password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  
  body('user.profile.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
  
  body('user.profile.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El apellido solo puede contener letras y espacios'),

  handleValidationErrors
], authController.registerOrganization);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post('/login', [
  body('email')
    .isEmail()
    .withMessage('Email válido es requerido')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Contraseña es requerida'),
  handleValidationErrors
], authController.login);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Solicitar recuperación de contraseña
 * @access  Public
 */
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .withMessage('Email válido es requerido')
    .normalizeEmail(),
  handleValidationErrors
], authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Resetear contraseña con token
 * @access  Public
 */
router.post('/reset-password', [
  body('token')
    .notEmpty()
    .withMessage('Token es requerido'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La nueva contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  handleValidationErrors
], authController.resetPassword);

// ===== RUTAS PROTEGIDAS =====
// Aplicar middleware de autenticación a todas las rutas siguientes
router.use(auth);

/**
 * @route   GET /api/auth/me
 * @desc    Obtener perfil del usuario autenticado
 * @access  Private
 */
router.get('/me', authController.getProfile);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión
 * @access  Private
 */
router.post('/logout', authController.logout);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña
 * @access  Private
 */
router.post('/change-password', [
  body('currentPassword')
    .notEmpty()
    .withMessage('Contraseña actual es requerida'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La nueva contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  handleValidationErrors
], authController.changePassword);

/**
 * @route   POST /api/auth/verify-token
 * @desc    Verificar validez del token
 * @access  Private
 */
router.post('/verify-token', authController.verifyToken);

module.exports = router;