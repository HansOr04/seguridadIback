const Risk = require('../models/Risk');
const Asset = require('../models/Asset');
const Threat = require('../models/Threat');
const Vulnerability = require('../models/Vulnerability');
const RiskMatrix = require('../models/RiskMatrix');

class RiskCalculationService {
  
  /**
   * Calcular riesgo base según metodología MAGERIT
   * Fórmula: Riesgo = Amenaza × Vulnerabilidad × Impacto
   */
  static async calculateBaseRisk(assetId, threatId, vulnerabilityId, organizationId) {
    try {
      // Obtener entidades relacionadas
      const [asset, threat, vulnerability] = await Promise.all([
        Asset.findById(assetId).populate('valuation'),
        Threat.findById(threatId),
        Vulnerability.findById(vulnerabilityId)
      ]);

      if (!asset || !threat || !vulnerability) {
        throw new Error('Entidades requeridas no encontradas');
      }

      // Validar que la vulnerabilidad corresponde al activo
      if (vulnerability.asset.toString() !== assetId.toString()) {
        throw new Error('La vulnerabilidad no corresponde al activo especificado');
      }

      // Calcular probabilidad de la amenaza (considerando factores)
      const threatProbability = this.calculateThreatProbability(threat, asset);

      // Obtener nivel de vulnerabilidad
      const vulnerabilityLevel = vulnerability.vulnerabilityLevel;

      // Calcular impacto ponderado por dimensiones
      const aggregatedImpact = this.calculateAggregatedImpact(asset, vulnerability);

      // Calcular riesgo base
      const baseRisk = threatProbability * vulnerabilityLevel * aggregatedImpact;

      // Aplicar factores de ajuste
      const temporalFactor = this.calculateTemporalFactor(threat, vulnerability);
      const environmentalFactor = this.calculateEnvironmentalFactor(asset, organizationId);

      const adjustedRisk = Math.min(baseRisk * temporalFactor * environmentalFactor, 1.0);

      return {
        threatProbability,
        vulnerabilityLevel,
        aggregatedImpact,
        baseRisk,
        temporalFactor,
        environmentalFactor,
        adjustedRisk
      };

    } catch (error) {
      throw new Error(`Error calculando riesgo base: ${error.message}`);
    }
  }

  /**
   * Calcular probabilidad de amenaza considerando contexto
   */
  static calculateThreatProbability(threat, asset) {
    let probability = threat.baseProbability;

    // Verificar si la amenaza es aplicable al tipo de activo
    const assetType = asset.type;
    if (!threat.susceptibleAssetTypes.includes(assetType)) {
      probability *= 0.5; // Reducir probabilidad si no es directamente aplicable
    }

    // Aplicar factor geográfico (Ecuador)
    const geographicMultiplier = this.getGeographicMultiplier(threat);
    probability *= geographicMultiplier;

    // Aplicar factor estacional si aplica
    if (threat.temporalFactor.hasSeasonality) {
      const currentMonth = new Date().getMonth() + 1;
      if (threat.temporalFactor.peakMonths.includes(currentMonth)) {
        probability *= threat.temporalFactor.seasonalMultiplier;
      }
    }

    return Math.min(probability, 1.0);
  }

  /**
   * Calcular impacto agregado ponderado por valoración MAGERIT
   */
  static calculateAggregatedImpact(asset, vulnerability) {
    const assetValuation = asset.valuation || asset.assetValuation;
    
    if (!assetValuation) {
      // Si no hay valoración, usar valores por defecto moderados
      return 0.5;
    }

    const dimensions = ['confidentiality', 'integrity', 'availability', 'authenticity', 'traceability'];
    let totalWeightedImpact = 0;
    let totalWeight = 0;

    dimensions.forEach(dimension => {
      const assetValue = assetValuation[dimension] || 0;
      const vulnerabilityImpact = vulnerability.affectedDimensions[dimension]?.impact || 0;
      
      // Normalizar valores de activo (0-10 MAGERIT -> 0-1)
      const normalizedAssetValue = assetValue / 10;
      
      const weightedImpact = normalizedAssetValue * vulnerabilityImpact;
      totalWeightedImpact += weightedImpact;
      totalWeight += normalizedAssetValue;
    });

    // Evitar división por cero
    if (totalWeight === 0) return 0;

    return totalWeightedImpact / totalWeight;
  }

