const cron = require('node-cron');
const Monitoring = require('../models/Monitoring');
const Report = require('../models/Report');

class CronJobService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
    this.runningTasks = new Map(); // Prevenir ejecuciones simultáneas
    this.lastExecution = new Map(); // Control de frecuencia
    this.instanceId = `cron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🆔 CronJobService instancia creada: ${this.instanceId}`);
  }

  // Inicializar todos los trabajos cron CON VERIFICACIONES
  initialize() {
    if (this.isInitialized) {
      console.log(`⚠️  Cron jobs ya están inicializados para instancia ${this.instanceId}`);
      return;
    }

    try {
      console.log(`🚀 Inicializando cron jobs - Instancia: ${this.instanceId}`);
      
      // SOLO ejecutar en producción O desarrollo específico
      if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON_DEV === 'true') {
        
        // Verificar que no hay otra instancia ejecutándose
        if (!this.verifyExclusiveInstance()) {
          console.log('⚠️  Otra instancia de cron jobs detectada, omitiendo inicialización');
          return;
        }

        // Ejecutar monitoreos pendientes cada 10 minutos (reducido de 5)
        this.scheduleMonitoringExecution();
        
        // Generar reportes programados cada 2 horas (reducido de 1)
        this.scheduleReportGeneration();
        
        // Limpieza de archivos temporales diariamente a las 2 AM
        this.scheduleCleanup();
        
        // Verificar estado del sistema cada 1 hora (reducido de 30 min)
        this.scheduleHealthCheck();

        this.isInitialized = true;
        console.log(`✅ Cron jobs inicializados exitosamente - Instancia: ${this.instanceId}`);
      } else {
        console.log('🚫 Cron jobs deshabilitados en desarrollo (usar ENABLE_CRON_DEV=true para habilitar)');
      }
    } catch (error) {
      console.error(`❌ Error al inicializar cron jobs - Instancia ${this.instanceId}:`, error);
    }
  }

  // Verificar que solo hay una instancia ejecutando cron jobs
  verifyExclusiveInstance() {
    const lockKey = 'cron_instance_lock';
    const lockFile = require('path').join(process.cwd(), '.cron.lock');
    const fs = require('fs');

    try {
      // Verificar si existe un lock file y si es reciente (< 30 minutos)
      if (fs.existsSync(lockFile)) {
        const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
        const lockAge = Date.now() - lockData.timestamp;
        
        // Si el lock es reciente (< 30 minutos), no ejecutar
        if (lockAge < 30 * 60 * 1000) {
          console.log(`🔒 Lock file existe y es reciente (${Math.round(lockAge / 1000)}s), omitiendo cron jobs`);
          return false;
        } else {
          console.log(`🗑️  Lock file antiguo encontrado, eliminando...`);
          fs.unlinkSync(lockFile);
        }
      }

      // Crear nuevo lock file
      fs.writeFileSync(lockFile, JSON.stringify({
        instanceId: this.instanceId,
        timestamp: Date.now(),
        pid: process.pid
      }));

      console.log(`🔐 Lock file creado para instancia ${this.instanceId}`);
      return true;
    } catch (error) {
      console.error('Error verificando instancia exclusiva:', error);
      return false; // En caso de error, no ejecutar para evitar conflictos
    }
  }

  // Verificar si una tarea ya se está ejecutando
  isTaskRunning(taskName) {
    return this.runningTasks.has(taskName);
  }

  // Marcar tarea como en ejecución
  markTaskRunning(taskName) {
    this.runningTasks.set(taskName, Date.now());
  }

  // Marcar tarea como completada
  markTaskCompleted(taskName) {
    this.runningTasks.delete(taskName);
    this.lastExecution.set(taskName, Date.now());
  }

  // Verificar si una tarea debe ejecutarse (respetando intervalo mínimo)
  shouldExecuteTask(taskName, minIntervalMinutes = 5) {
    const lastExec = this.lastExecution.get(taskName);
    if (!lastExec) return true;
    
    const timeSinceLastExec = Date.now() - lastExec;
    const minInterval = minIntervalMinutes * 60 * 1000;
    
    return timeSinceLastExec >= minInterval;
  }

  // Programar ejecución de monitoreos (OPTIMIZADO)
  scheduleMonitoringExecution() {
    const taskName = 'monitoring-execution';
    const job = cron.schedule('*/10 * * * *', async () => { // Cada 10 minutos
      try {
        // Verificaciones previas
        if (this.isTaskRunning(taskName)) {
          console.log(`⏭️  Omitiendo ${taskName} - ya en ejecución`);
          return;
        }

        if (!this.shouldExecuteTask(taskName, 8)) { // Mínimo 8 minutos entre ejecuciones
          console.log(`⏭️  Omitiendo ${taskName} - ejecutado recientemente`);
          return;
        }

        this.markTaskRunning(taskName);
        console.log(`🔍 Verificando monitoreos pendientes... [${this.instanceId}]`);
        
        // Solo buscar monitoreos que realmente necesitan ejecutarse
        const now = new Date();
        const pendingMonitorings = await Monitoring.find({
          status: 'active',
          isActive: true,
          $and: [
            {
              $or: [
                { nextExecution: { $lte: now } },
                { nextExecution: null }
              ]
            },
            {
              $or: [
                { lastExecution: null },
                { lastExecution: { $lte: new Date(now.getTime() - 5 * 60 * 1000) } } // Mínimo 5 min desde última ejecución
              ]
            }
          ]
        }).populate('organization').limit(10); // Limitar a 10 para evitar sobrecarga

        console.log(`📊 Encontrados ${pendingMonitorings.length} monitoreos pendientes reales`);

        if (pendingMonitorings.length === 0) {
          this.markTaskCompleted(taskName);
          return;
        }

        // Procesar en paralelo pero limitado
        const promises = pendingMonitorings.map(monitoring => 
          this.executeMonitoringWithTimeout(monitoring)
        );

        const results = await Promise.allSettled(promises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`✅ Monitoreos ejecutados: ${successful} exitosos, ${failed} fallidos`);
        
      } catch (error) {
        console.error(`❌ Error en job de monitoreo [${this.instanceId}]:`, error);
      } finally {
        this.markTaskCompleted(taskName);
      }
    }, {
      scheduled: false
    });

    this.jobs.set(taskName, job);
    job.start();
    console.log(`📅 Job de ejecución de monitoreos programado (cada 10 minutos) - ${this.instanceId}`);
  }

  // Ejecutar monitoreo con timeout para evitar colgados
  async executeMonitoringWithTimeout(monitoring, timeoutMs = 30000) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout ejecutando monitoreo ${monitoring.name}`));
      }, timeoutMs);

      try {
        await this.executeMonitoring(monitoring);
        clearTimeout(timeout);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // Programar generación de reportes (OPTIMIZADO)
  scheduleReportGeneration() {
    const taskName = 'report-generation';
    const job = cron.schedule('0 */2 * * *', async () => { // Cada 2 horas
      try {
        if (this.isTaskRunning(taskName)) {
          console.log(`⏭️  Omitiendo ${taskName} - ya en ejecución`);
          return;
        }

        if (!this.shouldExecuteTask(taskName, 100)) { // Mínimo 100 minutos entre ejecuciones
          console.log(`⏭️  Omitiendo ${taskName} - ejecutado recientemente`);
          return;
        }

        this.markTaskRunning(taskName);
        console.log(`📄 Verificando reportes programados... [${this.instanceId}]`);
        
        const now = new Date();
        const pendingReports = await Report.find({
          status: 'scheduled',
          isActive: true,
          scheduledDate: { $lte: now }
        }).populate('organization generatedBy').limit(5); // Máximo 5 reportes por ejecución

        console.log(`📋 Encontrados ${pendingReports.length} reportes programados`);

        if (pendingReports.length === 0) {
          this.markTaskCompleted(taskName);
          return;
        }

        // Procesar secuencialmente para evitar sobrecarga
        for (const report of pendingReports) {
          try {
            await this.generateScheduledReport(report);
          } catch (genError) {
            console.error(`❌ Error generando reporte ${report.name}:`, genError.message);
            
            // Marcar reporte con error
            report.status = 'error';
            await report.save();
          }
        }
      } catch (error) {
        console.error(`❌ Error en job de reportes [${this.instanceId}]:`, error);
      } finally {
        this.markTaskCompleted(taskName);
      }
    }, {
      scheduled: false
    });

    this.jobs.set(taskName, job);
    job.start();
    console.log(`📅 Job de generación de reportes programado (cada 2 horas) - ${this.instanceId}`);
  }

  // Programar limpieza de archivos (OPTIMIZADO)
  scheduleCleanup() {
    const taskName = 'cleanup';
    const job = cron.schedule('0 2 * * *', async () => { // Diariamente a las 2 AM
      try {
        if (this.isTaskRunning(taskName)) {
          console.log(`⏭️  Omitiendo ${taskName} - ya en ejecución`);
          return;
        }

        if (!this.shouldExecuteTask(taskName, 20 * 60)) { // Mínimo 20 horas entre limpiezas
          console.log(`⏭️  Omitiendo ${taskName} - ejecutado recientemente`);
          return;
        }

        this.markTaskRunning(taskName);
        console.log(`🧹 Iniciando limpieza de archivos temporales... [${this.instanceId}]`);
        
        await this.performCleanup();
        
      } catch (error) {
        console.error(`❌ Error en limpieza [${this.instanceId}]:`, error);
      } finally {
        this.markTaskCompleted(taskName);
      }
    }, {
      scheduled: false
    });

    this.jobs.set(taskName, job);
    job.start();
    console.log(`📅 Job de limpieza programado (diariamente a las 2 AM) - ${this.instanceId}`);
  }

  // Programar verificación de salud del sistema (OPTIMIZADO)
  scheduleHealthCheck() {
    const taskName = 'health-check';
    const job = cron.schedule('0 * * * *', async () => { // Cada hora
      try {
        if (this.isTaskRunning(taskName)) {
          console.log(`⏭️  Omitiendo ${taskName} - ya en ejecución`);
          return;
        }

        if (!this.shouldExecuteTask(taskName, 50)) { // Mínimo 50 minutos entre verificaciones
          console.log(`⏭️  Omitiendo ${taskName} - ejecutado recientemente`);
          return;
        }

        this.markTaskRunning(taskName);
        console.log(`🏥 Verificando salud del sistema... [${this.instanceId}]`);
        
        await this.performHealthCheck();
        
      } catch (error) {
        console.error(`❌ Error en verificación de salud [${this.instanceId}]:`, error);
      } finally {
        this.markTaskCompleted(taskName);
      }
    }, {
      scheduled: false
    });

    this.jobs.set(taskName, job);
    job.start();
    console.log(`📅 Job de verificación de salud programado (cada hora) - ${this.instanceId}`);
  }

  // Lógica de limpieza separada
  async performCleanup() {
    const fs = require('fs');
    const path = require('path');
    
    // Limpiar archivos de reportes antiguos (más de 30 días)
    const reportsDir = path.join(process.cwd(), 'uploads/reports');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(reportsDir, file);
        try {
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < thirtyDaysAgo) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (err) {
          console.warn(`⚠️  Error procesando archivo ${file}:`, err.message);
        }
      }

      console.log(`🗑️  Eliminados ${deletedCount} archivos antiguos`);
    }

    // Limpiar registros de monitoreo antiguos (mantener solo últimos 1000 resultados)
    const monitorings = await Monitoring.find({ isActive: true });
    
    for (const monitoring of monitorings) {
      if (monitoring.results && monitoring.results.length > 1000) {
        monitoring.results = monitoring.results.slice(-1000);
        await monitoring.save();
      }
    }

    // Limpiar lock file si es muy antiguo
    const lockFile = path.join(process.cwd(), '.cron.lock');
    if (fs.existsSync(lockFile)) {
      try {
        const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
        const lockAge = Date.now() - lockData.timestamp;
        
        if (lockAge > 60 * 60 * 1000) { // 1 hora
          fs.unlinkSync(lockFile);
          console.log('🔓 Lock file antiguo eliminado durante limpieza');
        }
      } catch (err) {
        fs.unlinkSync(lockFile); // Eliminar si está corrupto
        console.log('🔓 Lock file corrupto eliminado');
      }
    }

    console.log('✅ Limpieza completada');
  }

  // Lógica de health check separada
  async performHealthCheck() {
    const mongoose = require('mongoose');
    
    // Verificar conexión a base de datos
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ Base de datos desconectada');
      return;
    }

    // Verificar monitoreos con errores frecuentes
    const problematicMonitorings = await Monitoring.find({
      isActive: true,
      'metrics.totalExecutions': { $gt: 10 },
      $expr: {
        $gt: [
          { $divide: ['$metrics.failedExecutions', '$metrics.totalExecutions'] },
          0.5
        ]
      }
    });

    if (problematicMonitorings.length > 0) {
      console.warn(`⚠️  ${problematicMonitorings.length} monitoreos con alta tasa de fallos detectados`);
    }

    // Verificar espacio en disco para reportes (simplificado)
    const fs = require('fs');
    const reportsDir = 'uploads/reports';
    
    if (fs.existsSync(reportsDir)) {
      try {
        const files = fs.readdirSync(reportsDir);
        const totalSize = files.reduce((acc, file) => {
          try {
            const stats = fs.statSync(`${reportsDir}/${file}`);
            return acc + stats.size;
          } catch {
            return acc;
          }
        }, 0);

        const totalSizeMB = totalSize / (1024 * 1024);
        if (totalSizeMB > 1000) { // Más de 1GB
          console.warn(`⚠️  Directorio de reportes ocupa ${totalSizeMB.toFixed(2)} MB`);
        }
      } catch (err) {
        console.warn('⚠️  Error verificando espacio en disco:', err.message);
      }
    }

    console.log('✅ Verificación de salud completada');
  }

  // Ejecutar monitoreo específico (MISMO CÓDIGO ORIGINAL)
  async executeMonitoring(monitoring) {
    console.log(`🔄 Ejecutando monitoreo: ${monitoring.name}`);
    
    const startTime = Date.now();
    let result = { status: 'success', score: 100, message: 'Ejecución exitosa' };

    try {
      // Simular ejecución basada en el tipo
      switch (monitoring.type) {
        case 'risk_assessment':
          result = await this.simulateRiskAssessment(monitoring);
          break;
        case 'control_testing':
          result = await this.simulateControlTesting(monitoring);
          break;
        case 'vulnerability_scan':
          result = await this.simulateVulnerabilityScan(monitoring);
          break;
        case 'compliance_check':
          result = await this.simulateComplianceCheck(monitoring);
          break;
        case 'kpi_monitoring':
          result = await this.simulateKPIMonitoring(monitoring);
          break;
        default:
          result = { status: 'error', score: 0, message: 'Tipo de monitoreo no válido' };
      }
    } catch (execError) {
      result = { 
        status: 'error', 
        score: 0, 
        message: `Error en ejecución: ${execError.message}` 
      };
    }

    const executionTime = Date.now() - startTime;
    
    // Registrar resultado
    await monitoring.addResult(
      result.status,
      result.score,
      result.message,
      result.details,
      executionTime
    );

    // Programar siguiente ejecución
    await monitoring.scheduleNext();

    console.log(`✅ Monitoreo ${monitoring.name} ejecutado: ${result.status} (${result.score}%)`);
  }

  // Generar reporte programado (MISMO CÓDIGO ORIGINAL)
  async generateScheduledReport(report) {
    console.log(`📄 Generando reporte programado: ${report.name}`);
    
    // Aquí iría la lógica de generación del reporte
    // Por simplicidad, marcamos como completado
    report.status = 'completed';
    report.generatedDate = new Date();
    
    // Programar siguiente generación si es recurrente
    if (report.frequency !== 'once') {
      await report.scheduleNext();
    }
    
    await report.save();
    console.log(`✅ Reporte ${report.name} generado exitosamente`);
  }

  // Simulaciones de monitoreo (MISMO CÓDIGO ORIGINAL)
  async simulateRiskAssessment(monitoring) {
    const score = Math.floor(Math.random() * 40) + 60; // 60-100
    return {
      status: score >= 80 ? 'success' : 'warning',
      score,
      message: `Evaluación de riesgos completada. Puntuación: ${score}%`,
      details: { simulatedExecution: true }
    };
  }

  async simulateControlTesting(monitoring) {
    const score = Math.floor(Math.random() * 30) + 70; // 70-100
    return {
      status: score >= 85 ? 'success' : 'warning',
      score,
      message: `Prueba de controles completada. Efectividad: ${score}%`,
      details: { simulatedExecution: true }
    };
  }

  async simulateVulnerabilityScan(monitoring) {
    const vulnerabilities = Math.floor(Math.random() * 10);
    const score = Math.max(50, 100 - (vulnerabilities * 5));
    return {
      status: vulnerabilities <= 2 ? 'success' : vulnerabilities <= 5 ? 'warning' : 'error',
      score,
      message: `Escaneo completado. ${vulnerabilities} vulnerabilidades encontradas`,
      details: { vulnerabilities, simulatedExecution: true }
    };
  }

  async simulateComplianceCheck(monitoring) {
    const compliance = Math.floor(Math.random() * 30) + 70; // 70-100
    return {
      status: compliance >= 90 ? 'success' : compliance >= 80 ? 'warning' : 'error',
      score: compliance,
      message: `Verificación de cumplimiento: ${compliance}%`,
      details: { compliance, simulatedExecution: true }
    };
  }

  async simulateKPIMonitoring(monitoring) {
    const kpiScore = Math.floor(Math.random() * 40) + 60; // 60-100
    return {
      status: kpiScore >= 80 ? 'success' : 'info',
      score: kpiScore,
      message: `KPIs actualizados. Estado del sistema: ${kpiScore}%`,
      details: { kpiScore, simulatedExecution: true }
    };
  }

  // Detener todos los trabajos
  stopAll() {
    console.log(`🛑 Deteniendo todos los cron jobs... [${this.instanceId}]`);
    
    for (const [name, job] of this.jobs) {
      try {
        job.stop();
        console.log(`⏹️  Job ${name} detenido`);
      } catch (error) {
        console.warn(`⚠️  Error deteniendo job ${name}:`, error.message);
      }
    }
    
    this.jobs.clear();
    this.runningTasks.clear();
    this.lastExecution.clear();
    this.isInitialized = false;

    // Limpiar lock file al detener
    try {
      const fs = require('fs');
      const lockFile = require('path').join(process.cwd(), '.cron.lock');
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        console.log(`🔓 Lock file eliminado para instancia ${this.instanceId}`);
      }
    } catch (error) {
      console.warn('⚠️  Error eliminando lock file:', error.message);
    }
    
    console.log(`✅ Todos los cron jobs detenidos [${this.instanceId}]`);
  }

  // Obtener estado de los trabajos
  getStatus() {
    const status = {};
    
    for (const [name, job] of this.jobs) {
      const isRunning = this.isTaskRunning(name);
      const lastExec = this.lastExecution.get(name);
      
      status[name] = {
        running: job.running,
        scheduled: job.scheduled,
        executing: isRunning,
        lastExecution: lastExec ? new Date(lastExec).toISOString() : null,
        nextShouldRun: this.shouldExecuteTask(name)
      };
    }
    
    return {
      initialized: this.isInitialized,
      instanceId: this.instanceId,
      totalJobs: this.jobs.size,
      runningTasks: this.runningTasks.size,
      jobs: status
    };
  }
}

// Exportar instancia singleton
module.exports = new CronJobService();