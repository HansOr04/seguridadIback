const Asset = require('../models/Asset');
const Organization = require('../models/Organization');

/**
 * Servicio para implementación de metodología MAGERIT v3.0
 * Análisis cuantitativo de riesgos según estándares españoles
 * Adaptado para normativas ecuatorianas
 */

// Factores sectoriales ecuatorianos según tipo de organización
const SECTORAL_FACTORS = {
  FINANCIAL: {
    factor: 1.8,
    description: 'Sector financiero y bancario',
    regulation: 'Superintendencia de Bancos del Ecuador'
  },
  GOVERNMENT: {
    factor: 1.6,
    description: 'Sector público y gubernamental',
    regulation: 'Ministerio de Telecomunicaciones y de la Sociedad de la Información'
  },
  HEALTHCARE: {
    factor: 1.5,
    description: 'Sector salud y servicios médicos',
    regulation: 'Ministerio de Salud Pública'
  },
  EDUCATION: {
    factor: 1.3,
    description: 'Sector educativo y universidades',
    regulation: 'Ministerio de Educación'
  },
  CRITICAL_INFRASTRUCTURE: {
    factor: 1.7,
    description: 'Infraestructura crítica (energía, telecomunicaciones)',
    regulation: 'ARCOTEL, ARCERNNR'
  },
  COMMERCIAL: {
    factor: 1.2,
    description: 'Sector comercial y empresarial',
    regulation: 'Superintendencia de Compañías'
  },
  INDUSTRIAL: {
    factor: 1.1,
    description: 'Sector industrial y manufacturero',
    regulation: 'Ministerio de Producción'
  },
  OTHER: {
    factor: 1.0,
    description: 'Otros sectores',
    regulation: 'Normativas generales'
  }
};

// Niveles de madurez de valoración MAGERIT
const MATURITY_LEVELS = {
  INITIAL: {
    level: 1,
    description: 'Valoración inicial básica',
    confidence: 0.6,
    recommendedActions: ['Realizar inventario completo', 'Capacitar personal en MAGERIT']
  },
  REPEATABLE: {
    level: 2,
    description: 'Procesos repetibles de valoración',
    confidence: 0.75,
    recommendedActions: ['Documentar procedimientos', 'Establecer revisiones periódicas']
  },
  DEFINED: {
    level: 3,
    description: 'Metodología definida y documentada',
    confidence: 0.85,
    recommendedActions: ['Automatizar procesos', 'Integrar con gestión de riesgos']
  },
  MANAGED: {
    level: 4,
    description: 'Gestión cuantitativa de valoraciones',
    confidence: 0.95,
    recommendedActions: ['Optimizar métricas', 'Benchmarking sectorial']
  },
  OPTIMIZING: {
    level: 5,
    description: 'Mejora continua y optimización',
    confidence: 1.0,
    recommendedActions: ['Innovación en metodologías', 'Liderazgo sectorial']
  }
};

/**
 * Implementar taxonomía MAGERIT v3.0
 * @returns {Object} Taxonomía completa de activos
 */
const implementMageritTaxonomy = () => {
  return Asset.getAssetTypes();
};

/**
 * Calcular valor de activo según MAGERIT
 * Valor = MAX(C, I, D, A, T) * Factor_Sectorial * Factor_Dependencias
 * @param {Object} asset - Activo a valorar
 * @returns {Object} Análisis de valoración MAGERIT
 */
const calculateAssetValue = async (asset) => {
  try {
    const { valuation, sectoralFactor, dependencies } = asset;
    
    // Valores de las dimensiones MAGERIT
    const dimensions = {
      confidentiality: valuation.confidentiality || 0,
      integrity: valuation.integrity || 0,
      availability: valuation.availability || 0,
      authenticity: valuation.authenticity || 0,
      traceability: valuation.traceability || 0
    };

    // Valor máximo según MAGERIT (criterio conservador)
    const maxValue = Math.max(...Object.values(dimensions));
    
    // Factor de dependencias (incrementa valor según dependencias)
    const dependencyFactor = 1 + (dependencies.length * 0.1);
    
    // Factor sectorial
    const sectorFactor = sectoralFactor || 1.0;
    
    // Valor final MAGERIT
    const mageritValue = Math.min(10, maxValue * dependencyFactor * sectorFactor);
    
    // Análisis por dimensión
    const dimensionAnalysis = {};
    Object.keys(dimensions).forEach(dim => {
      dimensionAnalysis[dim] = {
        value: dimensions[dim],
        percentage: (dimensions[dim] / 10) * 100,
        level: getValueLevel(dimensions[dim]),
        isCritical: dimensions[dim] >= 8,
        isMaximum: dimensions[dim] === maxValue
      };
    });

    // Recomendaciones basadas en valoración
    const recommendations = generateValuationRecommendations(dimensions, maxValue);

    return {
      mageritValue: Math.round(mageritValue * 100) / 100,
      maxDimensionValue: maxValue,
      criticalDimensions: Object.keys(dimensions).filter(dim => dimensions[dim] >= 8),
      dimensionAnalysis,
      factors: {
        sectoral: sectorFactor,
        dependency: dependencyFactor,
        final: sectorFactor * dependencyFactor
      },
      recommendations,
      classification: classifyAssetValue(mageritValue),
      complianceLevel: assessComplianceLevel(asset)
    };

  } catch (error) {
    console.error('Error calculating MAGERIT value:', error);
    throw new Error('Error en el cálculo de valor MAGERIT');
  }
};