  /**
   * Calcular factor temporal basado en amenaza y vulnerabilidad
   */
  static calculateTemporalFactor(threat, vulnerability) {
    let factor = 1.0;

    // Factor por madurez del exploit (vulnerabilidad)
    if (vulnerability.temporalMetrics.exploitCodeMaturity === 'high') {
      factor += 0.3;
    } else if (vulnerability.temporalMetrics.exploitCodeMaturity === 'functional') {
      factor += 0.2;
    } else if (vulnerability.temporalMetrics.exploitCodeMaturity === 'proof_of_concept') {
      factor += 0.1;
    }

    // Factor por nivel de remediación
    if (vulnerability.temporalMetrics.remediationLevel === 'unavailable') {
      factor += 0.2;
    } else if (vulnerability.temporalMetrics.remediationLevel === 'workaround') {
      factor += 0.1;
    }

    // Factor por confianza en el reporte
    if (vulnerability.temporalMetrics.reportConfidence === 'confirmed') {
      factor += 0.1;
    }

    // Factor por CVE reciente
    if (vulnerability.cveDetails?.cveId) {
      const nvdDate = new Date(vulnerability.cveDetails.nvdPublishDate);
      const daysSincePublished = (new Date() - nvdDate) / (1000 * 60 * 60 * 24);
      
      if (daysSincePublished <= 30) {
        factor += 0.2; // CVE muy reciente
      } else if (daysSincePublished <= 90) {
        factor += 0.1; // CVE reciente
      }
    }

    return Math.min(factor, 2.0); // Máximo 2x
  }

  /**
   * Calcular factor ambiental organizacional
   */
  static calculateEnvironmentalFactor(asset, organizationId) {
    let factor = 1.0;

    // Factor por exposición del activo
    const exposure = asset.exposure || 'internal';
    switch (exposure) {
      case 'public':
        factor += 0.3;
        break;
      case 'partner':
        factor += 0.2;
        break;
      case 'restricted':
        factor -= 0.1;
        break;
    }

    // Factor por criticidad del activo
    const criticality = asset.businessCriticality || 'medium';
    switch (criticality) {
      case 'critical':
        factor += 0.2;
        break;
      case 'high':
        factor += 0.1;
        break;
      case 'low':
        factor -= 0.1;
        break;
    }

    return Math.max(0.5, Math.min(factor, 1.5));
  }

  /**
   * Obtener multiplicador geográfico para Ecuador
   */
  static getGeographicMultiplier(threat) {
    const ecuadorRelevance = threat.geographicFactor?.ecuadorRelevance || 'medium';
    
    const multipliers = {
      'very_low': 0.5,
      'low': 0.7,
      'medium': 1.0,
      'high': 1.3,
      'very_high': 1.6
    };

    return multipliers[ecuadorRelevance] || 1.0;
  }

