const Asset = require('../models/Asset');
const XLSX = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

/**
 * Servicio para gestión integral de activos
 * Incluye importación/exportación, análisis de dependencias y operaciones avanzadas
 */

/**
 * Analizar dependencias de un activo
 * @param {Object} asset - Activo a analizar
 * @returns {Object} Análisis detallado de dependencias
 */
const analyzeDependencies = async (asset) => {
  try {
    // Obtener todos los activos dependientes de este
    const dependentAssets = await Asset.find({
      organization: asset.organization,
      'dependencies.assetId': asset._id
    }).select('name code type criticality dependencies valuation').lean();

    // Analizar impacto de cada dependencia saliente
    const outgoingAnalysis = [];
    for (const dependency of asset.dependencies) {
      const targetAsset = await Asset.findById(dependency.assetId)
        .select('name code type criticality valuation').lean();
      
      if (targetAsset) {
        const impact = calculateDependencyImpact(asset, targetAsset, dependency);
        outgoingAnalysis.push({
          target: targetAsset,
          dependency: dependency,
          impact
        });
      }
    }

    // Analizar dependencias entrantes
    const incomingAnalysis = dependentAssets.map(depAsset => {
      const dependency = depAsset.dependencies.find(
        dep => dep.assetId.toString() === asset._id.toString()
      );
      
      const impact = calculateDependencyImpact(depAsset, asset, dependency);
      
      return {
        source: {
          _id: depAsset._id,
          name: depAsset.name,
          code: depAsset.code,
          type: depAsset.type,
          criticality: depAsset.criticality
        },
        dependency: dependency,
        impact
      };
    });

    // Calcular métricas de red
    const networkMetrics = calculateNetworkMetrics(asset, outgoingAnalysis, incomingAnalysis);
    
    // Identificar patrones de dependencia
    const patterns = identifyDependencyPatterns(outgoingAnalysis, incomingAnalysis);
    
    // Calcular riesgo de cascada
    const cascadeRisk = calculateCascadeRisk(asset, outgoingAnalysis, incomingAnalysis);

    return {
      summary: {
        outgoingCount: outgoingAnalysis.length,
        incomingCount: incomingAnalysis.length,
        totalConnections: outgoingAnalysis.length + incomingAnalysis.length,
        criticalDependencies: outgoingAnalysis.filter(dep => 
          dep.dependency.dependencyType === 'ESSENTIAL'
        ).length
      },
      outgoing: outgoingAnalysis,
      incoming: incomingAnalysis,
      networkMetrics,
      patterns,
      cascadeRisk,
      recommendations: generateDependencyRecommendations(networkMetrics, patterns, cascadeRisk)
    };

  } catch (error) {
    console.error('Error analyzing dependencies:', error);
    throw new Error('Error en el análisis de dependencias');
  }
};

/**
 * Importar activos desde archivo Excel
 * @param {Buffer} fileBuffer - Buffer del archivo Excel
 * @param {Object} organization - Organización destino
 * @param {Object} importedBy - Usuario que realiza la importación
 * @returns {Object} Resultado de la importación
 */
