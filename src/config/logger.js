// config/logger.js
const path = require('path');

const loggerConfig = {
  // Configuración general
  enabled: true,
  
  // Configuración de archivos
  files: {
    enabled: true,
    directory: path.join(__dirname, '../logs'),
    maxSize: '50mb', // Tamaño máximo por archivo
    maxFiles: 10,    // Número máximo de archivos rotados
    datePattern: 'YYYY-MM-DD',
    
    // Tipos de archivos de log
    types: {
      access: {
        enabled: true,
        filename: 'access-%DATE%.log',
        level: 'info'
      },
      error: {
        enabled: true,
        filename: 'error-%DATE%.log',
        level: 'error'
      },
      warning: {
        enabled: true,
        filename: 'warning-%DATE%.log',
        level: 'warn'
      },
      security: {
        enabled: true,
        filename: 'security-%DATE%.log',
        level: 'info'
      },
      detailed: {
        enabled: process.env.NODE_ENV === 'development',
        filename: 'detailed-%DATE%.log',
        level: 'debug'
      },
      app: {
        enabled: true,
        filename: 'app-%DATE%.log',
        level: 'info'
      }
    }
  },
  
  // Configuración de consola
  console: {
    enabled: true,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    colorize: true,
    timestamp: true,
    format: 'simple' // 'simple', 'detailed', 'json'
  },
  
  // Configuración de filtros
  filters: {
    // Excluir URLs específicas del logging
    excludeUrls: [
      '/health',
      '/favicon.ico',
      '/robots.txt'
    ],
    
    // Excluir User-Agents específicos
    excludeUserAgents: [
      'kube-probe',
      'ELB-HealthChecker'
    ],
    
    // Filtrar información sensible
    sensitiveFields: [
      'password',
      'token',
      'authorization',
      'cookie',
      'x-api-key'
    ]
  },
  
  // Configuración de retención
  retention: {
    enabled: true,
    days: process.env.LOG_RETENTION_DAYS || 30,
    
    // Configuración por tipo de log
    byType: {
      access: 7,      // Logs de acceso se mantienen 7 días
      error: 90,      // Logs de error se mantienen 90 días
      security: 365,  // Logs de seguridad se mantienen 1 año
      detailed: 3,    // Logs detallados solo 3 días
      app: 30         // Logs de aplicación 30 días
    }
  },
  
  // Configuración de performance
  performance: {
    // Tiempo de respuesta mínimo para logear (ms)
    minResponseTime: 0,
    
    // Tiempo de respuesta que se considera lento (ms)
    slowResponseThreshold: 5000,
    
    // Tamaño máximo de body para logear (bytes)
    maxBodySize: 1024 * 10, // 10KB
    
    // Buffer de logs para escritura asíncrona
    bufferSize: 100,
    flushInterval: 5000 // 5 segundos
  },
  
  // Configuración específica para SIGRISK-EC
  sigrisk: {
    // Módulos que requieren logging especial
    securityModules: [
      '/api/risks',
      '/api/assets',
      '/api/vulnerabilities',
      '/api/threats',
      '/api/treatments',
      '/api/controls'
    ],
    
    // Acciones críticas que siempre se logean
    criticalActions: [
      'DELETE',
      'POST /api/users',
      'POST /api/organizations',
      'PUT /api/risks',
      'DELETE /api/assets'
    ],
    
    // Información adicional para logs de seguridad
    securityFields: [
      'userId',
      'organization',
      'riskLevel',
      'assetType',
      'threatCategory'
    ]
  },
  
  // Configuración de alertas
  alerts: {
    enabled: process.env.NODE_ENV === 'production',
    
    // Configuración de email (opcional)
    email: {
      enabled: false,
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      from: process.env.ALERT_FROM_EMAIL,
      to: process.env.ALERT_TO_EMAIL?.split(',') || []
    },
    
    // Configuración de Slack (opcional)
    slack: {
      enabled: false,
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || '#alerts'
    },
    
    // Condiciones para alertas
    conditions: {
      errorRate: {
        threshold: 10,     // 10 errores por minuto
        window: 60000      // Ventana de 1 minuto
      },
      responseTime: {
        threshold: 10000,  // 10 segundos
        consecutiveCount: 5
      },
      criticalErrors: {
        immediate: true,   // Alerta inmediata para errores críticos
        patterns: [
          'Database connection failed',
          'Authentication failed',
          'Rate limit exceeded'
        ]
      }
    }
  },
  
  // Configuración de métricas
  metrics: {
    enabled: true,
    
    // Métricas a recopilar
    collect: {
      requestCount: true,
      responseTime: true,
      errorRate: true,
      topEndpoints: true,
      topUsers: true,
      topErrors: true
    },
    
    // Intervalo de agregación de métricas
    aggregateInterval: 60000, // 1 minuto
    
    // Retención de métricas
    retention: {
      minutes: 60,    // Datos por minuto: 1 hora
      hours: 24,      // Datos por hora: 24 horas
      days: 30        // Datos por día: 30 días
    }
  },
  
  // Configuración de desarrollo
  development: {
    enabled: process.env.NODE_ENV === 'development',
    
    // Logging extra en desarrollo
    extra: {
      requestHeaders: true,
      requestBody: true,
      responseBody: true,
      queryParams: true,
      stackTrace: true
    },
    
    // Colores para diferentes tipos de logs
    colors: {
      info: 'blue',
      warn: 'yellow',
      error: 'red',
      debug: 'cyan',
      success: 'green'
    }
  }
};

module.exports = loggerConfig;