  /**
   * Crear y guardar riesgo calculado
   */
  static async createCalculatedRisk(assetId, threatId, vulnerabilityId, organizationId, userId) {
    try {
      // Calcular métricas de riesgo
      const calculation = await this.calculateBaseRisk(assetId, threatId, vulnerabilityId, organizationId);

      // Obtener matriz de riesgo activa
      const riskMatrix = await RiskMatrix.getActiveMatrix(organizationId);
      if (!riskMatrix) {
        throw new Error('No se encontró matriz de riesgo activa para la organización');
      }

      // Convertir a niveles de matriz (1-5)
      const probabilityLevel = Math.ceil(calculation.threatProbability * 5);
      const impactLevel = Math.ceil(calculation.aggregatedImpact * 5);
      
      // Obtener información de la matriz
      const matrixInfo = riskMatrix.getRiskLevel(probabilityLevel, impactLevel);
      
      // Obtener activo para valor económico
      const asset = await Asset.findById(assetId);
      const assetEconomicValue = asset.economicValue || 0;

      // Calcular impacto económico
      const potentialLoss = assetEconomicValue * calculation.aggregatedImpact;
      const expectedLoss = potentialLoss * calculation.adjustedRisk;
      const annualizedLoss = expectedLoss; // Simplificado por ahora

      // Generar ID único del riesgo
      const riskId = await this.generateRiskId(organizationId, assetId, threatId);

      // Crear objeto riesgo
      const riskData = {
        riskId,
        name: `${asset.name} - ${(await Threat.findById(threatId)).name}`,
        description: `Riesgo derivado de la amenaza sobre el activo`,
        asset: assetId,
        threat: threatId,
        vulnerability: vulnerabilityId,
        
        calculation: {
          threatProbability: calculation.threatProbability,
          vulnerabilityLevel: calculation.vulnerabilityLevel,
          impact: {
            confidentiality: calculation.aggregatedImpact * 0.2, // Distribución ejemplo
            integrity: calculation.aggregatedImpact * 0.3,
            availability: calculation.aggregatedImpact * 0.3,
            authenticity: calculation.aggregatedImpact * 0.1,
            traceability: calculation.aggregatedImpact * 0.1
          },
          aggregatedImpact: calculation.aggregatedImpact,
          temporalFactor: calculation.temporalFactor,
          environmentalFactor: calculation.environmentalFactor,
          baseRisk: calculation.baseRisk,
          adjustedRisk: calculation.adjustedRisk,
          economicImpact: {
            potentialLoss,
            expectedLoss,
            annualizedLoss
          }
        },

        classification: {
          riskLevel: matrixInfo?.riskLevel || 'medium',
          riskCategory: this.determineRiskCategory(asset),
          businessFunction: asset.businessFunction || 'support'
        },

        riskMatrix: {
          probabilityLevel,
          impactLevel,
          matrixPosition: `${probabilityLevel}${impactLevel}`,
          riskScore: probabilityLevel * impactLevel
        },

        treatment: {
          strategy: this.determineDefaultStrategy(matrixInfo?.riskLevel),
          status: 'identified',
          priority: this.determinePriority(calculation.adjustedRisk)
        },

        monitoring: {
          reviewFrequency: this.determineReviewFrequency(calculation.adjustedRisk),
          assignedTo: userId
        },

        organization: organizationId,
        createdBy: userId
      };

      const risk = new Risk(riskData);
      await risk.save();

      return risk;

    } catch (error) {
      throw new Error(`Error creando riesgo calculado: ${error.message}`);
    }
  }

  /**
   * Recalcular todos los riesgos de una organización
   */
  static async recalculateOrganizationRisks(organizationId) {
    try {
      const risks = await Risk.find({ organization: organizationId })
        .populate(['asset', 'threat', 'vulnerability']);

      const results = {
        processed: 0,
        updated: 0,
        errors: []
      };

      for (const risk of risks) {
        try {
          const newCalculation = await this.calculateBaseRisk(
            risk.asset._id,
            risk.threat._id,
            risk.vulnerability._id,
            organizationId
          );

          // Actualizar cálculos
          risk.calculation = {
            ...risk.calculation,
            ...newCalculation
          };

          // Recalcular matriz
          const riskMatrix = await RiskMatrix.getActiveMatrix(organizationId);
          if (riskMatrix) {
            const probabilityLevel = Math.ceil(newCalculation.threatProbability * 5);
            const impactLevel = Math.ceil(newCalculation.aggregatedImpact * 5);
            const matrixInfo = riskMatrix.getRiskLevel(probabilityLevel, impactLevel);

            risk.riskMatrix = {
              probabilityLevel,
              impactLevel,
              matrixPosition: `${probabilityLevel}${impactLevel}`,
              riskScore: probabilityLevel * impactLevel
            };

            risk.classification.riskLevel = matrixInfo?.riskLevel || risk.classification.riskLevel;
          }

          await risk.save();
          results.updated++;

        } catch (error) {
          results.errors.push({
            riskId: risk.riskId,
            error: error.message
          });
        }

        results.processed++;
      }

      return results;

    } catch (error) {
      throw new Error(`Error recalculando riesgos organizacionales: ${error.message}`);
    }
  }