/**
 * Calcular valor económico sectorial
 * @param {Object} asset - Activo
 * @param {string} sector - Sector organizacional
 * @returns {Object} Análisis económico sectorial
 */
const calculateEconomicValue = async (asset, sector = 'OTHER') => {
  try {
    const sectoralData = SECTORAL_FACTORS[sector] || SECTORAL_FACTORS.OTHER;
    const baseEconomicValue = asset.economicValue || 0;
    
    // Valor económico ajustado por sector
    const adjustedValue = baseEconomicValue * sectoralData.factor;
    
    // Valor por pérdida de confidencialidad
    const confidentialityLoss = calculateDimensionLoss(
      'confidentiality', 
      asset.valuation.confidentiality, 
      adjustedValue
    );
    
    // Valor por pérdida de integridad
    const integrityLoss = calculateDimensionLoss(
      'integrity', 
      asset.valuation.integrity, 
      adjustedValue
    );
    
    // Valor por pérdida de disponibilidad
    const availabilityLoss = calculateDimensionLoss(
      'availability', 
      asset.valuation.availability, 
      adjustedValue
    );

    // Análisis de impacto económico por día
    const dailyImpact = {
      confidentiality: confidentialityLoss * 0.1, // Impacto gradual
      integrity: integrityLoss * 0.8, // Impacto alto inmediato
      availability: availabilityLoss * 1.0 // Impacto máximo inmediato
    };

    return {
      baseValue: baseEconomicValue,
      adjustedValue,
      sectoralFactor: sectoralData.factor,
      sector: sectoralData.description,
      regulation: sectoralData.regulation,
      potentialLosses: {
        confidentiality: confidentialityLoss,
        integrity: integrityLoss,
        availability: availabilityLoss,
        maximum: Math.max(confidentialityLoss, integrityLoss, availabilityLoss)
      },
      dailyImpact,
      annualRisk: calculateAnnualRisk(adjustedValue, asset.valuation),
      recommendations: generateEconomicRecommendations(adjustedValue, dailyImpact)
    };

  } catch (error) {
    console.error('Error calculating economic value:', error);
    throw new Error('Error en el cálculo de valor económico sectorial');
  }
};

/**
 * Mapear dependencias entre activos
 * @param {Object} asset - Activo principal
 * @returns {Object} Mapa de dependencias
 */
const mapDependencies = async (asset) => {
  try {
    // Obtener activos dependientes (que dependen de este activo)
    const dependentAssets = await Asset.find({
      organization: asset.organization,
      'dependencies.assetId': asset._id
    }).select('name code type criticality dependencies').lean();

    // Analizar dependencias salientes (de este activo hacia otros)
    const outgoingDependencies = [];
    for (const dependency of asset.dependencies) {
      const targetAsset = await Asset.findById(dependency.assetId)
        .select('name code type criticality valuation').lean();
      
      if (targetAsset) {
        outgoingDependencies.push({
          asset: targetAsset,
          type: dependency.dependencyType,
          description: dependency.description,
          impactFactor: dependency.impactFactor,
          riskPropagation: calculateRiskPropagation(asset, targetAsset, dependency)
        });
      }
    }

    // Analizar dependencias entrantes
    const incomingDependencies = dependentAssets.map(depAsset => {
      const dependency = depAsset.dependencies.find(
        dep => dep.assetId.toString() === asset._id.toString()
      );
      
      return {
        asset: {
          _id: depAsset._id,
          name: depAsset.name,
          code: depAsset.code,
          type: depAsset.type,
          criticality: depAsset.criticality
        },
        type: dependency.dependencyType,
        description: dependency.description,
        impactFactor: dependency.impactFactor
      };
    });

    // Calcular métricas de dependencias
    const metrics = {
      outgoingCount: outgoingDependencies.length,
      incomingCount: incomingDependencies.length,
      totalConnections: outgoingDependencies.length + incomingDependencies.length,
      criticalDependencies: outgoingDependencies.filter(dep => 
        dep.type === 'ESSENTIAL' || dep.asset.criticality.level === 'CRITICAL'
      ).length,
      dependencyScore: calculateDependencyScore(outgoingDependencies, incomingDependencies)
    };

    // Identificar puntos críticos
    const criticalPoints = identifyCriticalPoints(outgoingDependencies, incomingDependencies);

    return {
      outgoingDependencies,
      incomingDependencies,
      metrics,
      criticalPoints,
      impactAnalysis: analyzeDependencyImpact(asset, outgoingDependencies, incomingDependencies),
      recommendations: generateDependencyRecommendations(metrics, criticalPoints)
    };

  } catch (error) {
    console.error('Error mapping dependencies:', error);
    throw new Error('Error en el mapeo de dependencias');
  }
};

