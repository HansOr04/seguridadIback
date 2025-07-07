const { validationResult } = require('express-validator');
const CVE = require('../models/CVE');
const CVEIntegrationService = require('../services/cveIntegrationService');
const Asset = require('../models/Asset');

/**
 * Controlador para gestión completa de CVE/NVD
 */
class CVEController {

  /**
   * @desc    Obtener dashboard de CVEs organizacional
   * @route   GET /api/cve/dashboard
   * @access  Private (admin, analyst)
   */
  static async getDashboard(req, res) {
    try {
      const organizationId = req.user.organization;

      // Obtener estadísticas generales
      const stats = await CVE.getOrganizationStats(organizationId);
      
      // Obtener CVEs críticos recientes (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const criticalRecent = await CVE.find({
        'organizationalImpact.organization': organizationId,
        'cvssV3.baseSeverity': 'critical',
        publishedDate: { $gte: thirtyDaysAgo }
      })
      .sort({ 'cvssV3.baseScore': -1 })
      .limit(10)
      .select('cveId description cvssV3 publishedDate organizationalImpact');

      // Obtener CVEs con exploits conocidos
      const withExploits = await CVE.find({
        'organizationalImpact.organization': organizationId,
        'exploitInformation.hasKnownExploit': true
      })
      .sort({ publishedDate: -1 })
      .limit(5)
      .select('cveId description cvssV3 exploitInformation organizationalImpact');

      // Obtener CVEs trending
      const trending = await CVE.find({
        'organizationalImpact.organization': organizationId,
        'tracking.trending': true
      })
      .sort({ 'cvssV3.baseScore': -1 })
      .limit(5)
      .select('cveId description cvssV3 tracking organizationalImpact');

      // Generar alertas automáticas
      const alerts = await CVEIntegrationService.generateAutomaticAlerts(organizationId);

      // Obtener estado de la API de NVD
      const nvdStatus = await CVEIntegrationService.checkNVDApiStatus();

      const response = {
        status: 'success',
        data: {
          summary: {
            totalCVEs: stats.totalCVEs,
            criticalCount: stats.severityStats.find(s => s._id === 'critical')?.count || 0,
            highCount: stats.severityStats.find(s => s._id === 'high')?.count || 0,
            trendingCount: stats.trendingCount,
            unremediated: stats.remediationStats.find(s => s._id === 'pending')?.count || 0
          },
          statistics: stats,
          criticalRecent: criticalRecent.map(cve => ({
            cveId: cve.cveId,
            description: cve.description.substring(0, 200) + '...',
            cvssScore: cve.cvssV3.baseScore,
            severity: cve.cvssV3.baseSeverity,
            publishedDate: cve.publishedDate,
            affectedAssets: cve.organizationalImpact[0]?.affectedAssets?.length || 0,
            remediationStatus: cve.organizationalImpact[0]?.remediationStatus || 'pending'
          })),
          withExploits: withExploits.map(cve => ({
            cveId: cve.cveId,
            description: cve.description.substring(0, 150) + '...',
            cvssScore: cve.cvssV3.baseScore,
            exploitSources: cve.exploitInformation.exploitSources?.length || 0,
            priorityLevel: cve.organizationalImpact[0]?.priorityLevel || 'medium'
          })),
          trending: trending.map(cve => ({
            cveId: cve.cveId,
            description: cve.description.substring(0, 150) + '...',
            cvssScore: cve.cvssV3.baseScore,
            socialMediaMentions: cve.tracking.socialMediaMentions,
            discussionActivity: cve.tracking.discussionActivity
          })),
          alerts,
          nvdStatus
        },
        timestamp: new Date()
      };

