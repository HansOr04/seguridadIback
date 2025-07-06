// src/middleware/rbac.js

/**
 * Middleware RBAC (Role-Based Access Control) para SIGRISK-EC
 * Control de acceso basado en roles con permisos granulares
 */

// Definición de roles y jerarquía
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin', 
  ANALYST: 'analyst',
  VIEWER: 'viewer'
};

// Jerarquía de roles (roles superiores heredan permisos de inferiores)
const ROLE_HIERARCHY = {
  super_admin: ['super_admin', 'admin', 'analyst', 'viewer'],
  admin: ['admin', 'analyst', 'viewer'],
  analyst: ['analyst', 'viewer'],
  viewer: ['viewer']
};

// Permisos específicos por módulo
const PERMISSIONS = {
  // Permisos de activos
  ASSETS: {
    READ: ['super_admin', 'admin', 'analyst', 'viewer'],
    CREATE: ['super_admin', 'admin', 'analyst'],
    UPDATE: ['super_admin', 'admin', 'analyst'],
    DELETE: ['super_admin', 'admin'],
    VALUATE: ['super_admin', 'admin', 'analyst'],
    IMPORT_EXPORT: ['super_admin', 'admin', 'analyst'],
    MANAGE_DEPENDENCIES: ['super_admin', 'admin', 'analyst']
  },
  
  // Permisos de usuarios
  USERS: {
    READ: ['super_admin', 'admin', 'analyst'],
    CREATE: ['super_admin', 'admin'],
    UPDATE: ['super_admin', 'admin'],
    DELETE: ['super_admin', 'admin'],
    MANAGE_ROLES: ['super_admin', 'admin'],
    VIEW_STATS: ['super_admin', 'admin']
  },
  
  // Permisos de organización
  ORGANIZATION: {
    READ: ['super_admin', 'admin', 'analyst', 'viewer'],
    UPDATE: ['super_admin', 'admin'],
    MANAGE_SETTINGS: ['super_admin', 'admin'],
    VIEW_BILLING: ['super_admin', 'admin']
  },
  
  // Permisos de reportes
  REPORTS: {
    READ: ['super_admin', 'admin', 'analyst', 'viewer'],
    CREATE: ['super_admin', 'admin', 'analyst'],
    EXPORT: ['super_admin', 'admin', 'analyst'],
    SCHEDULE: ['super_admin', 'admin']
  },
  
  // Permisos de riesgos
  RISKS: {
    READ: ['super_admin', 'admin', 'analyst', 'viewer'],
    CREATE: ['super_admin', 'admin', 'analyst'],
    UPDATE: ['super_admin', 'admin', 'analyst'],
    DELETE: ['super_admin', 'admin'],
    CALCULATE: ['super_admin', 'admin', 'analyst']
  }
};

/**
 * Middleware principal de autorización basada en roles
 * @param {Array|String} allowedRoles - Roles permitidos para el endpoint
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
          code: 'UNAUTHENTICATED',
          timestamp: new Date().toISOString()
        });
      }

      // Verificar que el usuario tenga un rol asignado
      if (!req.user.role) {
        console.warn(`Usuario sin rol: ${req.user.email} (ID: ${req.user._id})`);
        return res.status(403).json({
          status: 'error',
          message: 'Usuario sin rol asignado. Contacte al administrador.',
          code: 'NO_ROLE_ASSIGNED',
          timestamp: new Date().toISOString()
        });
      }

      // Verificar que el usuario esté activo
      if (!req.user.isActive) {
        console.warn(`Usuario inactivo intentó acceder: ${req.user.email}`);
        return res.status(403).json({
          status: 'error',
          message: 'Cuenta de usuario desactivada',
          code: 'ACCOUNT_DISABLED',
          timestamp: new Date().toISOString()
        });
      }

      // Normalizar roles permitidos a array
      const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      // Si no se especifican roles, permitir acceso a usuarios autenticados
      if (rolesArray.length === 0) {
        return next();
      }

      // Verificar permisos usando jerarquía de roles
      const userRole = req.user.role;
      const userPermissions = ROLE_HIERARCHY[userRole] || [userRole];
      
      // Verificar si algún rol del usuario está en los roles permitidos
      const hasPermission = rolesArray.some(allowedRole => 
        userPermissions.includes(allowedRole)
      );
      
      if (!hasPermission) {
        // Log detallado para auditoría
        console.warn(`🚫 Acceso denegado: ${req.user.email} (${userRole}) → ${req.method} ${req.originalUrl}`);
        console.warn(`   Roles requeridos: [${rolesArray.join(', ')}]`);
        console.warn(`   Permisos usuario: [${userPermissions.join(', ')}]`);
        
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos suficientes para acceder a este recurso',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: {
            requiredRoles: rolesArray,
            userRole: userRole,
            resource: `${req.method} ${req.path}`
          },
          timestamp: new Date().toISOString()
        });
      }

      // Log de acceso exitoso (solo en desarrollo)
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Acceso autorizado: ${req.user.email} (${userRole}) → ${req.method} ${req.path}`);
      }

      // Agregar información de permisos al request para uso posterior
      req.userPermissions = {
        role: userRole,
        allPermissions: userPermissions,
        organizationId: req.user.organization
      };

      next();
    } catch (error) {
      console.error('❌ Error en middleware RBAC:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error interno en verificación de permisos',
        code: 'RBAC_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Verificar permiso específico para un módulo y acción
 * @param {String} module - Módulo (ej: 'ASSETS', 'USERS')
 * @param {String} action - Acción (ej: 'READ', 'CREATE')
 * @returns {Function} Middleware de Express
 */