/**
 * Validar cumplimiento MAGERIT
 * @param {Object} asset - Activo a validar
 * @returns {Object} Análisis de cumplimiento
 */
const validateMageritCompliance = (asset) => {
  const compliance = {
    score: 0,
    maxScore: 100,
    issues: [],
    recommendations: [],
    level: 'NON_COMPLIANT'
  };

  // Validación 1: Información básica completa (20 puntos)
  if (asset.name && asset.code && asset.description) {
    compliance.score += 20;
  } else {
    compliance.issues.push('Información básica incompleta');
    compliance.recommendations.push('Completar nombre, código y descripción del activo');
  }

  // Validación 2: Taxonomía MAGERIT correcta (15 puntos)
  if (asset.type && asset.subtype && Asset.validateSubtype(asset.type, asset.subtype)) {
    compliance.score += 15;
  } else {
    compliance.issues.push('Taxonomía MAGERIT incorrecta');
    compliance.recommendations.push('Revisar clasificación según taxonomía MAGERIT v3.0');
  }

  // Validación 3: Valoración en todas las dimensiones (25 puntos)
  const dimensions = ['confidentiality', 'integrity', 'availability', 'authenticity', 'traceability'];
  const valuedDimensions = dimensions.filter(dim => 
    asset.valuation[dim] !== undefined && asset.valuation[dim] > 0
  );
  
  if (valuedDimensions.length === dimensions.length) {
    compliance.score += 25;
  } else {
    compliance.issues.push(`Solo ${valuedDimensions.length}/${dimensions.length} dimensiones valoradas`);
    compliance.recommendations.push('Completar valoración en todas las dimensiones MAGERIT');
  }

  // Validación 4: Propietario y responsable asignados (15 puntos)
  if (asset.owner?.userId && asset.owner?.name) {
    compliance.score += 15;
  } else {
    compliance.issues.push('Propietario no asignado');
    compliance.recommendations.push('Asignar propietario responsable del activo');
  }

  // Validación 5: Documentación y metadatos (10 puntos)
  if (asset.metadata && Object.keys(asset.metadata).length > 0) {
    compliance.score += 10;
  } else {
    compliance.issues.push('Metadatos insuficientes');
    compliance.recommendations.push('Agregar metadatos relevantes (versión, proveedor, etc.)');
  }

  // Validación 6: Factor sectorial aplicado (10 puntos)
  if (asset.sectoralFactor && asset.sectoralFactor !== 1.0) {
    compliance.score += 10;
  } else {
    compliance.issues.push('Factor sectorial no aplicado');
    compliance.recommendations.push('Aplicar factor sectorial según normativas ecuatorianas');
  }

  // Validación 7: Análisis de dependencias (5 puntos)
  if (asset.dependencies && asset.dependencies.length > 0) {
    compliance.score += 5;
  } else {
    compliance.recommendations.push('Evaluar y documentar dependencias del activo');
  }

  // Determinar nivel de cumplimiento
  if (compliance.score >= 90) {
    compliance.level = 'FULLY_COMPLIANT';
  } else if (compliance.score >= 70) {
    compliance.level = 'MOSTLY_COMPLIANT';
  } else if (compliance.score >= 50) {
    compliance.level = 'PARTIALLY_COMPLIANT';
  } else {
    compliance.level = 'NON_COMPLIANT';
  }

  compliance.percentage = Math.round((compliance.score / compliance.maxScore) * 100);

  return compliance;
};

/**
 * Generar reporte metodología MAGERIT
 * @param {Array} assets - Lista de activos
 * @param {Object} organization - Organización
 * @returns {Object} Reporte MAGERIT completo
 */
