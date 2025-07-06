const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware de autenticación principal
 * Verifica el JWT token y carga la información del usuario
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : null;

    console.log('🔍 Auth middleware:', {
      hasAuthHeader: !!authHeader,
      authHeaderValue: authHeader ? authHeader.substring(0, 20) + '...' : 'no header',
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'no token'
    });

    if (!token) {
      console.log('❌ Auth: No se encontró token de acceso');
      return res.status(401).json({
        status: 'error',
        message: 'Token de acceso requerido',
        code: 'MISSING_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar el token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Auth: Token verificado exitosamente:', {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        organizationId: decoded.organizationId,
        exp: new Date(decoded.exp * 1000).toISOString()
      });
    } catch (jwtError) {
      console.log('❌ Auth: Error verificando JWT:', jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token expirado',
          code: 'TOKEN_EXPIRED',
          timestamp: new Date().toISOString()
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token inválido',
          code: 'INVALID_TOKEN',
          timestamp: new Date().toISOString()
        });
      }

      return res.status(401).json({
        status: 'error',
        message: 'Error de autenticación',
        code: 'AUTH_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Buscar el usuario en la base de datos con toda la información necesaria
    const user = await User.findById(decoded.userId)
      .populate('organization', 'name type sector size ruc country city')
      .select('-password -security.passwordResetToken -security.passwordResetExpires');

    if (!user) {
      console.log('❌ Auth: Usuario no encontrado en BD:', decoded.userId);
      return res.status(401).json({
        status: 'error',
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar que el usuario esté activo
    if (!user.isActive) {
      console.log('❌ Auth: Usuario inactivo:', user.email);
      return res.status(401).json({
        status: 'error',
        message: 'Cuenta de usuario inactiva',
        code: 'USER_INACTIVE',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar que la organización esté activa (si existe)
    if (user.organization) {
      console.log('🏢 Auth: Verificando organización:', {
        orgId: user.organization._id,
        orgName: user.organization.name,
        hasIsActive: user.organization.hasOwnProperty('isActive'),
        isActiveValue: user.organization.isActive,
        hasStatus: user.organization.hasOwnProperty('status'),
        statusValue: user.organization.status,
        hasIsDeleted: user.organization.hasOwnProperty('isDeleted'),
        isDeletedValue: user.organization.isDeleted
      });

      // Verificar si la organización está activa
      // Una organización está activa si:
      // 1. isActive es true (o undefined, por defecto)
      // 2. NO está marcada como eliminada
      // 3. NO tiene status 'inactive' o 'suspended'
      const orgIsActive = user.organization.isActive !== false && 
                         user.organization.isDeleted !== true &&
                         !['inactive', 'suspended', 'blocked'].includes(user.organization.status);

      console.log('🔍 Auth: Resultado verificación organización:', {
        orgIsActive,
        conditions: {
          isActiveNotFalse: user.organization.isActive !== false,
          notDeleted: user.organization.isDeleted !== true,
          statusOK: !['inactive', 'suspended', 'blocked'].includes(user.organization.status)
        }
      });

      if (!orgIsActive) {
        console.log('❌ Auth: Organización inactiva:', user.organization.name);
        return res.status(401).json({
          status: 'error',
          message: 'Organización inactiva',
          code: 'ORGANIZATION_INACTIVE',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Actualizar último acceso si han pasado más de 5 minutos
    const now = new Date();
    const lastActivity = user.security.lastActivity || new Date(0);
    const timeDiff = now - lastActivity;
    
    if (timeDiff > 5 * 60 * 1000) { // 5 minutos
      await User.findByIdAndUpdate(
        user._id,
        { 'security.lastActivity': now },
        { new: false }
      );
    }

    // Agregar información del usuario al request
    req.user = user;
    req.token = token;

    console.log(`✅ Auth: Usuario autenticado → ${user.email} (${user.role}) → ${req.method} ${req.path}`);

    next();

  } catch (error) {
    console.error('💥 Error en middleware de autenticación:', error);

    return res.status(500).json({
      status: 'error',
      message: 'Error interno en autenticación',
      code: 'INTERNAL_AUTH_ERROR',
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
          code: 'USER_NOT_AUTHENTICATED',
          timestamp: new Date().toISOString()
        });
      }

      // Verificar que el usuario tenga un rol asignado
      if (!req.user.role) {
        return res.status(403).json({
          status: 'error',
          message: 'Usuario sin rol asignado',
          code: 'NO_ROLE_ASSIGNED',
          timestamp: new Date().toISOString()
        });
      }

      // Normalizar roles permitidos a array
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Jerarquía de roles (cada rol incluye los permisos de los roles inferiores)
      const roleHierarchy = {
        'super_admin': ['super_admin', 'admin', 'analyst', 'viewer'],
        'admin': ['admin', 'analyst', 'viewer'],
        'analyst': ['analyst', 'viewer'],
        'viewer': ['viewer']
      };

      // Obtener todos los roles que el usuario puede asumir
      const userAllowedRoles = roleHierarchy[req.user.role] || [req.user.role];

      // Verificar si el usuario tiene al menos uno de los roles requeridos
      const hasPermission = rolesArray.some(role => userAllowedRoles.includes(role));

      if (!hasPermission) {
        console.log(`❌ Auth: Usuario ${req.user.email} (${req.user.role}) no autorizado para roles: ${rolesArray.join(', ')}`);
        return res.status(403).json({
          status: 'error',
          message: 'Permisos insuficientes para acceder a este recurso',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: rolesArray,
          userRole: req.user.role,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ Auth: Usuario ${req.user.email} (${req.user.role}) autorizado para: ${rolesArray.join(', ')}`);
      next();

    } catch (error) {
      console.error('💥 Error en middleware de autorización:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error interno en autorización',
        code: 'INTERNAL_AUTH_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Middleware para verificar que el recurso pertenece a la organización del usuario
 */
const checkOrganization = (req, res, next) => {
  try {
    // Solo aplicar si el usuario no es super_admin
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Verificar que el usuario tenga organización
    if (!req.user.organization) {
      return res.status(403).json({
        status: 'error',
        message: 'Usuario sin organización asignada',
        code: 'NO_ORGANIZATION',
        timestamp: new Date().toISOString()
      });
    }

    // El middleware específico de cada ruta debe verificar que el recurso
    // pertenece a req.user.organization._id
    req.userOrganizationId = req.user.organization._id;
    
    next();

  } catch (error) {
    console.error('💥 Error en verificación de organización:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error interno en verificación de organización',
      code: 'INTERNAL_ORG_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

// Roles disponibles
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

const userPermissions = {
  canRead: authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  canModify: authorize(['super_admin', 'admin']),
  canDelete: authorize(['super_admin', 'admin']),
  canManageRoles: authorize(['super_admin', 'admin']),
  canViewStats: authorize(['super_admin', 'admin'])
};

const reportPermissions = {
  canRead: authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  canCreate: authorize(['super_admin', 'admin', 'analyst']),
  canExport: authorize(['super_admin', 'admin', 'analyst']),
  canSchedule: authorize(['super_admin', 'admin'])
};

// Middleware de conveniencia para casos comunes
const requireAdmin = authorize(['super_admin', 'admin']);
const requireAnalyst = authorize(['super_admin', 'admin', 'analyst']);
const requireAnyRole = authorize(['super_admin', 'admin', 'analyst', 'viewer']);

// Exportar middleware principal como exportación por defecto
module.exports = authenticateToken;

// Exportar funciones adicionales
module.exports.authorize = authorize;
module.exports.checkOrganization = checkOrganization;
module.exports.assetPermissions = assetPermissions;
module.exports.userPermissions = userPermissions;
module.exports.reportPermissions = reportPermissions;
module.exports.requireAdmin = requireAdmin;
module.exports.requireAnalyst = requireAnalyst;
module.exports.requireAnyRole = requireAnyRole;
module.exports.ROLES = ROLES;