const requirePermission = (module, action) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString()
        });
      }

      const userRole = req.user.role;
      const modulePermissions = PERMISSIONS[module];
      
      if (!modulePermissions) {
        console.error(`Módulo de permisos no encontrado: ${module}`);
        return res.status(500).json({
          status: 'error',
          message: 'Error en configuración de permisos',
          timestamp: new Date().toISOString()
        });
      }

      const actionPermissions = modulePermissions[action];
      
      if (!actionPermissions) {
        console.error(`Acción de permisos no encontrada: ${module}.${action}`);
        return res.status(500).json({
          status: 'error',
          message: 'Error en configuración de permisos',
          timestamp: new Date().toISOString()
        });
      }

      const hasPermission = actionPermissions.includes(userRole);
      
      if (!hasPermission) {
        console.warn(`🚫 Permiso denegado: ${req.user.email} (${userRole}) → ${module}.${action}`);
        
        return res.status(403).json({
          status: 'error',
          message: `No tienes permisos para realizar la acción '${action}' en el módulo '${module}'`,
          code: 'ACTION_NOT_PERMITTED',
          details: {
            module,
            action,
            userRole,
            requiredRoles: actionPermissions
          },
          timestamp: new Date().toISOString()
        });
      }

      next();
    } catch (error) {
      console.error('❌ Error verificando permiso específico:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error interno en verificación de permisos',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Middleware para verificar que el usuario pertenece a la misma organización
 * @param {Function} getOrganizationId - Función para extraer organizationId del request
 * @returns {Function} Middleware de Express
 */
const requireSameOrganization = (getOrganizationId = null) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Usuario no autenticado',
          timestamp: new Date().toISOString()
        });
      }

      // Extraer organizationId del request
      let targetOrganizationId;
      
      if (getOrganizationId && typeof getOrganizationId === 'function') {
        targetOrganizationId = getOrganizationId(req);
      } else if (req.params.organizationId) {
        targetOrganizationId = req.params.organizationId;
      } else if (req.body.organization) {
        targetOrganizationId = req.body.organization;
      } else {
        // Si no se puede determinar la organización, permitir acceso
        // (será manejado por filtros en los controladores)
        return next();
      }

      const userOrganizationId = req.user.organization.toString();
      
      // Super admin puede acceder a cualquier organización
      if (req.user.role === ROLES.SUPER_ADMIN) {
        return next();
      }

      // Verificar que pertenezcan a la misma organización
      if (userOrganizationId !== targetOrganizationId.toString()) {
        console.warn(`🚫 Acceso cross-organization denegado: ${req.user.email} (${userOrganizationId}) → ${targetOrganizationId}`);
        
        return res.status(403).json({
          status: 'error',
          message: 'No tienes permisos para acceder a recursos de otra organización',
          code: 'CROSS_ORGANIZATION_ACCESS_DENIED',
          timestamp: new Date().toISOString()
        });
      }

      next();
    } catch (error) {
      console.error('❌ Error verificando organización:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Error interno en verificación de organización',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Verificar si el usuario tiene un rol específico
 * @param {String} userRole - Rol del usuario
 * @param {String|Array} requiredRoles - Rol(es) requerido(s)
 * @returns {Boolean} True si tiene permisos
 */
const hasRole = (userRole, requiredRoles) => {
  const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  const userPermissions = ROLE_HIERARCHY[userRole] || [userRole];
  
  return rolesArray.some(role => userPermissions.includes(role));
};

/**
 * Verificar si el usuario puede realizar una acción específica
 * @param {String} userRole - Rol del usuario
 * @param {String} module - Módulo
 * @param {String} action - Acción
 * @returns {Boolean} True si tiene permisos
 */
const canPerformAction = (userRole, module, action) => {
  const modulePermissions = PERMISSIONS[module];
  if (!modulePermissions) return false;
  
  const actionPermissions = modulePermissions[action];
  if (!actionPermissions) return false;
  
  return actionPermissions.includes(userRole);
};

// Permisos predefinidos para módulos comunes
const assetPermissions = {
  canRead: authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  canModify: authorize(['super_admin', 'admin', 'analyst']),
  canDelete: authorize(['super_admin', 'admin']),
  canImportExport: authorize(['super_admin', 'admin', 'analyst']),
  canValuate: authorize(['super_admin', 'admin', 'analyst']),
  canManageDependencies: authorize(['super_admin', 'admin', 'analyst'])
};

const userPermissions = {
  canRead: authorize(['super_admin', 'admin', 'analyst']),
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

const riskPermissions = {
  canRead: authorize(['super_admin', 'admin', 'analyst', 'viewer']),
  canModify: authorize(['super_admin', 'admin', 'analyst']),
  canDelete: authorize(['super_admin', 'admin']),
  canCalculate: authorize(['super_admin', 'admin', 'analyst'])
};

// Middleware de conveniencia para casos comunes
const requireAdmin = authorize(['super_admin', 'admin']);
const requireAnalyst = authorize(['super_admin', 'admin', 'analyst']);
const requireAnyRole = authorize(['super_admin', 'admin', 'analyst', 'viewer']);

module.exports = {
  // Función principal
  authorize,
  
  // Funciones específicas
  requirePermission,
  requireSameOrganization,
  hasRole,
  canPerformAction,
  
  // Permisos predefinidos
  assetPermissions,
  userPermissions,
  reportPermissions,
  riskPermissions,
  
  // Middleware de conveniencia
  requireAdmin,
  requireAnalyst,
  requireAnyRole,
  
  // Constantes
  ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS
};