const generateMageritReport = async (assets, organization) => {
  try {
    const report = {
      metadata: {
        organizationName: organization.name,
        reportDate: new Date().toISOString(),
        mageritVersion: '3.0',
        totalAssets: assets.length,
        reportType: 'COMPREHENSIVE_MAGERIT_ANALYSIS'
      },
      executiveSummary: {},
      assetAnalysis: {},
      complianceAnalysis: {},
      riskSummary: {},
      recommendations: {},
      appendices: {}
    };

    // Resumen ejecutivo
    const totalEconomicValue = assets.reduce((sum, asset) => sum + (asset.economicValue || 0), 0);
    const criticalAssets = assets.filter(asset => asset.criticality.level === 'CRITICAL').length;
    
    report.executiveSummary = {
      totalAssets: assets.length,
      totalEconomicValue,
      criticalAssets,
      averageCriticality: assets.reduce((sum, asset) => sum + asset.criticality.score, 0) / assets.length,
      complianceOverview: calculateOverallCompliance(assets),
      keyFindings: generateKeyFindings(assets)
    };

    // Análisis por tipo de activo
    const typeAnalysis = {};
    const assetTypes = Asset.getAssetTypes();
    
    Object.values(assetTypes).forEach(type => {
      const typeAssets = assets.filter(asset => asset.type === type.code);
      if (typeAssets.length > 0) {
        typeAnalysis[type.code] = {
          name: type.name,
          count: typeAssets.length,
          averageValue: typeAssets.reduce((sum, asset) => sum + asset.criticality.score, 0) / typeAssets.length,
          economicValue: typeAssets.reduce((sum, asset) => sum + (asset.economicValue || 0), 0),
          criticalAssets: typeAssets.filter(asset => asset.criticality.level === 'CRITICAL').length,
          complianceRate: calculateTypeCompliance(typeAssets)
        };
      }
    });

    report.assetAnalysis = {
      byType: typeAnalysis,
      topCritical: assets
        .sort((a, b) => b.criticality.score - a.criticality.score)
        .slice(0, 10)
        .map(asset => ({
          name: asset.name,
          code: asset.code,
          type: asset.type,
          criticality: asset.criticality,
          economicValue: asset.economicValue
        })),
      dependencyAnalysis: await analyzeDependencyComplexity(assets)
    };

    // Análisis de cumplimiento
    const complianceResults = assets.map(asset => validateMageritCompliance(asset));
    report.complianceAnalysis = {
      overallScore: complianceResults.reduce((sum, result) => sum + result.score, 0) / complianceResults.length,
      complianceLevels: {
        FULLY_COMPLIANT: complianceResults.filter(r => r.level === 'FULLY_COMPLIANT').length,
        MOSTLY_COMPLIANT: complianceResults.filter(r => r.level === 'MOSTLY_COMPLIANT').length,
        PARTIALLY_COMPLIANT: complianceResults.filter(r => r.level === 'PARTIALLY_COMPLIANT').length,
        NON_COMPLIANT: complianceResults.filter(r => r.level === 'NON_COMPLIANT').length
      },
      commonIssues: identifyCommonIssues(complianceResults),
      improvementPlan: generateImprovementPlan(complianceResults)
    };

    // Resumen de riesgos
    report.riskSummary = {
      totalExposure: calculateTotalExposure(assets),
      riskDistribution: calculateRiskDistribution(assets),
      criticalRisks: identifyCriticalRisks(assets),
      mitigationPriorities: generateMitigationPriorities(assets)
    };

    // Recomendaciones estratégicas
    report.recommendations = {
      immediate: generateImmediateRecommendations(assets, complianceResults),
      shortTerm: generateShortTermRecommendations(assets, organization),
      longTerm: generateLongTermRecommendations(assets, organization),
      regulatory: generateRegulatoryRecommendations(organization)
    };

    return report;

  } catch (error) {
    console.error('Error generating MAGERIT report:', error);
    throw new Error('Error en la generación del reporte MAGERIT');
  }
};

/**
 * Analizar valoración de activo
 * @param {Object} asset - Activo analizado
 * @returns {Object} Análisis de valoración
 */
const analyzeAssetValuation = async (asset) => {
  try {
    const mageritValue = await calculateAssetValue(asset);
    const economicAnalysis = await calculateEconomicValue(asset);
    const dependencyMap = await mapDependencies(asset);
    const compliance = validateMageritCompliance(asset);

    return {
      asset: {
        id: asset._id,
        name: asset.name,
        code: asset.code,
        type: asset.type
      },
      valuation: mageritValue,
      economic: economicAnalysis,
      dependencies: dependencyMap,
      compliance,
      maturityLevel: assessMaturityLevel(asset, compliance),
      recommendations: generateAssetRecommendations(mageritValue, compliance, dependencyMap)
    };

  } catch (error) {
    console.error('Error analyzing asset valuation:', error);
    throw new Error('Error en el análisis de valoración del activo');
  }
};

