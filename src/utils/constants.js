module.exports = {
  // Roles de usuario
  USER_ROLES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    ANALYST: 'analyst',
    VIEWER: 'viewer'
  },

  // Tipos de organización
  ORGANIZATION_TYPES: {
    COMERCIAL: 'comercial',
    FINANCIERA: 'financiera',
    SALUD: 'salud',
    EDUCATIVA: 'educativa',
    GUBERNAMENTAL: 'gubernamental',
    MANUFACTURA: 'manufactura',
    SERVICIOS: 'servicios',
    TECNOLOGIA: 'tecnologia',
    ONG: 'ong',
    OTRO: 'otro'
  },

  // Sectores
  ORGANIZATION_SECTORS: {
    PUBLICO: 'publico',
    PRIVADO: 'privado',
    MIXTO: 'mixto'
  },

  // Tamaños de empresa
  ORGANIZATION_SIZES: {
    MICRO: 'micro',
    PEQUENA: 'pequena',
    MEDIANA: 'mediana',
    GRANDE: 'grande'
  },

  // Respuestas de API
  API_RESPONSES: {
    SUCCESS: 'success',
    ERROR: 'error',
    FAIL: 'fail'
  },

  // Códigos de estado HTTP
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500
  },

  // Límites por defecto
  DEFAULT_LIMITS: {
    MAX_USERS_FREE: 5,
    MAX_USERS_BASIC: 25,
    MAX_USERS_PROFESSIONAL: 100,
    MAX_USERS_ENTERPRISE: 500,
    MAX_ASSETS_FREE: 100,
    MAX_ASSETS_BASIC: 1000,
    MAX_ASSETS_PROFESSIONAL: 5000,
    MAX_ASSETS_ENTERPRISE: 25000,
    PAGINATION_LIMIT: 25,
    MAX_PAGINATION_LIMIT: 100
  },

  // Configuración de seguridad
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_TIME: 2 * 60 * 60 * 1000, // 2 horas
    PASSWORD_RESET_EXPIRES: 10 * 60 * 1000, // 10 minutos
    EMAIL_VERIFICATION_EXPIRES: 24 * 60 * 60 * 1000 // 24 horas
  }
};