const importFromExcel = async (fileBuffer, organization, importedBy) => {
  try {
    // Leer archivo Excel
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convertir a JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: ''
    });

    if (rawData.length < 2) {
      throw new Error('El archivo debe contener al menos una fila de datos además del encabezado');
    }

    // Mapear encabezados
    const headers = rawData[0].map(header => header.toString().toLowerCase().trim());
    const requiredHeaders = ['nombre', 'codigo', 'tipo', 'subtipo'];
    
    const missingHeaders = requiredHeaders.filter(req => 
      !headers.some(header => header.includes(req))
    );

    if (missingHeaders.length > 0) {
      throw new Error(`Encabezados requeridos faltantes: ${missingHeaders.join(', ')}`);
    }

    // Mapear columnas
    const columnMap = {
      name: findColumnIndex(headers, ['nombre', 'name', 'activo']),
      code: findColumnIndex(headers, ['codigo', 'code', 'clave']),
      description: findColumnIndex(headers, ['descripcion', 'description', 'desc']),
      type: findColumnIndex(headers, ['tipo', 'type', 'categoria']),
      subtype: findColumnIndex(headers, ['subtipo', 'subtype', 'subcategoria']),
      confidentiality: findColumnIndex(headers, ['confidencialidad', 'confidentiality', 'conf']),
      integrity: findColumnIndex(headers, ['integridad', 'integrity', 'int']),
      availability: findColumnIndex(headers, ['disponibilidad', 'availability', 'disp']),
      authenticity: findColumnIndex(headers, ['autenticidad', 'authenticity', 'aut']),
      traceability: findColumnIndex(headers, ['trazabilidad', 'traceability', 'traz']),
      economicValue: findColumnIndex(headers, ['valor_economico', 'economic_value', 'valor']),
      owner: findColumnIndex(headers, ['propietario', 'owner', 'responsable'])
    };

    // Procesar datos
    const dataRows = rawData.slice(1);
    const results = {
      total: dataRows.length,
      successful: 0,
      failed: 0,
      errors: [],
      created: [],
      skipped: []
    };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // +2 porque empezamos en fila 2 (después del header)

      try {
        // Extraer datos de la fila
        const assetData = extractAssetData(row, columnMap);
        
        // Validaciones básicas
        const validationErrors = validateAssetData(assetData, rowNum);
        if (validationErrors.length > 0) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            errors: validationErrors
          });
          continue;
        }

        // Verificar si el código ya existe
        const existingAsset = await Asset.findOne({
          organization: organization._id,
          code: assetData.code.toUpperCase()
        });

        if (existingAsset) {
          results.skipped.push({
            row: rowNum,
            code: assetData.code,
            reason: 'Código ya existe'
          });
          continue;
        }

        // Validar tipo y subtipo
        if (!Asset.validateSubtype(assetData.type, assetData.subtype)) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            errors: ['Combinación tipo-subtipo no válida según MAGERIT']
          });
          continue;
        }

        // Buscar propietario
        let ownerData = {
          userId: importedBy._id,
          name: importedBy.profile.firstName + ' ' + importedBy.profile.lastName,
          email: importedBy.email,
          department: ''
        };

        if (assetData.owner) {
          const ownerUser = await findUserByEmailOrName(assetData.owner, organization._id);
          if (ownerUser) {
            ownerData = {
              userId: ownerUser._id,
              name: ownerUser.profile.firstName + ' ' + ownerUser.profile.lastName,
              email: ownerUser.email,
              department: ''
            };
          }
        }

        // Crear activo
        const newAsset = new Asset({
          name: assetData.name,
          code: assetData.code.toUpperCase(),
          description: assetData.description || '',
          type: assetData.type,
          subtype: assetData.subtype,
          valuation: {
            confidentiality: assetData.confidentiality || 0,
            integrity: assetData.integrity || 0,
            availability: assetData.availability || 0,
            authenticity: assetData.authenticity || 0,
            traceability: assetData.traceability || 0
          },
          economicValue: assetData.economicValue || 0,
          owner: ownerData,
          organization: organization._id,
          status: 'ACTIVE',
          metadata: {
            importedFrom: 'Excel',
            importedAt: new Date(),
            importedBy: importedBy._id
          }
        });

        await newAsset.save();
        
        results.successful++;
        results.created.push({
          row: rowNum,
          code: newAsset.code,
          name: newAsset.name,
          id: newAsset._id
        });

      } catch (error) {
        results.failed++;
        results.errors.push({
          row: rowNum,
          errors: [error.message]
        });
      }
    }

    return results;

  } catch (error) {
    console.error('Error importing from Excel:', error);
    throw new Error(`Error en la importación: ${error.message}`);
  }
};

/**
 * Exportar activos a CSV
 * @param {Array} assets - Lista de activos
 * @returns {String} Contenido CSV
 */
const exportToCsv = async (assets) => {
  try {
    const headers = [
      'Código',
      'Nombre',
      'Descripción',
      'Tipo',
      'Subtipo',
      'Confidencialidad',
      'Integridad',
      'Disponibilidad',
      'Autenticidad',
      'Trazabilidad',
      'Valor Económico',
      'Criticidad',
      'Estado',
      'Propietario',
      'Dependencias',
      'Fecha Creación'
    ];

    const rows = assets.map(asset => [
      asset.code,
      asset.name,
      asset.description || '',
      getTypeNameByCode(asset.type),
      getSubtypeNameByCode(asset.type, asset.subtype),
      asset.valuation.confidentiality,
      asset.valuation.integrity,
      asset.valuation.availability,
      asset.valuation.authenticity,
      asset.valuation.traceability,
      asset.economicValue || 0,
      asset.criticality.level,
      asset.status,
      asset.owner?.name || '',
      asset.dependencies?.length || 0,
      new Date(asset.createdAt).toLocaleDateString('es-EC')
    ]);

    // Construir CSV
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;

  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw new Error('Error en la exportación a CSV');
  }
};