      res.json(response);

    } catch (error) {
      console.error('Error en dashboard CVE:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo dashboard de CVE',
        error: error.message
      });
    }
  }

  /**
   * @desc    Listar CVEs con filtros y paginación
   * @route   GET /api/cve
   * @access  Private
   */
  static async getCVEs(req, res) {
    try {
      const organizationId = req.user.organization;
      const {
        page = 1,
        limit = 25,
        severity,
        scoreMin,
        scoreMax,
        dateFrom,
        dateTo,
        hasExploit,
        remediationStatus,
        search,
        sortBy = 'publishedDate',
        sortOrder = 'desc'
      } = req.query;

      // Construir filtros para búsqueda
      const searchCriteria = {};

      if (severity) {
        searchCriteria.severity = Array.isArray(severity) ? severity : [severity];
      }

      if (scoreMin || scoreMax) {
        searchCriteria.scoreMin = scoreMin ? parseFloat(scoreMin) : undefined;
        searchCriteria.scoreMax = scoreMax ? parseFloat(scoreMax) : undefined;
      }

      if (dateFrom || dateTo) {
        searchCriteria.dateFrom = dateFrom;
        searchCriteria.dateTo = dateTo;
      }

      if (hasExploit === 'true') {
        searchCriteria.hasExploit = true;
      }

      if (search) {
        searchCriteria.keywords = search;
      }

      searchCriteria.limit = parseInt(limit) * 2; // Obtener más para filtrar después

      // Buscar CVEs usando el servicio
      let cves = await CVEIntegrationService.searchCVEs(searchCriteria, organizationId);

      // Filtrar por estado de remediación si se especifica
      if (remediationStatus) {
        cves = cves.filter(cve => {
          const orgImpact = cve.organizationalImpact.find(
            impact => impact.organization.toString() === organizationId.toString()
          );
          return orgImpact?.remediationStatus === remediationStatus;
        });
      }

      // Configurar ordenamiento
      const sortField = sortBy === 'score' ? 'cvssV3.baseScore' : 
                       sortBy === 'published' ? 'publishedDate' : 
                       'publishedDate';
      
      cves.sort((a, b) => {
        const aValue = CVEController.getNestedProperty(a, sortField);
        const bValue = CVEController.getNestedProperty(b, sortField);
        
        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Paginación manual
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const paginatedCVEs = cves.slice(skip, skip + parseInt(limit));
      const totalCount = cves.length;

      const response = {
        status: 'success',
        data: {
          cves: paginatedCVEs.map(cve => {
            const orgImpact = cve.organizationalImpact.find(
              impact => impact.organization.toString() === organizationId.toString()
            );

            return {
              id: cve._id,
              cveId: cve.cveId,
              description: cve.description.substring(0, 300) + '...',
              publishedDate: cve.publishedDate,
              lastModifiedDate: cve.lastModifiedDate,
              cvss: {
                score: cve.cvssV3.baseScore,
                severity: cve.cvssV3.baseSeverity,
                vector: cve.cvssV3.vectorString,
                attackVector: cve.cvssV3.attackVector,
                attackComplexity: cve.cvssV3.attackComplexity
              },
              exploitInfo: {
                hasKnownExploit: cve.exploitInformation.hasKnownExploit,
                exploitProbability: cve.exploitInformation.exploitProbability,
                exploitSources: cve.exploitInformation.exploitSources?.length || 0
              },
              organizationalImpact: orgImpact ? {
                affectedAssetsCount: orgImpact.affectedAssets?.length || 0,
                businessImpact: orgImpact.businessImpact,
                priorityLevel: orgImpact.priorityLevel,
                remediationStatus: orgImpact.remediationStatus,
                assignedTo: orgImpact.assignedTo,
                dueDate: orgImpact.dueDate,
                lastAssessed: orgImpact.lastAssessed
              } : null,
              tracking: {
                trending: cve.tracking.trending,
                discussionActivity: cve.tracking.discussionActivity
              },
              mitigation: {
                patchAvailable: cve.mitigation.patchAvailable,
                workaroundsCount: cve.mitigation.workarounds?.length || 0
              }
            };
          }),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / parseInt(limit))
          },
          filters: {
            severity,
            scoreRange: { min: scoreMin, max: scoreMax },
            dateRange: { from: dateFrom, to: dateTo },
            hasExploit,
            remediationStatus
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error listando CVEs:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo lista de CVEs',
        error: error.message
      });
    }
  }

  /**
   * @desc    Obtener detalle de CVE específico
   * @route   GET /api/cve/:cveId
   * @access  Private
   */
  static async getCVEDetail(req, res) {
    try {
      const { cveId } = req.params;
      const organizationId = req.user.organization;

      const cve = await CVE.findOne({ cveId })
        .populate('organizationalImpact.affectedAssets.asset', 'name type vendor model')
        .populate('organizationalImpact.assignedTo', 'firstName lastName email');

      if (!cve) {
        return res.status(404).json({
          status: 'error',
          message: 'CVE no encontrado'
        });
      }

      // Obtener impacto organizacional específico
      const orgImpact = cve.organizationalImpact.find(
        impact => impact.organization.toString() === organizationId.toString()
      );

      // Generar recomendaciones automáticas
      const recommendations = cve.generateRecommendations ? cve.generateRecommendations(organizationId) : [];

      // Calcular severidad contextual
      const contextualSeverity = cve.getContextualSeverity ? cve.getContextualSeverity(organizationId) : cve.cvssV3.baseSeverity;

      // Obtener CVEs similares
      const similarCVEs = cve.aiAnalysis?.similarCVEs || [];

      const response = {
        status: 'success',
        data: {
          cve: {
            id: cve._id,
            cveId: cve.cveId,
            description: cve.description,
            publishedDate: cve.publishedDate,
            lastModifiedDate: cve.lastModifiedDate,
            status: cve.status,
            
            cvssV3: cve.cvssV3,
            cvssV2: cve.cvssV2,
            
            weaknesses: cve.weaknesses,
            affectedProducts: cve.affectedProducts,
            references: cve.references,
            
            exploitInformation: cve.exploitInformation,
            mitigation: cve.mitigation,
            
            organizationalImpact: orgImpact,
            contextualSeverity,
            recommendations,
            
            tracking: cve.tracking,
            sectorRelevance: cve.sectorRelevance,
            geoRelevance: cve.geoRelevance,
            
            aiAnalysis: cve.aiAnalysis,
            threatIntelligence: cve.threatIntelligence,
            
            syncMetadata: cve.syncMetadata,
            
            similarCVEs,
            ageInDays: cve.ageInDays,
            isCriticalRecent: cve.isCriticalRecent,
            organizationalPriorityScore: cve.organizationalPriorityScore
          }
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error obteniendo detalle CVE:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo detalle del CVE',
        error: error.message
      });
    }
  }

  /**
   * @desc    Sincronizar CVEs desde NVD
   * @route   POST /api/cve/sync
   * @access  Private (admin)
   */
  static async syncCVEs(req, res) {
    try {
      const { startDate, endDate, forceSync = false } = req.body;

      // Validar fechas si se proporcionan
      let syncStartDate = null;
      let syncEndDate = null;

      if (startDate) {
        syncStartDate = new Date(startDate);
        if (isNaN(syncStartDate.getTime())) {
          return res.status(400).json({
            status: 'error',
            message: 'Fecha de inicio inválida'
          });
        }
      }

      if (endDate) {
        syncEndDate = new Date(endDate);
        if (isNaN(syncEndDate.getTime())) {
          return res.status(400).json({
            status: 'error',
            message: 'Fecha de fin inválida'
          });
        }
      }

      // Verificar si hay una sincronización reciente (últimas 6 horas)
      if (!forceSync) {
        const recentSync = await CVE.findOne({
          'syncMetadata.localLastSync': {
            $gte: new Date(Date.now() - 6 * 60 * 60 * 1000)
          }
        });

        if (recentSync) {
          return res.status(429).json({
            status: 'error',
            message: 'Sincronización reciente detectada. Use forceSync=true para forzar.',
            lastSync: recentSync.syncMetadata.localLastSync
          });
        }
      }

      // Iniciar sincronización asíncrona
      res.status(202).json({
        status: 'accepted',
        message: 'Sincronización de CVEs iniciada',
        startTime: new Date()
      });

      // Ejecutar sincronización en background
      try {
        const results = await CVEIntegrationService.syncCVEDatabase(syncStartDate, syncEndDate);
        
        console.log('🎉 Sincronización CVE completada:', results);
        
        // Aquí podrías enviar notificación a los usuarios o actualizar estado
        
      } catch (syncError) {
        console.error('❌ Error en sincronización CVE:', syncError);
      }

    } catch (error) {
      console.error('Error iniciando sincronización CVE:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error iniciando sincronización',
        error: error.message
      });
    }
  }

  /**
   * @desc    Correlacionar CVEs con activos organizacionales
   * @route   POST /api/cve/correlate
   * @access  Private (admin, analyst)
   */
  static async correlateCVEs(req, res) {
    try {
      const organizationId = req.user.organization;
      const { cveIds, forceRecorrelation = false } = req.body;

      if (!cveIds || !Array.isArray(cveIds) || cveIds.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Se requiere una lista de CVE IDs para correlacionar'
        });
      }

      const results = {
        processed: 0,
        correlated: 0,
        errors: []
      };

      for (const cveId of cveIds) {
        try {
          const cve = await CVE.findOne({ cveId });
          
          if (!cve) {
            results.errors.push({
              cveId,
              error: 'CVE no encontrado'
            });
            continue;
          }

          // Verificar si ya existe correlación
          const existingCorrelation = cve.organizationalImpact.find(
            impact => impact.organization.toString() === organizationId.toString()
          );

          if (existingCorrelation && !forceRecorrelation) {
            results.processed++;
            continue;
          }

          // Correlacionar con organización
          await CVEIntegrationService.correlateWithOrganization(cve, organizationId);
          
          results.correlated++;
          results.processed++;

        } catch (error) {
          results.errors.push({
            cveId,
            error: error.message
          });
        }
      }

      const response = {
        status: 'success',
        message: `Correlación completada: ${results.correlated} CVEs correlacionados`,
        data: results
      };

      res.json(response);

    } catch (error) {
      console.error('Error correlacionando CVEs:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error correlacionando CVEs con activos',
        error: error.message
      });
    }
  }

  /**
   * @desc    Actualizar estado de remediación de CVE
   * @route   PUT /api/cve/:cveId/remediation
   * @access  Private (admin, analyst)
   */
  static async updateRemediationStatus(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos inválidos',
          errors: errors.array()
        });
      }

      const { cveId } = req.params;
      const organizationId = req.user.organization;
      const userId = req.user.id;
      const {
        remediationStatus,
        assignedTo,
        dueDate,
        notes,
        priority
      } = req.body;

      const cve = await CVE.findOne({ cveId });

      if (!cve) {
        return res.status(404).json({
          status: 'error',
          message: 'CVE no encontrado'
        });
      }

      // Buscar impacto organizacional
      const orgImpactIndex = cve.organizationalImpact.findIndex(
        impact => impact.organization.toString() === organizationId.toString()
      );

      if (orgImpactIndex === -1) {
        return res.status(404).json({
          status: 'error',
          message: 'CVE no correlacionado con la organización'
        });
      }

      // Actualizar estado de remediación
      const orgImpact = cve.organizationalImpact[orgImpactIndex];
      const previousStatus = orgImpact.remediationStatus;

      if (remediationStatus) orgImpact.remediationStatus = remediationStatus;
      if (assignedTo) orgImpact.assignedTo = assignedTo;
      if (dueDate) orgImpact.dueDate = new Date(dueDate);
      if (notes) orgImpact.notes = notes;
      if (priority) orgImpact.priorityLevel = priority;

      // Marcar fecha de completación si se resuelve
      if (remediationStatus === 'completed') {
        orgImpact.completionDate = new Date();
      }

      orgImpact.lastAssessed = new Date();
      
      await cve.save();

      // Log de cambio de estado
      console.log(`📝 CVE ${cveId} estado cambiado de ${previousStatus} a ${remediationStatus} por usuario ${userId}`);

      const response = {
        status: 'success',
        message: 'Estado de remediación actualizado exitosamente',
        data: {
          cveId,
          previousStatus,
          newStatus: remediationStatus,
          organizationalImpact: orgImpact
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error actualizando estado de remediación:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error actualizando estado de remediación',
        error: error.message
      });
    }
  }

  /**
   * @desc    Buscar CVEs por productos/vendors
   * @route   GET /api/cve/search-products
   * @access  Private
   */
  static async searchByProducts(req, res) {
    try {
      const organizationId = req.user.organization;
      const { vendor, product, version } = req.query;

      if (!vendor && !product) {
        return res.status(400).json({
          status: 'error',
          message: 'Se requiere al menos vendor o producto para buscar'
        });
      }

      // Construir criterios de búsqueda
      const products = [{
        vendor: vendor || '',
        product: product || '',
        version: version || ''
      }];

      // Buscar CVEs
      const cves = await CVE.findByProducts ? await CVE.findByProducts(products) : [];

      // Filtrar solo CVEs relevantes para la organización o todos si no hay filtro
      let filteredCVEs = cves;
      if (organizationId) {
        filteredCVEs = cves.filter(cve => 
          cve.organizationalImpact.some(impact => 
            impact.organization.toString() === organizationId.toString()
          )
        );
      }

      const response = {
        status: 'success',
        data: {
          searchCriteria: { vendor, product, version },
          totalFound: filteredCVEs.length,
          cves: filteredCVEs.slice(0, 50).map(cve => ({
            cveId: cve.cveId,
            description: cve.description.substring(0, 200) + '...',
            cvssScore: cve.cvssV3.baseScore,
            severity: cve.cvssV3.baseSeverity,
            publishedDate: cve.publishedDate,
            hasKnownExploit: cve.exploitInformation.hasKnownExploit,
            affectedProducts: cve.affectedProducts.filter(p => 
              (!vendor || p.vendor.toLowerCase().includes(vendor.toLowerCase())) &&
              (!product || p.product.toLowerCase().includes(product.toLowerCase()))
            )
          }))
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error buscando CVEs por productos:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error buscando CVEs por productos',
        error: error.message
      });
    }
  }

  /**
   * @desc    Obtener alertas automáticas de CVE
   * @route   GET /api/cve/alerts
   * @access  Private
   */
  static async getAlerts(req, res) {
    try {
      const organizationId = req.user.organization;

      const alerts = await CVEIntegrationService.generateAutomaticAlerts(organizationId);

      const response = {
        status: 'success',
        data: {
          alerts,
          alertCount: alerts.length,
          generatedAt: new Date()
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error obteniendo alertas CVE:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo alertas de CVE',
        error: error.message
      });
    }
  }

  /**
   * @desc    Obtener estadísticas de CVE
   * @route   GET /api/cve/statistics
   * @access  Private
   */
  static async getStatistics(req, res) {
    try {
      const organizationId = req.user.organization;

      const stats = await CVEIntegrationService.getOrganizationCVEStats(organizationId);

      const response = {
        status: 'success',
        data: {
          statistics: stats,
          generatedAt: new Date()
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Error obteniendo estadísticas CVE:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo estadísticas de CVE',
        error: error.message
      });
    }
  }

  /**
   * @desc    Verificar estado de API NVD
   * @route   GET /api/cve/nvd-status
   * @access  Private (admin)
   */
  static async getNVDStatus(req, res) {
    try {
      const status = await CVEIntegrationService.checkNVDApiStatus();

      res.json({
        status: 'success',
        data: {
          nvdApi: status,
          checkedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Error verificando estado NVD:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error verificando estado de NVD',
        error: error.message
      });
    }
  }

  /**
   * @desc    Exportar CVEs
   * @route   GET /api/cve/export
   * @access  Private
   */
  static async exportCVEs(req, res) {
    try {
      const organizationId = req.user.organization;
      const { format = 'csv', ...filters } = req.query;

      // Obtener CVEs con filtros
      const cves = await CVEIntegrationService.searchCVEs(filters, organizationId);

      if (format === 'csv') {
        // Generar CSV
        const csvData = CVEController.generateCVECSV(cves, organizationId);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="cves.csv"');
        res.send(csvData);
        
      } else if (format === 'excel') {
        // Para Excel, necesitarías implementar la generación con una librería como xlsx
        return res.status(501).json({
          status: 'error',
          message: 'Formato Excel no implementado aún'
        });
      } else {
        // Formato JSON por defecto
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="cves.json"');
        
        const exportData = {
          exportDate: new Date(),
          organization: organizationId,
          totalCVEs: cves.length,
          cves: cves
        };
        
        res.json(exportData);
      }

    } catch (error) {
      console.error('Error exportando CVEs:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error exportando CVEs',
        error: error.message
      });
    }
  }

  /**
   * @desc    Obtener estado de sincronización
   * @route   GET /api/cve/sync-status
   * @access  Private (admin)
   */
  static async getSyncStatus(req, res) {
    try {
      // En una implementación real, esto consultaría un estado global de sincronización
      // Por ahora, devolver estado mock
      const status = {
        syncing: false,
        lastSync: new Date(),
        imported: 0,
        updated: 0,
        errors: 0,
        progress: 100
      };

      res.json({
        status: 'success',
        data: status
      });

    } catch (error) {
      console.error('Error obteniendo estado de sincronización:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error obteniendo estado de sincronización',
        error: error.message
      });
    }
  }

  // Método auxiliar para obtener propiedades anidadas
  static getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  // Método auxiliar para generar CSV
  static generateCVECSV(cves, organizationId) {
    const headers = [
      'CVE ID',
      'Descripción',
      'Severidad',
      'Puntuación CVSS',
      'Vector CVSS',
      'Fecha Publicación',
      'Fecha Modificación',
      'Tiene Exploit',
      'Parche Disponible',
      'Activos Afectados',
      'Impacto Negocio',
      'Estado Remediación',
      'Prioridad',
      'Asignado A'
    ];

    const csvRows = [headers.join(',')];

    cves.forEach(cve => {
      const orgImpact = cve.organizationalImpact.find(
        impact => impact.organization.toString() === organizationId.toString()
      );

      const row = [
        cve.cveId,
        `"${cve.description.replace(/"/g, '""')}"`,
        cve.cvssV3.baseSeverity,
        cve.cvssV3.baseScore,
        `"${cve.cvssV3.vectorString}"`,
        cve.publishedDate.toISOString().split('T')[0],
        cve.lastModifiedDate.toISOString().split('T')[0],
        cve.exploitInformation.hasKnownExploit ? 'Sí' : 'No',
        cve.mitigation.patchAvailable ? 'Sí' : 'No',
        orgImpact?.affectedAssets?.length || 0,
        orgImpact?.businessImpact || 'N/A',
        orgImpact?.remediationStatus || 'N/A',
        orgImpact?.priorityLevel || 'N/A',
        orgImpact?.assignedTo || 'N/A'
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }
}

module.exports = CVEController;