  /**
   * Calcular Value at Risk (VaR) organizacional
   */
  static async calculateOrganizationalVaR(organizationId, confidenceLevel = 0.95, timeHorizon = 365) {
    try {
      const risks = await Risk.find(
        { organization: organizationId },
        'calculation.adjustedRisk calculation.economicImpact.expectedLoss'
      );

      if (risks.length === 0) {
        return { var: 0, expectedLoss: 0, confidenceLevel };
      }

      // Simulación Monte Carlo para VaR
      const simulations = 10000;
      const results = [];

      for (let i = 0; i < simulations; i++) {
        let totalLoss = 0;

        risks.forEach(risk => {
          const probability = risk.calculation.adjustedRisk;
          const impact = risk.calculation.economicImpact.expectedLoss || 0;

          // Simular si el riesgo se materializa
          if (Math.random() < probability) {
            // Simular variabilidad en el impacto (distribución triangular)
            const variability = 0.2; // ±20% de variabilidad
            const minImpact = impact * (1 - variability);
            const maxImpact = impact * (1 + variability);
            const randomImpact = minImpact + Math.random() * (maxImpact - minImpact);
            
            totalLoss += randomImpact;
          }
        });

        results.push(totalLoss);
      }

      // Ordenar resultados de mayor a menor pérdida
      results.sort((a, b) => b - a);

      // Calcular VaR al nivel de confianza especificado
      const varIndex = Math.floor(results.length * (1 - confidenceLevel));
      const var95 = results[varIndex];

      // Calcular Expected Shortfall (CVaR)
      const tailLosses = results.slice(0, varIndex);
      const expectedShortfall = tailLosses.length > 0 
        ? tailLosses.reduce((sum, loss) => sum + loss, 0) / tailLosses.length 
        : 0;

      // Calcular pérdida esperada total
      const totalExpectedLoss = risks.reduce(
        (sum, risk) => sum + (risk.calculation.economicImpact.expectedLoss || 0), 0
      );

      // Ajustar por horizonte temporal
      const annualizedVar = var95 * Math.sqrt(timeHorizon / 365);

      return {
        var95: annualizedVar,
        var99: results[Math.floor(results.length * 0.01)],
        expectedShortfall,
        totalExpectedLoss,
        confidenceLevel,
        timeHorizon,
        simulationCount: simulations
      };

    } catch (error) {
      throw new Error(`Error calculando VaR organizacional: ${error.message}`);
    }
  }

  /**
   * Realizar análisis de escenarios de riesgo
   */
  static async performScenarioAnalysis(organizationId, scenarios) {
    try {
      const baselineRisks = await Risk.find({ organization: organizationId })
        .populate(['asset', 'threat', 'vulnerability']);

      const results = [];

      for (const scenario of scenarios) {
        const scenarioResults = {
          name: scenario.name,
          description: scenario.description,
          modifications: scenario.modifications,
          results: {
            totalRisk: 0,
            riskDistribution: {},
            economicImpact: 0,
            affectedAssets: 0
          }
        };

        let totalScenarioRisk = 0;
        let totalEconomicImpact = 0;
        const riskDistribution = { very_low: 0, low: 0, medium: 0, high: 0, critical: 0 };

        for (const risk of baselineRisks) {
          let adjustedRisk = risk.calculation.adjustedRisk;

          // Aplicar modificaciones del escenario
          if (scenario.modifications.probabilityMultiplier) {
            adjustedRisk *= scenario.modifications.probabilityMultiplier;
          }

          if (scenario.modifications.impactMultiplier) {
            adjustedRisk *= scenario.modifications.impactMultiplier;
          }

          // Aplicar modificaciones específicas por tipo de amenaza
          if (scenario.modifications.threatSpecific) {
            const threatModification = scenario.modifications.threatSpecific[risk.threat.mageritCode];
            if (threatModification) {
              adjustedRisk *= threatModification.multiplier;
            }
          }

          // Limitar a [0,1]
          adjustedRisk = Math.min(Math.max(adjustedRisk, 0), 1);

          // Determinar nuevo nivel de riesgo
          let newRiskLevel;
          if (adjustedRisk >= 0.8) newRiskLevel = 'critical';
          else if (adjustedRisk >= 0.6) newRiskLevel = 'high';
          else if (adjustedRisk >= 0.4) newRiskLevel = 'medium';
          else if (adjustedRisk >= 0.2) newRiskLevel = 'low';
          else newRiskLevel = 'very_low';

          riskDistribution[newRiskLevel]++;
          totalScenarioRisk += adjustedRisk;
          totalEconomicImpact += (risk.calculation.economicImpact.expectedLoss || 0) * 
                                 (adjustedRisk / risk.calculation.adjustedRisk);
        }

        scenarioResults.results = {
          totalRisk: totalScenarioRisk,
          averageRisk: totalScenarioRisk / baselineRisks.length,
          riskDistribution,
          economicImpact: totalEconomicImpact,
          affectedAssets: baselineRisks.length
        };

        results.push(scenarioResults);
      }

      return results;

    } catch (error) {
      throw new Error(`Error en análisis de escenarios: ${error.message}`);
    }
  }