/**
 * Exportar activos a Excel
 * @param {Array} assets - Lista de activos
 * @returns {Buffer} Buffer del archivo Excel
 */
const exportToExcel = async (assets) => {
  try {
    // Crear workbook
    const workbook = XLSX.utils.book_new();

    // Hoja principal - Activos
    const assetData = assets.map(asset => ({
      'Código': asset.code,
      'Nombre': asset.name,
      'Descripción': asset.description || '',
      'Tipo': getTypeNameByCode(asset.type),
      'Subtipo': getSubtypeNameByCode(asset.type, asset.subtype),
      'Confidencialidad': asset.valuation.confidentiality,
      'Integridad': asset.valuation.integrity,
      'Disponibilidad': asset.valuation.availability,
      'Autenticidad': asset.valuation.authenticity,
      'Trazabilidad': asset.valuation.traceability,
      'Valor Máximo': Math.max(...Object.values(asset.valuation)),
      'Valor Económico': asset.economicValue || 0,
      'Criticidad': asset.criticality.level,
      'Puntuación Criticidad': asset.criticality.score,
      'Estado': asset.status,
      'Propietario': asset.owner?.name || '',
      'Email Propietario': asset.owner?.email || '',
      'Dependencias': asset.dependencies?.length || 0,
      'Fecha Creación': new Date(asset.createdAt).toLocaleDateString('es-EC'),
      'Última Actualización': new Date(asset.updatedAt).toLocaleDateString('es-EC')
    }));

    const assetSheet = XLSX.utils.json_to_sheet(assetData);
    XLSX.utils.book_append_sheet(workbook, assetSheet, 'Activos');

    // Hoja de resumen
    const summary = generateExportSummary(assets);
    const summarySheet = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

    // Hoja de taxonomía MAGERIT
    const taxonomy = generateTaxonomySheet();
    const taxonomySheet = XLSX.utils.json_to_sheet(taxonomy);
    XLSX.utils.book_append_sheet(workbook, taxonomySheet, 'Taxonomía MAGERIT');

    // Convertir a buffer
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true
    });

    return excelBuffer;

  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Error en la exportación a Excel');
  }
};

/**
 * Generar plantilla de importación Excel
 * @returns {Buffer} Buffer de la plantilla Excel
 */
const generateImportTemplate = async () => {
  try {
    const workbook = XLSX.utils.book_new();

    // Hoja de plantilla
    const templateData = [
      {
        'Nombre*': 'Servidor Web Principal',
        'Código*': 'SW-WEB-001', 
        'Descripción': 'Servidor web que aloja la aplicación principal',
        'Tipo*': 'HW',
        'Subtipo*': 'HW.1',
        'Confidencialidad (0-10)': '7',
        'Integridad (0-10)': '8',
        'Disponibilidad (0-10)': '9',
        'Autenticidad (0-10)': '6',
        'Trazabilidad (0-10)': '5',
        'Valor Económico (USD)': '15000',
        'Propietario (Email)': 'admin@empresa.com'
      }
    ];

    const templateSheet = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(workbook, templateSheet, 'Plantilla');

    // Hoja de instrucciones
    const instructions = [
      { 'Campo': 'Nombre*', 'Descripción': 'Nombre descriptivo del activo', 'Requerido': 'Sí', 'Ejemplo': 'Servidor Web Principal' },
      { 'Campo': 'Código*', 'Descripción': 'Código único del activo', 'Requerido': 'Sí', 'Ejemplo': 'SW-WEB-001' },
      { 'Campo': 'Descripción', 'Descripción': 'Descripción detallada del activo', 'Requerido': 'No', 'Ejemplo': 'Servidor que aloja...' },
      { 'Campo': 'Tipo*', 'Descripción': 'Tipo según taxonomía MAGERIT', 'Requerido': 'Sí', 'Ejemplo': 'HW, SW, I, S, COM' },
      { 'Campo': 'Subtipo*', 'Descripción': 'Subtipo según taxonomía MAGERIT', 'Requerido': 'Sí', 'Ejemplo': 'HW.1, SW.2, I.4' },
      { 'Campo': 'Confidencialidad', 'Descripción': 'Nivel de confidencialidad (0-10)', 'Requerido': 'No', 'Ejemplo': '7' },
      { 'Campo': 'Integridad', 'Descripción': 'Nivel de integridad (0-10)', 'Requerido': 'No', 'Ejemplo': '8' },
      { 'Campo': 'Disponibilidad', 'Descripción': 'Nivel de disponibilidad (0-10)', 'Requerido': 'No', 'Ejemplo': '9' },
      { 'Campo': 'Autenticidad', 'Descripción': 'Nivel de autenticidad (0-10)', 'Requerido': 'No', 'Ejemplo': '6' },
      { 'Campo': 'Trazabilidad', 'Descripción': 'Nivel de trazabilidad (0-10)', 'Requerido': 'No', 'Ejemplo': '5' },
      { 'Campo': 'Valor Económico', 'Descripción': 'Valor económico en USD', 'Requerido': 'No', 'Ejemplo': '15000' },
      { 'Campo': 'Propietario', 'Descripción': 'Email del propietario del activo', 'Requerido': 'No', 'Ejemplo': 'admin@empresa.com' }
    ];

    const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instrucciones');

    // Hoja de códigos MAGERIT
    const mageritCodes = generateMageritCodesSheet();
    const codesSheet = XLSX.utils.json_to_sheet(mageritCodes);
    XLSX.utils.book_append_sheet(workbook, codesSheet, 'Códigos MAGERIT');

    const templateBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx' 
    });

    return templateBuffer;

  } catch (error) {
    console.error('Error generating import template:', error);
    throw new Error('Error generando plantilla de importación');
  }
};