// Funciones auxiliares

const getValueLevel = (value) => {
  if (value >= 9) return 'CRITICAL';
  if (value >= 7) return 'HIGH';
  if (value >= 5) return 'MEDIUM';
  if (value >= 3) return 'LOW';
  return 'VERY_LOW';
};

const classifyAssetValue = (value) => {
  const level = getValueLevel(value);
  const classifications = {
    CRITICAL: { color: '#dc2626', priority: 'URGENT', description: 'Activo crítico - Requiere máxima protección' },
    HIGH: { color: '#f97316', priority: 'HIGH', description: 'Activo importante - Requiere protección reforzada' },
    MEDIUM: { color: '#f59e0b', priority: 'MEDIUM', description: 'Activo estándar - Requiere protección normal' },
    LOW: { color: '#84cc16', priority: 'LOW', description: 'Activo de bajo impacto' },
    VERY_LOW: { color: '#10b981', priority: 'MINIMAL', description: 'Activo de impacto mínimo' }
  };
  return { level, ...classifications[level] };
};

const calculateDimensionLoss = (dimension, value, economicValue) => {
  const lossPercentages = {
    confidentiality: Math.min(value * 10, 100), // 10% por nivel
    integrity: Math.min(value * 15, 100), // 15% por nivel  
    availability: Math.min(value * 20, 100) // 20% por nivel
  };
  
  const percentage = lossPercentages[dimension] || value * 10;
  return (economicValue * percentage) / 100;
};

const calculateAnnualRisk = (economicValue, valuation) => {
  const maxValue = Math.max(...Object.values(valuation));
  const riskProbability = maxValue / 10; // Probabilidad basada en valoración
  return economicValue * riskProbability * 0.3; // 30% de probabilidad anual estimada
};

const generateValuationRecommendations = (dimensions, maxValue) => {
  const recommendations = [];
  
  if (maxValue >= 8) {
    recommendations.push('Implementar controles de seguridad reforzados');
    recommendations.push('Establecer monitoreo continuo');
  }
  
  if (dimensions.confidentiality >= 7) {
    recommendations.push('Implementar cifrado de datos');
    recommendations.push('Controlar acceso estrictamente');
  }
  
  if (dimensions.availability >= 7) {
    recommendations.push('Implementar alta disponibilidad');
    recommendations.push('Establecer planes de continuidad');
  }
  
  return recommendations;
};

const generateEconomicRecommendations = (adjustedValue, dailyImpact) => {
  const recommendations = [];
  const maxDailyImpact = Math.max(...Object.values(dailyImpact));
  
  if (adjustedValue > 100000) {
    recommendations.push('Considerar seguro de ciberseguridad');
    recommendations.push('Implementar análisis cuantitativo detallado');
  }
  
  if (maxDailyImpact > 10000) {
    recommendations.push('Establecer procedimientos de respuesta rápida');
    recommendations.push('Implementar respaldo automático');
  }
  
  return recommendations;
};

const calculateRiskPropagation = (sourceAsset, targetAsset, dependency) => {
  const sourceRisk = sourceAsset.criticality.score;
  const targetRisk = targetAsset.criticality.score;
  const impactFactor = dependency.impactFactor || 1;
  
  return {
    propagationScore: Math.min(10, sourceRisk * impactFactor * 0.8),
    riskIncrease: (sourceRisk * impactFactor * 0.3),
    totalRisk: Math.min(10, targetRisk + (sourceRisk * impactFactor * 0.3))
  };
};

const calculateDependencyScore = (outgoing, incoming) => {
  const outgoingWeight = outgoing.length * 0.6;
  const incomingWeight = incoming.length * 0.4;
  const criticalWeight = outgoing.filter(dep => dep.type === 'ESSENTIAL').length * 0.8;
  
  return Math.min(10, outgoingWeight + incomingWeight + criticalWeight);
};

const identifyCriticalPoints = (outgoing, incoming) => {
  const criticalPoints = [];
  
  // Dependencias esenciales salientes
  const essentialOutgoing = outgoing.filter(dep => dep.type === 'ESSENTIAL');
  if (essentialOutgoing.length > 0) {
    criticalPoints.push({
      type: 'ESSENTIAL_DEPENDENCIES',
      count: essentialOutgoing.length,
      impact: 'HIGH',
      description: 'Activos esenciales de los que depende este activo'
    });
  }
  
  // Alto número de dependencias entrantes (punto de fallo común)
  if (incoming.length >= 5) {
    criticalPoints.push({
      type: 'SINGLE_POINT_OF_FAILURE',
      count: incoming.length,
      impact: 'CRITICAL',
      description: 'Muchos activos dependen de este - punto único de fallo'
    });
  }
  
  return criticalPoints;
};