  /**
   * Calcular métricas de agregación de riesgos
   */
  static async calculateAggregatedRiskMetrics(organizationId) {
    try {
      const risks = await Risk.find({ organization: organizationId })
        .populate('asset', 'name type businessFunction');

      if (risks.length === 0) {
        return {
          totalRisks: 0,
          averageRisk: 0,
          riskByLevel: {},
          riskByCategory: {},
          riskByBusinessFunction: {},
          topRisks: [],
          riskTrend: null
        };
      }

      // Métricas básicas
      const totalRisks = risks.length;
      const totalRiskScore = risks.reduce((sum, risk) => sum + risk.calculation.adjustedRisk, 0);
      const averageRisk = totalRiskScore / totalRisks;

      // Distribución por nivel de riesgo
      const riskByLevel = risks.reduce((acc, risk) => {
        const level = risk.classification.riskLevel;
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {});

      // Distribución por categoría
      const riskByCategory = risks.reduce((acc, risk) => {
        const category = risk.classification.riskCategory;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      // Distribución por función de negocio
      const riskByBusinessFunction = risks.reduce((acc, risk) => {
        const func = risk.asset?.businessFunction || 'unknown';
        acc[func] = (acc[func] || 0) + 1;
        return acc;
      }, {});

      // Top 10 riesgos más críticos
      const topRisks = risks
        .sort((a, b) => b.calculation.adjustedRisk - a.calculation.adjustedRisk)
        .slice(0, 10)
        .map(risk => ({
          riskId: risk.riskId,
          name: risk.name,
          assetName: risk.asset?.name,
          riskLevel: risk.classification.riskLevel,
          adjustedRisk: risk.calculation.adjustedRisk,
          economicImpact: risk.calculation.economicImpact.expectedLoss
        }));

      // Calcular tendencia (comparar con datos históricos)
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const historicalRisks = await Risk.find({
        organization: organizationId,
        updatedAt: { $gte: lastMonth }
      });

      let riskTrend = null;
      if (historicalRisks.length > 0) {
        const historicalAverage = historicalRisks.reduce(
          (sum, risk) => sum + risk.calculation.adjustedRisk, 0
        ) / historicalRisks.length;

        riskTrend = {
          direction: averageRisk > historicalAverage ? 'increasing' : 'decreasing',
          percentage: Math.abs((averageRisk - historicalAverage) / historicalAverage * 100),
          previousAverage: historicalAverage,
          currentAverage: averageRisk
        };
      }

      return {
        totalRisks,
        averageRisk,
        riskByLevel,
        riskByCategory,
        riskByBusinessFunction,
        topRisks,
        riskTrend
      };

    } catch (error) {
      throw new Error(`Error calculando métricas agregadas: ${error.message}`);
    }
  }

  /**
   * Simulación Monte Carlo para un riesgo específico
   */
  static async runMonteCarloSimulation(riskId, iterations = 10000) {
    try {
      const risk = await Risk.findById(riskId)
        .populate(['asset', 'threat', 'vulnerability']);

      if (!risk) {
        throw new Error('Riesgo no encontrado');
      }

      const results = [];

      for (let i = 0; i < iterations; i++) {
        // Simular variaciones en los componentes del riesgo
        const probVariation = this.simulateVariation(risk.calculation.threatProbability, 0.2);
        const vulnVariation = this.simulateVariation(risk.calculation.vulnerabilityLevel, 0.15);
        const impactVariation = this.simulateVariation(risk.calculation.aggregatedImpact, 0.25);

        // Simular factores temporales y ambientales
        const temporalVariation = this.simulateVariation(risk.calculation.temporalFactor, 0.1);
        const environmentalVariation = this.simulateVariation(risk.calculation.environmentalFactor, 0.1);

        // Calcular riesgo simulado
        const simulatedRisk = Math.min(
          probVariation * vulnVariation * impactVariation * temporalVariation * environmentalVariation,
          1.0
        );

        results.push(simulatedRisk);
      }

      // Ordenar resultados para cálculo de percentiles
      results.sort((a, b) => a - b);

      const p5Index = Math.floor(iterations * 0.05);
      const p50Index = Math.floor(iterations * 0.5);
      const p95Index = Math.floor(iterations * 0.95);

      const statistics = {
        mean: results.reduce((sum, val) => sum + val, 0) / iterations,
        median: results[p50Index],
        p5: results[p5Index],
        p95: results[p95Index],
        min: results[0],
        max: results[iterations - 1],
        standardDeviation: this.calculateStandardDeviation(results)
      };

      // Actualizar el riesgo con los resultados de la simulación
      risk.quantitativeAnalysis.monteCarlo = {
        iterations,
        confidenceInterval: {
          p5: statistics.p5,
          p50: statistics.median,
          p95: statistics.p95
        },
        lastSimulation: new Date()
      };

      await risk.save();

      return {
        statistics,
        confidenceInterval: risk.quantitativeAnalysis.monteCarlo.confidenceInterval,
        distributionData: this.createDistributionBins(results, 20)
      };

    } catch (error) {
      throw new Error(`Error en simulación Monte Carlo: ${error.message}`);
    }
  }

  /**
   * Simular variación en un parámetro con distribución normal
   */
  static simulateVariation(baseValue, variabilityPercentage) {
    // Generar número aleatorio con distribución normal (Box-Muller)
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    // Aplicar variabilidad
    const variation = baseValue + (baseValue * variabilityPercentage * z0);
    
    // Mantener en rango válido [0, 1]
    return Math.min(Math.max(variation, 0), 1);
  }

  /**
   * Calcular desviación estándar
   */
  static calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Crear bins para distribución de probabilidad
   */
  static createDistributionBins(values, binCount) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / binCount;
    
    const bins = Array(binCount).fill(0).map((_, i) => ({
      min: min + i * binSize,
      max: min + (i + 1) * binSize,
      count: 0,
      frequency: 0
    }));

    values.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
      bins[binIndex].count++;
    });

    // Calcular frecuencias
    bins.forEach(bin => {
      bin.frequency = bin.count / values.length;
    });

    return bins;
  }

