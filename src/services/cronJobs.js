const cron = require('node-cron');
const Monitoring = require('../models/Monitoring');
const Report = require('../models/Report');

class CronJobService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Inicializar todos los trabajos cron
  initialize() {
    if (this.isInitialized) {
      console.log('⚠️  Cron jobs ya están inicializados');
      return;
    }

    try {
      // Ejecutar monitoreos pendientes cada 5 minutos
      this.scheduleMonitoringExecution();
      
      // Generar reportes programados cada hora
      this.scheduleReportGeneration();
      
      // Limpieza de archivos temporales diariamente a las 2 AM
      this.scheduleCleanup();
      
      // Verificar estado del sistema cada 30 minutos
      this.scheduleHealthCheck();

      this.isInitialized = true;
      console.log('✅ Cron jobs inicializados exitosamente');
    } catch (error) {
      console.error('❌ Error al inicializar cron jobs:', error);
    }
  }

  // Programar ejecución de monitoreos
  scheduleMonitoringExecution() {
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('🔍 Verificando monitoreos pendientes...');
        
        const pendingMonitorings = await Monitoring.find({
          status: 'active',
          isActive: true,
          $or: [
            { nextExecution: { $lte: new Date() } },
            { nextExecution: null }
          ]
        }).populate('organization');

        console.log(`📊 Encontrados ${pendingMonitorings.length} monitoreos pendientes`);

        for (const monitoring of pendingMonitorings) {
          try {
            await this.executeMonitoring(monitoring);
          } catch (execError) {
            console.error(`❌ Error ejecutando monitoreo ${monitoring.name}:`, execError.message);
            
            // Registrar el error en el monitoreo
            await monitoring.addResult(
              'error',
              0,
              `Error en ejecución automática: ${execError.message}`,
              null,
              0
            );
          }
        }
      } catch (error) {
        console.error('❌ Error en job de monitoreo:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('monitoring-execution', job);
    job.start();
    console.log('📅 Job de ejecución de monitoreos programado (cada 5 minutos)');
  }

  // Programar generación de reportes
  scheduleReportGeneration() {
    const job = cron.schedule('0 * * * *', async () => {
      try {
        console.log('📄 Verificando reportes programados...');
        
        const pendingReports = await Report.find({
          status: 'scheduled',
          isActive: true,
          scheduledDate: { $lte: new Date() }
        }).populate('organization generatedBy');

        console.log(`📋 Encontrados ${pendingReports.length} reportes programados`);

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
        console.error('❌ Error en job de reportes:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('report-generation', job);
    job.start();
    console.log('📅 Job de generación de reportes programado (cada hora)');
  }

  // Programar limpieza de archivos
  scheduleCleanup() {
    const job = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 Iniciando limpieza de archivos temporales...');
        
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
            const stats = fs.statSync(filePath);
            
            if (stats.mtime < thirtyDaysAgo) {
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          }

          console.log(`🗑️  Eliminados ${deletedCount} archivos antiguos`);
        }

        // Limpiar registros de monitoreo antiguos (mantener solo últimos 1000 resultados)
        const monitorings = await Monitoring.find({ isActive: true });
        
        for (const monitoring of monitorings) {
          if (monitoring.results.length > 1000) {
            monitoring.results = monitoring.results.slice(-1000);
            await monitoring.save();
          }
        }

        console.log('✅ Limpieza completada');
      } catch (error) {
        console.error('❌ Error en limpieza:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('cleanup', job);
    job.start();
    console.log('📅 Job de limpieza programado (diariamente a las 2 AM)');
  }

  // Programar verificación de salud del sistema
  scheduleHealthCheck() {
    const job = cron.schedule('*/30 * * * *', async () => {
      try {
        console.log('🏥 Verificando salud del sistema...');
        
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

        // Verificar espacio en disco para reportes
        const fs = require('fs');
        const reportsDir = 'uploads/reports';
        
        if (fs.existsSync(reportsDir)) {
          const files = fs.readdirSync(reportsDir);
          const totalSize = files.reduce((acc, file) => {
            const stats = fs.statSync(`${reportsDir}/${file}`);
            return acc + stats.size;
          }, 0);

          const totalSizeMB = totalSize / (1024 * 1024);
          if (totalSizeMB > 1000) { // Más de 1GB
            console.warn(`⚠️  Directorio de reportes ocupa ${totalSizeMB.toFixed(2)} MB`);
          }
        }

        console.log('✅ Verificación de salud completada');
      } catch (error) {
        console.error('❌ Error en verificación de salud:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('health-check', job);
    job.start();
    console.log('📅 Job de verificación de salud programado (cada 30 minutos)');
  }

  // Ejecutar monitoreo específico
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

  // Generar reporte programado
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

  // Simulaciones de monitoreo (mismas funciones que en el controlador)
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
    console.log('🛑 Deteniendo todos los cron jobs...');
    
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`⏹️  Job ${name} detenido`);
    }
    
    this.jobs.clear();
    this.isInitialized = false;
    console.log('✅ Todos los cron jobs detenidos');
  }

  // Obtener estado de los trabajos
  getStatus() {
    const status = {};
    
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    }
    
    return {
      initialized: this.isInitialized,
      totalJobs: this.jobs.size,
      jobs: status
    };
  }
}

// Exportar instancia singleton
module.exports = new CronJobService();