const analyzeDependencyImpact = (asset, outgoing, incoming) => {
  return {
    upstreamImpact: outgoing.reduce((sum, dep) => sum + (dep.impactFactor || 1), 0),
    downstreamImpact: incoming.length * 1.5, // Cada dependiente aumenta impacto
    cascadeRisk: calculateCascadeRisk(outgoing, incoming),
    isolationPotential: assessIsolationPotential(asset, outgoing, incoming)
  };
};

const calculateCascadeRisk = (outgoing, incoming) => {
  const cascadePotential = (outgoing.length * 0.3) + (incoming.length * 0.7);
  return Math.min(10, cascadePotential);
};

const assessIsolationPotential = (asset, outgoing, incoming) => {
  const essentialDeps = outgoing.filter(dep => dep.type === 'ESSENTIAL').length;
  if (essentialDeps === 0) return 'HIGH';
  if (essentialDeps <= 2) return 'MEDIUM';
  return 'LOW';
};

const generateDependencyRecommendations = (metrics, criticalPoints) => {
  const recommendations = [];
  
  if (metrics.dependencyScore >= 7) {
    recommendations.push('Revisar arquitectura para reducir complejidad de dependencias');
  }
  
  if (criticalPoints.some(cp => cp.type === 'SINGLE_POINT_OF_FAILURE')) {
    recommendations.push('Implementar redundancia para evitar punto único de fallo');
  }
  
  if (metrics.criticalDependencies >= 3) {
    recommendations.push('Diversificar dependencias críticas');
  }
  
  return recommendations;
};

const assessComplianceLevel = (asset) => {
  const compliance = validateMageritCompliance(asset);
  return {
    level: compliance.level,
    score: compliance.score,
    percentage: compliance.percentage
  };
};

const calculateOverallCompliance = (assets) => {
  const results = assets.map(asset => validateMageritCompliance(asset));
  const avgScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
  
  return {
    averageScore: Math.round(avgScore),
    percentage: Math.round((avgScore / 100) * 100),
    distribution: {
      FULLY_COMPLIANT: results.filter(r => r.level === 'FULLY_COMPLIANT').length,
      MOSTLY_COMPLIANT: results.filter(r => r.level === 'MOSTLY_COMPLIANT').length,
      PARTIALLY_COMPLIANT: results.filter(r => r.level === 'PARTIALLY_COMPLIANT').length,
      NON_COMPLIANT: results.filter(r => r.level === 'NON_COMPLIANT').length
    }
  };
};

const generateKeyFindings = (assets) => {
  const findings = [];
  
  const criticalCount = assets.filter(a => a.criticality.level === 'CRITICAL').length;
  if (criticalCount > 0) {
    findings.push(`${criticalCount} activos clasificados como críticos requieren atención inmediata`);
  }
  
  const unvaluedAssets = assets.filter(a => 
    Object.values(a.valuation).every(v => v === 0)
  ).length;
  if (unvaluedAssets > 0) {
    findings.push(`${unvaluedAssets} activos sin valoración MAGERIT completa`);
  }
  
  return findings;
};

const calculateTypeCompliance = (typeAssets) => {
  const results = typeAssets.map(asset => validateMageritCompliance(asset));
  const compliantAssets = results.filter(r => r.level === 'FULLY_COMPLIANT' || r.level === 'MOSTLY_COMPLIANT').length;
  return Math.round((compliantAssets / typeAssets.length) * 100);
};

const analyzeDependencyComplexity = async (assets) => {
  const totalDependencies = assets.reduce((sum, asset) => sum + asset.dependencies.length, 0);
  const assetsWithDependencies = assets.filter(asset => asset.dependencies.length > 0).length;
  
  return {
    totalDependencies,
    averageDependencies: totalDependencies / assets.length,
    assetsWithDependencies,
    complexAssets: assets.filter(asset => asset.dependencies.length >= 5).length,
    dependencyRate: (assetsWithDependencies / assets.length) * 100
  };
};

const identifyCommonIssues = (complianceResults) => {
  const issueCount = {};
  complianceResults.forEach(result => {
    result.issues.forEach(issue => {
      issueCount[issue] = (issueCount[issue] || 0) + 1;
    });
  });
  
  return Object.entries(issueCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([issue, count]) => ({ issue, count, percentage: (count / complianceResults.length) * 100 }));
};