  // Métodos auxiliares para clasificación automática

  static determineRiskCategory(asset) {
    const typeMapping = {
      'essential_services': 'operational',
      'data': 'operational',
      'key_data': 'compliance',
      'software': 'technical',
      'hardware': 'technical',
      'communication_networks': 'technical',
      'support_equipment': 'operational',
      'installations': 'operational',
      'personnel': 'operational'
    };

    return typeMapping[asset.type] || 'operational';
  }

  static determineDefaultStrategy(riskLevel) {
    const strategyMapping = {
      'very_low': 'accept',
      'low': 'accept',
      'medium': 'mitigate',
      'high': 'mitigate',
      'critical': 'mitigate'
    };

    return strategyMapping[riskLevel] || 'mitigate';
  }

  static determinePriority(adjustedRisk) {
    if (adjustedRisk >= 0.8) return 'critical';
    if (adjustedRisk >= 0.6) return 'high';
    if (adjustedRisk >= 0.4) return 'medium';
    return 'low';
  }

  static determineReviewFrequency(adjustedRisk) {
    if (adjustedRisk >= 0.8) return 'weekly';
    if (adjustedRisk >= 0.6) return 'monthly';
    if (adjustedRisk >= 0.4) return 'quarterly';
    return 'annually';
  }

  static async generateRiskId(organizationId, assetId, threatId) {
    const org = await require('../models/Organization').findById(organizationId, 'name');
    const orgPrefix = org.name.substring(0, 3).toUpperCase();
    
    const asset = await Asset.findById(assetId, 'name');
    const assetPrefix = asset.name.substring(0, 3).toUpperCase();
    
    const threat = await Threat.findById(threatId, 'mageritCode');
    const threatCode = threat.mageritCode.replace('.', '');
    
    const timestamp = Date.now().toString().slice(-6);
    
    return `${orgPrefix}-${assetPrefix}-${threatCode}-${timestamp}`;
  }
}

module.exports = RiskCalculationService;