/**
 * Buscar activos duplicados potenciales
 * @param {String} organizationId - ID de la organización
 * @returns {Array} Lista de posibles duplicados
 */
const findPotentialDuplicates = async (organizationId) => {
  try {
    const assets = await Asset.find({ 
      organization: organizationId,
      status: { $ne: 'RETIRED' }
    }).select('name code description type valuation').lean();

    const duplicates = [];
    
    for (let i = 0; i < assets.length; i++) {
      for (let j = i + 1; j < assets.length; j++) {
        const similarity = calculateAssetSimilarity(assets[i], assets[j]);
        
        if (similarity.score >= 0.8) {
          duplicates.push({
            asset1: assets[i],
            asset2: assets[j],
            similarity: similarity,
            recommendedAction: similarity.score >= 0.95 ? 'MERGE' : 'REVIEW'
          });
        }
      }
    }

    return duplicates.sort((a, b) => b.similarity.score - a.similarity.score);

  } catch (error) {
    console.error('Error finding duplicates:', error);
    throw new Error('Error buscando activos duplicados');
  }
};

/**
 * Optimizar taxonomía de activos
 * @param {String} organizationId - ID de la organización
 * @returns {Object} Análisis y recomendaciones de optimización
 */
const optimizeAssetTaxonomy = async (organizationId) => {
  try {
    const assets = await Asset.find({ 
      organization: organizationId 
    }).select('type subtype name criticality').lean();

    const analysis = {
      typeDistribution: {},
      subtypeDistribution: {},
      unusedTypes: [],
      recommendations: []
    };

    // Analizar distribución por tipo
    assets.forEach(asset => {
      // Distribución por tipo
      analysis.typeDistribution[asset.type] = (analysis.typeDistribution[asset.type] || 0) + 1;
      
      // Distribución por subtipo
      const subtypeKey = `${asset.type}.${asset.subtype}`;
      analysis.subtypeDistribution[subtypeKey] = (analysis.subtypeDistribution[subtypeKey] || 0) + 1;
    });

    // Identificar tipos no utilizados
    const assetTypes = Asset.getAssetTypes();
    const usedTypes = Object.keys(analysis.typeDistribution);
    
    Object.values(assetTypes).forEach(type => {
      if (!usedTypes.includes(type.code)) {
        analysis.unusedTypes.push({
          code: type.code,
          name: type.name,
          subtypes: Object.keys(type.subtypes).length
        });
      }
    });

    // Generar recomendaciones
    if (analysis.unusedTypes.length > 0) {
      analysis.recommendations.push({
        type: 'TAXONOMY_GAPS',
        priority: 'MEDIUM',
        description: `${analysis.unusedTypes.length} tipos de activos MAGERIT no están siendo utilizados`,
        action: 'Revisar si existen activos que deberían clasificarse en estos tipos'
      });
    }

    const totalAssets = assets.length;
    const typesWithFewAssets = Object.entries(analysis.typeDistribution)
      .filter(([type, count]) => count / totalAssets < 0.05) // Menos del 5%
      .map(([type, count]) => ({ type, count, percentage: (count / totalAssets) * 100 }));

    if (typesWithFewAssets.length > 0) {
      analysis.recommendations.push({
        type: 'UNDERUTILIZED_TYPES',
        priority: 'LOW',
        description: `${typesWithFewAssets.length} tipos tienen muy pocos activos asignados`,
        details: typesWithFewAssets,
        action: 'Verificar si la clasificación es correcta o si faltan activos por inventariar'
      });
    }

    return analysis;

  } catch (error) {
    console.error('Error optimizing taxonomy:', error);
    throw new Error('Error optimizando taxonomía de activos');
  }
};