const generateImprovementPlan = (complianceResults) => {
  const nonCompliant = complianceResults.filter(r => r.level === 'NON_COMPLIANT').length;
  const partially = complianceResults.filter(r => r.level === 'PARTIALLY_COMPLIANT').length;
  
  const plan = {
    phase1: {
      duration: '1-3 meses',
      priority: 'URGENT',
      actions: []
    },
    phase2: {
      duration: '3-6 meses',
      priority: 'HIGH',
      actions: []
    },
    phase3: {
      duration: '6-12 meses',
      priority: 'MEDIUM',
      actions: []
    }
  };
  
  if (nonCompliant > 0) {
    plan.phase1.actions.push(`Remediar ${nonCompliant} activos no conformes`);
  }
  
  if (partially > 0) {
    plan.phase2.actions.push(`Completar valoración de ${partially} activos parcialmente conformes`);
  }
  
  return plan;
};

const calculateTotalExposure = (assets) => {
  return assets.reduce((total, asset) => {
    const maxValue = Math.max(...Object.values(asset.valuation));
    return total + (asset.economicValue * (maxValue / 10));
  }, 0);
};

const calculateRiskDistribution = (assets) => {
  const distribution = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    VERY_LOW: 0
  };
  
  assets.forEach(asset => {
    distribution[asset.criticality.level]++;
  });
  
  return distribution;
};

const identifyCriticalRisks = (assets) => {
  return assets
    .filter(asset => asset.criticality.level === 'CRITICAL')
    .map(asset => ({
      assetId: asset._id,
      name: asset.name,
      code: asset.code,
      type: asset.type,
      criticality: asset.criticality.score,
      economicValue: asset.economicValue,
      maxDimension: Math.max(...Object.values(asset.valuation)),
      dependencies: asset.dependencies.length,
      riskFactors: identifyAssetRiskFactors(asset)
    }));
};

const identifyAssetRiskFactors = (asset) => {
  const factors = [];
  
  if (asset.valuation.confidentiality >= 8) factors.push('CONFIDENTIALITY_CRITICAL');
  if (asset.valuation.integrity >= 8) factors.push('INTEGRITY_CRITICAL');
  if (asset.valuation.availability >= 8) factors.push('AVAILABILITY_CRITICAL');
  if (asset.dependencies.length >= 5) factors.push('HIGH_DEPENDENCY');
  if (asset.economicValue >= 100000) factors.push('HIGH_ECONOMIC_VALUE');
  
  return factors;
};

const generateMitigationPriorities = (assets) => {
  const criticalAssets = assets.filter(asset => asset.criticality.level === 'CRITICAL');
  const highAssets = assets.filter(asset => asset.criticality.level === 'HIGH');
  
  return {
    immediate: criticalAssets.slice(0, 5).map(asset => ({
      asset: { name: asset.name, code: asset.code },
      priority: 'URGENT',
      actions: ['Implementar controles críticos', 'Monitoreo 24/7', 'Plan de contingencia']
    })),
    shortTerm: highAssets.slice(0, 10).map(asset => ({
      asset: { name: asset.name, code: asset.code },
      priority: 'HIGH',
      actions: ['Reforzar controles', 'Establecer métricas', 'Revisión trimestral']
    }))
  };
};

const generateImmediateRecommendations = (assets, complianceResults) => {
  const recommendations = [];
  
  const criticalNonCompliant = assets.filter(asset => 
    asset.criticality.level === 'CRITICAL' && 
    complianceResults.find(r => r.level === 'NON_COMPLIANT')
  );
  
  if (criticalNonCompliant.length > 0) {
    recommendations.push({
      priority: 'URGENT',
      action: 'Remediar activos críticos no conformes',
      timeline: '1-2 semanas',
      impact: 'CRITICAL'
    });
  }
  
  const unvaluedCritical = assets.filter(asset => 
    Object.values(asset.valuation).every(v => v === 0) && 
    asset.economicValue > 50000
  );
  
  if (unvaluedCritical.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Valorar activos de alto valor económico',
      timeline: '2-4 semanas',
      impact: 'HIGH'
    });
  }
  
  return recommendations;
};

const generateShortTermRecommendations = (assets, organization) => {
  const recommendations = [];
  
  // Recomendación de entrenamiento
  recommendations.push({
    category: 'TRAINING',
    action: 'Capacitar equipos en metodología MAGERIT',
    timeline: '1-3 meses',
    resources: 'Equipo de ciberseguridad, consultores externos',
    impact: 'MEDIUM'
  });
  
  // Recomendación de herramientas
  const totalAssets = assets.length;
  if (totalAssets > 100) {
    recommendations.push({
      category: 'TOOLS',
      action: 'Implementar herramientas de gestión automatizada',
      timeline: '2-4 meses',
      resources: 'Software GRC, integración SIGRISK-EC',
      impact: 'HIGH'
    });
  }
  
  return recommendations;
};

