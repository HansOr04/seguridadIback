// src/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware de autenticación JWT principal
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Token de acceso requerido',
        code: 'TOKEN_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar el usuario en la base de datos
    const user = await User.findById(decoded.userId)
      .populate('organization', 'name ruc isActive')
      .select('-password');

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar que el usuario esté activo
    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Cuenta de usuario desactivada',
        code: 'ACCOUNT_DISABLED',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar que la organización esté activa
    if (user.organization && !user.organization.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'Organización desactivada',
        code: 'ORGANIZATION_DISABLED',
        timestamp: new Date().toISOString()
      });
    }

    // Agregar usuario al request
    req.user = user;
    
    // Log de acceso (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔐 Auth: ${user.email} (${user.role}) → ${req.method} ${req.path}`);
    }

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);

    // Manejar errores específicos de JWT
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido',
        code: 'INVALID_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Error interno en autenticación',
      code: 'AUTH_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Middleware de autorización basada en roles
 * @param {Array|String} allowedRoles - Roles permitidos
 * @returns {Function} Middleware de Express
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString()
        });
      }

      // Verificar que el usuario tenga un rol asignado
      if (!req.user.role) {
        return res.status(403).json({
          status: 'error',
          message: 'Usuario sin rol asignado',
          timestamp: new Date().toISOString()
        });
      }

      // Normalizar roles permitidos a array
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      // Verificar si el rol del usuario está en la lista de roles permitidos
      const hasPermission = rolesArray.includes(req.user.role);
      
      if (!hasPermission) {
        console.warn(`Acceso denegado: Usuario ${req.user.email} (${req.user.role}) intentó acceder a recurso que requiere roles: ${rolesArray.join(', ')}`);
        
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para acceder a este recurso',
          required_roles: rolesArray,
          user_role: req.user.role,
          timestamp: new Date().toISOString()
        });
      }

      // Log de acceso exitoso (solo en desarrollo)
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Acceso autorizado: ${req.user.email} (${req.user.role}) → ${req.method} ${req.path}`);
      }

      next();
    } catch (error) {
      console.error('Error en middleware RBAC:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error interno en verificación de permisos',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Middleware para verificar acceso a organización
 */
const checkOrganization = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Usuario no autenticado',
      timestamp: new Date().toISOString()
    });
  }

  // Super admin tiene acceso a todas las organizaciones
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Verificar que el recurso pertenezca a la organización del usuario
  const organizationId = req.params.organizationId || req.body.organization;
  
  if (organizationId && organizationId !== req.user.organization._id.toString()) {
    return res.status(403).json({
      status: 'error',
      message: 'Acceso denegado. Recurso no pertenece a su organización',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Definición de roles
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin', 
  ANALYST: 'analyst',
  VIEWER: 'viewer'
};

// Permisos predefinidos para módulos
const assetPermissions = {
  canRead: authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  canModify: authorize(['super_admin', 'admin', 'analyst']),
  canDelete: authorize(['super_admin', 'admin']),
  canImportExport: authorize(['super_admin', 'admin', 'analyst']),
  canValuate: authorize(['super_admin', 'admin', 'analyst'])
};

// Exportar middleware principal y funciones auxiliares
module.exports = authenticateToken;  // Exportación por defecto
module.exports.authorize = authorize;
module.exports.checkOrganization = checkOrganization;
module.exports.assetPermissions = assetPermissions;
module.exports.ROLES = ROLES;