// Funciones auxiliares

const calculateDependencyImpact = (sourceAsset, targetAsset, dependency) => {
  const sourceScore = sourceAsset.criticality?.score || 0;
  const targetScore = targetAsset.criticality?.score || 0;
  const impactFactor = dependency.impactFactor || 1;

  const dependencyWeights = {
    'ESSENTIAL': 1.0,
    'IMPORTANT': 0.7,
    'NORMAL': 0.5,
    'WEAK': 0.3
  };

  const weight = dependencyWeights[dependency.dependencyType] || 0.5;
  
  return {
    directImpact: sourceScore * weight * impactFactor,
    cascadeRisk: Math.min(10, (sourceScore * weight * impactFactor) + (targetScore * 0.3)),
    riskLevel: calculateImpactRiskLevel(sourceScore * weight * impactFactor),
    mitigationPriority: calculateMitigationPriority(sourceScore, targetScore, weight)
  };
};

const calculateImpactRiskLevel = (impact) => {
  if (impact >= 8) return 'CRITICAL';
  if (impact >= 6) return 'HIGH';
  if (impact >= 4) return 'MEDIUM';
  if (impact >= 2) return 'LOW';
  return 'VERY_LOW';
};

const calculateMitigationPriority = (sourceScore, targetScore, weight) => {
  const combinedScore = (sourceScore + targetScore) * weight;
  if (combinedScore >= 15) return 'URGENT';
  if (combinedScore >= 12) return 'HIGH';
  if (combinedScore >= 8) return 'MEDIUM';
  return 'LOW';
};

const calculateNetworkMetrics = (asset, outgoing, incoming) => {
  const totalConnections = outgoing.length + incoming.length;
  const criticalConnections = [
    ...outgoing.filter(dep => dep.dependency.dependencyType === 'ESSENTIAL'),
    ...incoming.filter(dep => dep.dependency.dependencyType === 'ESSENTIAL')
  ].length;

  return {
    connectivityScore: Math.min(10, totalConnections * 0.5),
    criticalityRatio: totalConnections > 0 ? criticalConnections / totalConnections : 0,
    fanOut: outgoing.length, // Número de dependencias salientes
    fanIn: incoming.length,  // Número de dependencias entrantes
    complexity: calculateComplexityScore(outgoing, incoming),
    isolationDifficulty: calculateIsolationDifficulty(outgoing, incoming)
  };
};

const calculateComplexityScore = (outgoing, incoming) => {
  const outgoingComplexity = outgoing.reduce((sum, dep) => {
    const weights = { 'ESSENTIAL': 3, 'IMPORTANT': 2, 'NORMAL': 1, 'WEAK': 0.5 };
    return sum + (weights[dep.dependency.dependencyType] || 1);
  }, 0);

  const incomingComplexity = incoming.length * 0.5; // Las dependencias entrantes añaden menos complejidad
  
  return Math.min(10, outgoingComplexity + incomingComplexity);
};

const calculateIsolationDifficulty = (outgoing, incoming) => {
  const essentialOutgoing = outgoing.filter(dep => dep.dependency.dependencyType === 'ESSENTIAL').length;
  const totalIncoming = incoming.length;
  
  if (essentialOutgoing >= 3 || totalIncoming >= 5) return 'VERY_HIGH';
  if (essentialOutgoing >= 2 || totalIncoming >= 3) return 'HIGH';
  if (essentialOutgoing >= 1 || totalIncoming >= 1) return 'MEDIUM';
  return 'LOW';
};