const generateLongTermRecommendations = (assets, organization) => {
  const recommendations = [];
  
  // Certificación ISO 27001
  recommendations.push({
    category: 'CERTIFICATION',
    action: 'Evaluar certificación ISO 27001',
    timeline: '6-12 meses',
    resources: 'Consultoría especializada, auditoría externa',
    impact: 'STRATEGIC'
  });
  
  // Centro de Operaciones de Seguridad
  const criticalAssets = assets.filter(a => a.criticality.level === 'CRITICAL').length;
  if (criticalAssets >= 10) {
    recommendations.push({
      category: 'SOC',
      action: 'Establecer SOC (Security Operations Center)',
      timeline: '9-18 meses',
      resources: 'Personal especializado, infraestructura 24/7',
      impact: 'STRATEGIC'
    });
  }
  
  return recommendations;
};

const generateRegulatoryRecommendations = (organization) => {
  const recommendations = [];
  
  // Ley de Protección de Datos Ecuador
  recommendations.push({
    regulation: 'Ley Orgánica de Protección de Datos Personales',
    authority: 'Superintendencia de Control del Poder de Mercado',
    requirements: [
      'Registro de tratamientos de datos personales',
      'Evaluaciones de impacto en protección de datos',
      'Medidas de seguridad técnicas y organizativas'
    ],
    timeline: 'Cumplimiento continuo'
  });
  
  // Sector específico
  if (organization.sector === 'FINANCIAL') {
    recommendations.push({
      regulation: 'Normas Superintendencia de Bancos',
      authority: 'Superintendencia de Bancos del Ecuador',
      requirements: [
        'Gestión integral de riesgos tecnológicos',
        'Plan de continuidad del negocio',
        'Reportes periódicos de ciberseguridad'
      ],
      timeline: 'Reportes trimestrales'
    });
  }
  
  return recommendations;
};

const assessMaturityLevel = (asset, compliance) => {
  let maturityScore = 0;
  
  // Valoración completa
  if (compliance.score >= 80) maturityScore += 2;
  else if (compliance.score >= 60) maturityScore += 1;
  
  // Dependencias documentadas
  if (asset.dependencies && asset.dependencies.length > 0) maturityScore += 1;
  
  // Metadatos completos
  if (asset.metadata && Object.keys(asset.metadata).length >= 3) maturityScore += 1;
  
  // Auditoría y seguimiento
  if (asset.auditTrail && asset.auditTrail.length >= 3) maturityScore += 1;
  
  // Determinar nivel de madurez
  if (maturityScore >= 5) return MATURITY_LEVELS.OPTIMIZING;
  if (maturityScore >= 4) return MATURITY_LEVELS.MANAGED;
  if (maturityScore >= 3) return MATURITY_LEVELS.DEFINED;
  if (maturityScore >= 2) return MATURITY_LEVELS.REPEATABLE;
  return MATURITY_LEVELS.INITIAL;
};

const generateAssetRecommendations = (mageritValue, compliance, dependencyMap) => {
  const recommendations = [];
  
  // Recomendaciones por valoración
  if (mageritValue.mageritValue >= 8) {
    recommendations.push({
      category: 'PROTECTION',
      priority: 'URGENT',
      action: 'Implementar controles de seguridad de nivel crítico',
      justification: 'Activo de valor crítico según metodología MAGERIT'
    });
  }
  
  // Recomendaciones por cumplimiento
  if (compliance.level === 'NON_COMPLIANT') {
    recommendations.push({
      category: 'COMPLIANCE',
      priority: 'HIGH',
      action: 'Completar valoración MAGERIT según estándares',
      justification: `Cumplimiento actual: ${compliance.percentage}%`
    });
  }
  
  // Recomendaciones por dependencias
  if (dependencyMap.metrics.dependencyScore >= 7) {
    recommendations.push({
      category: 'ARCHITECTURE',
      priority: 'MEDIUM',
      action: 'Revisar y simplificar arquitectura de dependencias',
      justification: 'Alta complejidad de dependencias aumenta riesgo'
    });
  }
  
  return recommendations;
};

module.exports = {
  implementMageritTaxonomy,
  calculateAssetValue,
  calculateEconomicValue,
  mapDependencies,
  validateMageritCompliance,
  generateMageritReport,
  analyzeAssetValuation,
  
  // Constantes exportadas
  SECTORAL_FACTORS,
  MATURITY_LEVELS,
  
  // Funciones auxiliares exportadas para testing
  getValueLevel,
  classifyAssetValue,
  calculateDimensionLoss,
  assessMaturityLevel
};