const identifyDependencyPatterns = (outgoing, incoming) => {
  const patterns = [];

  // Patrón: Hub (muchas dependencias entrantes)
  if (incoming.length >= 5) {
    patterns.push({
      type: 'HUB',
      description: 'Activo central del que dependen muchos otros',
      risk: 'CRITICAL',
      recommendation: 'Implementar redundancia y alta disponibilidad'
    });
  }

  // Patrón: Chain (dependencias en cadena)
  const chainLength = calculateChainLength(outgoing);
  if (chainLength >= 3) {
    patterns.push({
      type: 'CHAIN',
      description: `Cadena de dependencias de ${chainLength} niveles`,
      risk: 'HIGH',
      recommendation: 'Reducir cadena de dependencias para minimizar efectos cascada'
    });
  }

  // Patrón: Isolated (muy pocas dependencias)
  if (outgoing.length === 0 && incoming.length === 0) {
    patterns.push({
      type: 'ISOLATED',
      description: 'Activo sin dependencias identificadas',
      risk: 'LOW',
      recommendation: 'Verificar si realmente no tiene dependencias'
    });
  }

  // Patrón: Critical Path (dependencias esenciales)
  const essentialCount = outgoing.filter(dep => dep.dependency.dependencyType === 'ESSENTIAL').length;
  if (essentialCount >= 2) {
    patterns.push({
      type: 'CRITICAL_PATH',
      description: `${essentialCount} dependencias esenciales identificadas`,
      risk: 'HIGH',
      recommendation: 'Establecer planes de contingencia para dependencias críticas'
    });
  }

  return patterns;
};

const calculateChainLength = (outgoing) => {
  // Simplificado: asume que las dependencias forman una cadena lineal
  return outgoing.length > 0 ? outgoing.length + 1 : 0;
};

const calculateCascadeRisk = (asset, outgoing, incoming) => {
  const assetCriticality = asset.criticality?.score || 0;
  
  // Riesgo de cascada hacia arriba (afectando dependientes)
  const upstreamRisk = incoming.reduce((risk, dep) => {
    const sourceRisk = dep.source.criticality?.score || 0;
    const weights = { 'ESSENTIAL': 1.0, 'IMPORTANT': 0.7, 'NORMAL': 0.5, 'WEAK': 0.3 };
    const weight = weights[dep.dependency.dependencyType] || 0.5;
    return risk + (assetCriticality * weight * 0.6);
  }, 0);

  // Riesgo de cascada hacia abajo (desde dependencias)
  const downstreamRisk = outgoing.reduce((risk, dep) => {
    const targetRisk = dep.target.criticality?.score || 0;
    const weights = { 'ESSENTIAL': 1.0, 'IMPORTANT': 0.7, 'NORMAL': 0.5, 'WEAK': 0.3 };
    const weight = weights[dep.dependency.dependencyType] || 0.5;
    return risk + (targetRisk * weight * 0.8);
  }, 0);

  const totalRisk = upstreamRisk + downstreamRisk;
  
  return {
    upstreamRisk: Math.min(10, upstreamRisk),
    downstreamRisk: Math.min(10, downstreamRisk),
    totalRisk: Math.min(10, totalRisk),
    level: totalRisk >= 8 ? 'CRITICAL' : totalRisk >= 6 ? 'HIGH' : totalRisk >= 4 ? 'MEDIUM' : 'LOW',
    affectedAssets: incoming.length + outgoing.length,
    propagationFactor: totalRisk / Math.max(1, assetCriticality)
  };
};

const generateDependencyRecommendations = (networkMetrics, patterns, cascadeRisk) => {
  const recommendations = [];

  if (networkMetrics.complexity >= 7) {
    recommendations.push({
      priority: 'HIGH',
      category: 'COMPLEXITY',
      action: 'Simplificar arquitectura de dependencias',
      justification: `Complejidad alta (${networkMetrics.complexity}/10)`
    });
  }

  if (cascadeRisk.level === 'CRITICAL') {
    recommendations.push({
      priority: 'URGENT',
      category: 'CASCADE_RISK',
      action: 'Implementar controles de contención de riesgo en cascada',
      justification: `Riesgo de cascada crítico (${cascadeRisk.totalRisk}/10)`
    });
  }

  if (networkMetrics.isolationDifficulty === 'VERY_HIGH') {
    recommendations.push({
      priority: 'HIGH',
      category: 'ISOLATION',
      action: 'Desarrollar estrategias de aislamiento de emergencia',
      justification: 'Muy difícil de aislar en caso de incidente'
    });
  }

  patterns.forEach(pattern => {
    if (pattern.risk === 'CRITICAL' || pattern.risk === 'HIGH') {
      recommendations.push({
        priority: pattern.risk === 'CRITICAL' ? 'URGENT' : 'HIGH',
        category: 'PATTERN',
        action: pattern.recommendation,
        justification: pattern.description
      });
    }
  });

  return recommendations;
};

const findColumnIndex = (headers, possibleNames) => {
  for (const name of possibleNames) {
    const index = headers.findIndex(header => 
      header.includes(name) || name.includes(header)
    );
    if (index !== -1) return index;
  }
  return -1;
};

const extractAssetData = (row, columnMap) => {
  const data = {};
  
  Object.keys(columnMap).forEach(field => {
    const columnIndex = columnMap[field];
    if (columnIndex !== -1 && row[columnIndex] !== undefined) {
      let value = row[columnIndex];
      
      // Limpiar y convertir valores
      if (typeof value === 'string') {
        value = value.trim();
      }
      
      // Convertir valores numéricos para las dimensiones de valoración
      if (['confidentiality', 'integrity', 'availability', 'authenticity', 'traceability', 'economicValue'].includes(field)) {
        const numValue = parseFloat(value);
        value = isNaN(numValue) ? 0 : numValue;
        
        // Validar rango para dimensiones MAGERIT
        if (field !== 'economicValue' && (value < 0 || value > 10)) {
          value = 0;
        }
      }
      
      data[field] = value;
    }
  });
  
  return data;
};

const validateAssetData = (data, rowNum) => {
  const errors = [];
  
  if (!data.name || data.name.length < 3) {
    errors.push('Nombre requerido (mínimo 3 caracteres)');
  }
  
  if (!data.code || data.code.length < 2) {
    errors.push('Código requerido (mínimo 2 caracteres)');
  }
  
  if (!data.type) {
    errors.push('Tipo requerido');
  }
  
  if (!data.subtype) {
    errors.push('Subtipo requerido');
  }
  
  // Validar que el código no contenga caracteres especiales problemáticos
  if (data.code && !/^[A-Za-z0-9\-_.]+$/.test(data.code)) {
    errors.push('Código contiene caracteres no válidos (solo letras, números, guiones y puntos)');
  }
  
  return errors;
};

const findUserByEmailOrName = async (identifier, organizationId) => {
  const User = require('../models/User');
  
  // Buscar por email primero
  let user = await User.findOne({
    email: identifier,
    organization: organizationId,
    isActive: true
  });
  
  // Si no se encuentra, buscar por nombre
  if (!user) {
    const nameParts = identifier.split(' ');
    if (nameParts.length >= 2) {
      user = await User.findOne({
        'profile.firstName': new RegExp(nameParts[0], 'i'),
        'profile.lastName': new RegExp(nameParts[nameParts.length - 1], 'i'),
        organization: organizationId,
        isActive: true
      });
    }
  }
  
  return user;
};

const getTypeNameByCode = (typeCode) => {
  const assetTypes = Asset.getAssetTypes();
  const type = Object.values(assetTypes).find(t => t.code === typeCode);
  return type ? type.name : typeCode;
};

const getSubtypeNameByCode = (typeCode, subtypeCode) => {
  const assetTypes = Asset.getAssetTypes();
  const type = Object.values(assetTypes).find(t => t.code === typeCode);
  
  if (type) {
    const subtype = Object.values(type.subtypes).find(st => st.code === subtypeCode);
    return subtype ? subtype.name : subtypeCode;
  }
  
  return subtypeCode;
};

const generateExportSummary = (assets) => {
  const summary = [];
  
  // Resumen general
  summary.push({
    'Métrica': 'Total de Activos',
    'Valor': assets.length,
    'Descripción': 'Número total de activos exportados'
  });
  
  // Por tipo
  const typeCount = {};
  assets.forEach(asset => {
    typeCount[asset.type] = (typeCount[asset.type] || 0) + 1;
  });
  
  Object.entries(typeCount).forEach(([type, count]) => {
    summary.push({
      'Métrica': `Activos Tipo ${getTypeNameByCode(type)}`,
      'Valor': count,
      'Descripción': `Número de activos de tipo ${type}`
    });
  });
  
  // Por criticidad
  const criticalityCount = {};
  assets.forEach(asset => {
    criticalityCount[asset.criticality.level] = (criticalityCount[asset.criticality.level] || 0) + 1;
  });
  
  Object.entries(criticalityCount).forEach(([level, count]) => {
    summary.push({
      'Métrica': `Criticidad ${level}`,
      'Valor': count,
      'Descripción': `Activos con criticidad ${level}`
    });
  });
  
  // Valor económico total
  const totalEconomicValue = assets.reduce((sum, asset) => sum + (asset.economicValue || 0), 0);
  summary.push({
    'Métrica': 'Valor Económico Total (USD)',
    'Valor': totalEconomicValue.toLocaleString('en-US'),
    'Descripción': 'Suma del valor económico de todos los activos'
  });
  
  return summary;
};

const generateTaxonomySheet = () => {
  const taxonomy = [];
  const assetTypes = Asset.getAssetTypes();
  
  Object.values(assetTypes).forEach(type => {
    Object.values(type.subtypes).forEach(subtype => {
      taxonomy.push({
        'Código Tipo': type.code,
        'Nombre Tipo': type.name,
        'Código Subtipo': subtype.code,
        'Nombre Subtipo': subtype.name,
        'Descripción': `${type.name} - ${subtype.name}`
      });
    });
  });
  
  return taxonomy;
};

const generateMageritCodesSheet = () => {
  const codes = [];
  const assetTypes = Asset.getAssetTypes();
  
  Object.values(assetTypes).forEach(type => {
    codes.push({
      'Código': type.code,
      'Tipo': 'TIPO',
      'Nombre': type.name,
      'Padre': '',
      'Descripción': `Categoría principal: ${type.name}`
    });
    
    Object.values(type.subtypes).forEach(subtype => {
      codes.push({
        'Código': subtype.code,
        'Tipo': 'SUBTIPO',
        'Nombre': subtype.name,
        'Padre': type.code,
        'Descripción': `Subcategoría de ${type.name}`
      });
    });
  });
  
  return codes;
};

const calculateAssetSimilarity = (asset1, asset2) => {
  let score = 0;
  let factors = [];
  
  // Similaridad de nombre (40%)
  const nameSimilarity = calculateStringSimilarity(asset1.name, asset2.name);
  score += nameSimilarity * 0.4;
  factors.push({ factor: 'name', similarity: nameSimilarity, weight: 0.4 });
  
  // Mismo tipo (20%)
  if (asset1.type === asset2.type) {
    score += 0.2;
    factors.push({ factor: 'type', similarity: 1.0, weight: 0.2 });
  } else {
    factors.push({ factor: 'type', similarity: 0.0, weight: 0.2 });
  }
  
  // Mismo subtipo (15%)
  if (asset1.subtype === asset2.subtype) {
    score += 0.15;
    factors.push({ factor: 'subtype', similarity: 1.0, weight: 0.15 });
  } else {
    factors.push({ factor: 'subtype', similarity: 0.0, weight: 0.15 });
  }
  
  // Similaridad de descripción (15%)
  const descSimilarity = calculateStringSimilarity(
    asset1.description || '', 
    asset2.description || ''
  );
  score += descSimilarity * 0.15;
  factors.push({ factor: 'description', similarity: descSimilarity, weight: 0.15 });
  
  // Similaridad de valoración (10%)
  const valuationSimilarity = calculateValuationSimilarity(asset1.valuation, asset2.valuation);
  score += valuationSimilarity * 0.1;
  factors.push({ factor: 'valuation', similarity: valuationSimilarity, weight: 0.1 });
  
  return {
    score: Math.round(score * 100) / 100,
    factors,
    confidence: score >= 0.8 ? 'HIGH' : score >= 0.6 ? 'MEDIUM' : 'LOW'
  };
};

const calculateStringSimilarity = (str1, str2) => {
  if (!str1 && !str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = calculateEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const calculateEditDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

const calculateValuationSimilarity = (val1, val2) => {
  const dimensions = ['confidentiality', 'integrity', 'availability', 'authenticity', 'traceability'];
  let totalDifference = 0;
  
  dimensions.forEach(dim => {
    const diff = Math.abs((val1[dim] || 0) - (val2[dim] || 0));
    totalDifference += diff;
  });
  
  const maxPossibleDifference = dimensions.length * 10; // Máxima diferencia posible
  return 1 - (totalDifference / maxPossibleDifference);
};

module.exports = {
  analyzeDependencies,
  importFromExcel,
  exportToCsv,
  exportToExcel,
  generateImportTemplate,
  findPotentialDuplicates,
  optimizeAssetTaxonomy,
  
  // Funciones auxiliares para testing
  calculateDependencyImpact,
  calculateAssetSimilarity,
  generateExportSummary
};