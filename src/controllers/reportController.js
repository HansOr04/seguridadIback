const Report = require('../models/Report');
const Asset = require('../models/Asset');
const Risk = require('../models/Risk');
const Control = require('../models/Control');
const Treatment = require('../models/Treatment');
const { validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Crear reporte
exports.createReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: errors.array()
      });
    }

    const reportData = {
      ...req.body,
      organization: req.user.organization,
      generatedBy: req.user.id
    };

    const report = new Report(reportData);
    await report.save();

    await report.populate([
      { path: 'generatedBy', select: 'name email' },
      { path: 'recipients', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Reporte creado exitosamente',
      data: report
    });
  } catch (error) {
    console.error('Error al crear reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener todos los reportes
exports.getReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      format,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { organization: req.user.organization, isActive: true };

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (format) filter.format = format;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const reports = await Report.find(filter)
      .populate([
        { path: 'generatedBy', select: 'name email' },
        { path: 'recipients', select: 'name email' }
      ])
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Report.countDocuments(filter);

    res.json({
      success: true,
      data: reports,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error al obtener reportes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener reporte por ID
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      organization: req.user.organization
    }).populate([
      { path: 'generatedBy', select: 'name email' },
      { path: 'recipients', select: 'name email' }
    ]);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error al obtener reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Generar reporte
exports.generateReport = async (req, res) => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    // Actualizar estado a generando
    report.status = 'generating';
    await report.save();

    const startTime = Date.now();

    try {
      // Obtener datos según parámetros del reporte
      const data = await gatherReportData(report);
      
      // Generar contenido del reporte
      await generateReportContent(report, data);

      // Generar archivo según formato
      let filename, fileSize, filePath;
      
      switch (report.format) {
        case 'pdf':
          ({ filename, fileSize, filePath } = await generatePDFReport(report, data));
          break;
        case 'excel':
          ({ filename, fileSize, filePath } = await generateExcelReport(report, data));
          break;
        case 'html':
          ({ filename, fileSize, filePath } = await generateHTMLReport(report, data));
          break;
        default:
          throw new Error('Formato de reporte no soportado');
      }

      // Actualizar metadatos
      const generationTime = Date.now() - startTime;
      report.metadata.generationTime = generationTime;
      report.metadata.totalAssets = data.assets.length;
      report.metadata.totalRisks = data.risks.length;
      report.metadata.totalControls = data.controls.length;

      await report.markCompleted(filename, fileSize, filePath);

      // Programar siguiente generación si es recurrente
      if (report.frequency !== 'once') {
        await report.scheduleNext();
      }

      res.json({
        success: true,
        message: 'Reporte generado exitosamente',
        data: {
          reportId: report._id,
          filename,
          fileSize: report.formattedFileSize,
          generationTime
        }
      });
    } catch (genError) {
      report.status = 'error';
      await report.save();
      throw genError;
    }
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Descargar reporte
exports.downloadReport = async (req, res) => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    if (report.status !== 'completed' || !report.fileInfo.filePath) {
      return res.status(400).json({
        success: false,
        message: 'Reporte no está disponible para descarga'
      });
    }

    const filePath = path.join(process.cwd(), report.fileInfo.filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Archivo de reporte no encontrado'
      });
    }

    // Incrementar contador de descarga
    await report.incrementDownload();

    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileInfo.filename}"`);
    res.setHeader('Content-Type', getContentType(report.format));

    // Enviar archivo
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error al descargar reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Eliminar reporte
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { isActive: false },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Reporte no encontrado'
      });
    }

    // Eliminar archivo físico si existe
    if (report.fileInfo.filePath) {
      const filePath = path.join(process.cwd(), report.fileInfo.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({
      success: true,
      message: 'Reporte eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Obtener estadísticas de reportes
exports.getReportStatistics = async (req, res) => {
  try {
    const filter = { organization: req.user.organization, isActive: true };

    const stats = await Report.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          totalDownloads: { $sum: '$fileInfo.downloadCount' },
          averageGenerationTime: { $avg: '$metadata.generationTime' },
          byType: { $push: { type: '$type', count: 1 } },
          byFormat: { $push: { format: '$format', count: 1 } },
          byStatus: { $push: { status: '$status', count: 1 } }
        }
      }
    ]);

    // Calcular distribuciones
    const typeDistribution = {};
    const formatDistribution = {};
    const statusDistribution = {};

    if (stats.length > 0) {
      stats[0].byType.forEach(item => {
        typeDistribution[item.type] = (typeDistribution[item.type] || 0) + 1;
      });
      
      stats[0].byFormat.forEach(item => {
        formatDistribution[item.format] = (formatDistribution[item.format] || 0) + 1;
      });
      
      stats[0].byStatus.forEach(item => {
        statusDistribution[item.status] = (statusDistribution[item.status] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        totalReports: stats[0]?.totalReports || 0,
        totalDownloads: stats[0]?.totalDownloads || 0,
        averageGenerationTime: Math.round(stats[0]?.averageGenerationTime || 0),
        typeDistribution,
        formatDistribution,
        statusDistribution
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// Funciones auxiliares

async function gatherReportData(report) {
  const filter = { organization: report.organization };
  
  // Aplicar filtro de fechas si existe
  if (report.parameters.dateRange.start || report.parameters.dateRange.end) {
    const dateFilter = {};
    if (report.parameters.dateRange.start) {
      dateFilter.$gte = report.parameters.dateRange.start;
    }
    if (report.parameters.dateRange.end) {
      dateFilter.$lte = report.parameters.dateRange.end;
    }
    filter.createdAt = dateFilter;
  }

  const data = {};

  if (report.parameters.includeAssets) {
    let assetFilter = { ...filter };
    if (report.parameters.assetTypes.length > 0) {
      assetFilter.type = { $in: report.parameters.assetTypes };
    }
    data.assets = await Asset.find(assetFilter).lean();
  }

  if (report.parameters.includeRisks) {
    let riskFilter = { ...filter };
    if (report.parameters.riskLevelFilter.length > 0) {
      riskFilter.riskLevel = { $in: report.parameters.riskLevelFilter };
    }
    data.risks = await Risk.find(riskFilter).populate('assetId', 'name type').lean();
  }

  if (report.parameters.includeControls) {
    data.controls = await Control.find(filter).lean();
  }

  if (report.parameters.includeTreatments) {
    data.treatments = await Treatment.find(filter).populate('riskId assetId', 'name type').lean();
  }

  return data;
}

async function generateReportContent(report, data) {
  // Generar resumen ejecutivo
  const totalAssets = data.assets?.length || 0;
  const totalRisks = data.risks?.length || 0;
  const highRisks = data.risks?.filter(r => r.riskLevel === 'high' || r.riskLevel === 'very_high').length || 0;
  const totalControls = data.controls?.length || 0;
  const implementedControls = data.controls?.filter(c => c.status === 'implemented').length || 0;

  report.content.executiveSummary = `
    Este reporte presenta un análisis completo del estado de la seguridad de la información.
    Se han identificado ${totalAssets} activos, ${totalRisks} riesgos (${highRisks} de nivel alto),
    y ${implementedControls} de ${totalControls} controles implementados.
    El nivel de madurez actual es ${calculateMaturityLevel(data)}%.
  `;

  // Generar secciones
  report.content.sections = [
    {
      title: 'Resumen de Activos',
      content: generateAssetSummary(data.assets || []),
      order: 1
    },
    {
      title: 'Análisis de Riesgos',
      content: generateRiskAnalysis(data.risks || []),
      order: 2
    },
    {
      title: 'Estado de Controles',
      content: generateControlStatus(data.controls || []),
      order: 3
    }
  ];

  // Generar gráficos
  report.content.charts = [
    {
      type: 'pie',
      title: 'Distribución de Riesgos por Nivel',
      data: generateRiskDistributionChart(data.risks || [])
    },
    {
      type: 'bar',
      title: 'Controles por Estado',
      data: generateControlStatusChart(data.controls || [])
    }
  ];

  await report.save();
}

async function generatePDFReport(report, data) {
  const filename = `${report.name}_${Date.now()}.pdf`;
  const filePath = `uploads/reports/${filename}`;
  const fullPath = path.join(process.cwd(), filePath);

  // Asegurar que el directorio existe
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(fullPath));

  // Título del reporte
  doc.fontSize(20).text(report.name, 50, 50);
  doc.fontSize(12).text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, 50, 80);
  
  // Resumen ejecutivo
  doc.moveDown(2);
  doc.fontSize(16).text('Resumen Ejecutivo', 50);
  doc.fontSize(10).text(report.content.executiveSummary, 50, doc.y + 10, { width: 500 });

  // Secciones
  report.content.sections.forEach(section => {
    doc.addPage();
    doc.fontSize(16).text(section.title, 50, 50);
    doc.fontSize(10).text(JSON.stringify(section.content, null, 2), 50, 80, { width: 500 });
  });

  doc.end();

  // Obtener tamaño del archivo
  return new Promise((resolve) => {
    doc.on('end', () => {
      const stats = fs.statSync(fullPath);
      resolve({
        filename,
        fileSize: stats.size,
        filePath
      });
    });
  });
}

async function generateExcelReport(report, data) {
  const filename = `${report.name}_${Date.now()}.xlsx`;
  const filePath = `uploads/reports/${filename}`;
  const fullPath = path.join(process.cwd(), filePath);

  // Asegurar que el directorio existe
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const workbook = new ExcelJS.Workbook();
  
  // Hoja de resumen
  const summarySheet = workbook.addWorksheet('Resumen');
  summarySheet.columns = [
    { header: 'Métrica', key: 'metric', width: 30 },
    { header: 'Valor', key: 'value', width: 20 }
  ];

  summarySheet.addRows([
    { metric: 'Total de Activos', value: data.assets?.length || 0 },
    { metric: 'Total de Riesgos', value: data.risks?.length || 0 },
    { metric: 'Riesgos Altos', value: data.risks?.filter(r => r.riskLevel === 'high' || r.riskLevel === 'very_high').length || 0 },
    { metric: 'Total de Controles', value: data.controls?.length || 0 },
    { metric: 'Controles Implementados', value: data.controls?.filter(c => c.status === 'implemented').length || 0 }
  ]);

  // Hoja de activos
  if (data.assets && data.assets.length > 0) {
    const assetSheet = workbook.addWorksheet('Activos');
    assetSheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Tipo', key: 'type', width: 20 },
      { header: 'Valor', key: 'value', width: 15 },
      { header: 'Criticidad', key: 'criticality', width: 15 }
    ];
    assetSheet.addRows(data.assets.map(asset => ({
      name: asset.name,
      type: asset.type,
      value: asset.value,
      criticality: asset.criticality
    })));
  }

  // Hoja de riesgos
  if (data.risks && data.risks.length > 0) {
    const riskSheet = workbook.addWorksheet('Riesgos');
    riskSheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Activo', key: 'asset', width: 25 },
      { header: 'Nivel', key: 'level', width: 15 },
      { header: 'Impacto', key: 'impact', width: 15 },
      { header: 'Probabilidad', key: 'probability', width: 15 }
    ];
    riskSheet.addRows(data.risks.map(risk => ({
      name: risk.name,
      asset: risk.assetId?.name || 'N/A',
      level: risk.riskLevel,
      impact: risk.impact,
      probability: risk.probability
    })));
  }

  await workbook.xlsx.writeFile(fullPath);
  const stats = fs.statSync(fullPath);

  return {
    filename,
    fileSize: stats.size,
    filePath
  };
}

async function generateHTMLReport(report, data) {
  const filename = `${report.name}_${Date.now()}.html`;
  const filePath = `uploads/reports/${filename}`;
  const fullPath = path.join(process.cwd(), filePath);

  // Asegurar que el directorio existe
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${report.name}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #2563eb; border-bottom: 2px solid #2563eb; }
            h2 { color: #1e40af; margin-top: 30px; }
            .summary { background: #f3f4f6; padding: 20px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #d1d5db; padding: 12px; text-align: left; }
            th { background: #f9fafb; font-weight: bold; }
            .high-risk { color: #dc2626; font-weight: bold; }
            .medium-risk { color: #f59e0b; }
            .low-risk { color: #10b981; }
        </style>
    </head>
    <body>
        <h1>${report.name}</h1>
        <p><strong>Generado el:</strong> ${new Date().toLocaleDateString('es-ES', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
        
        <div class="summary">
            <h2>Resumen Ejecutivo</h2>
            <p>${report.content.executiveSummary}</p>
        </div>

        ${generateHTMLAssetSection(data.assets || [])}
        ${generateHTMLRiskSection(data.risks || [])}
        ${generateHTMLControlSection(data.controls || [])}
    </body>
    </html>
  `;

  fs.writeFileSync(fullPath, html, 'utf8');
  const stats = fs.statSync(fullPath);

  return {
    filename,
    fileSize: stats.size,
    filePath
  };
}

function generateHTMLAssetSection(assets) {
  if (assets.length === 0) return '';

  return `
    <h2>Activos de Información</h2>
    <table>
        <thead>
            <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Criticidad</th>
            </tr>
        </thead>
        <tbody>
            ${assets.map(asset => `
                <tr>
                    <td>${asset.name}</td>
                    <td>${asset.type}</td>
                    <td>${asset.value?.toLocaleString() || 'N/A'}</td>
                    <td class="${asset.criticality}-risk">${asset.criticality || 'N/A'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
  `;
}

function generateHTMLRiskSection(risks) {
  if (risks.length === 0) return '';

  return `
    <h2>Análisis de Riesgos</h2>
    <table>
        <thead>
            <tr>
                <th>Riesgo</th>
                <th>Activo</th>
                <th>Nivel</th>
                <th>Impacto</th>
                <th>Probabilidad</th>
            </tr>
        </thead>
        <tbody>
            ${risks.map(risk => `
                <tr>
                    <td>${risk.name}</td>
                    <td>${risk.assetId?.name || 'N/A'}</td>
                    <td class="${risk.riskLevel.replace('_', '-')}-risk">${risk.riskLevel.replace('_', ' ').toUpperCase()}</td>
                    <td>${risk.impact}</td>
                    <td>${risk.probability}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
  `;
}

function generateHTMLControlSection(controls) {
  if (controls.length === 0) return '';

  return `
    <h2>Estado de Controles</h2>
    <table>
        <thead>
            <tr>
                <th>Control</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Efectividad</th>
            </tr>
        </thead>
        <tbody>
            ${controls.map(control => `
                <tr>
                    <td>${control.name}</td>
                    <td>${control.type}</td>
                    <td>${control.status}</td>
                    <td>${control.effectiveness}%</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
  `;
}

function generateAssetSummary(assets) {
  const byType = {};
  const byCriticality = {};
  let totalValue = 0;

  assets.forEach(asset => {
    byType[asset.type] = (byType[asset.type] || 0) + 1;
    byCriticality[asset.criticality] = (byCriticality[asset.criticality] || 0) + 1;
    totalValue += asset.value || 0;
  });

  return {
    total: assets.length,
    totalValue,
    byType,
    byCriticality
  };
}

function generateRiskAnalysis(risks) {
  const byLevel = {};
  let totalALE = 0;

  risks.forEach(risk => {
    byLevel[risk.riskLevel] = (byLevel[risk.riskLevel] || 0) + 1;
    totalALE += risk.annualLossExpectancy || 0;
  });

  return {
    total: risks.length,
    totalALE,
    byLevel,
    averageImpact: risks.reduce((sum, r) => sum + (r.impact || 0), 0) / (risks.length || 1),
    averageProbability: risks.reduce((sum, r) => sum + (r.probability || 0), 0) / (risks.length || 1)
  };
}

function generateControlStatus(controls) {
  const byStatus = {};
  const byType = {};
  let totalEffectiveness = 0;
  let implementedCount = 0;

  controls.forEach(control => {
    byStatus[control.status] = (byStatus[control.status] || 0) + 1;
    byType[control.type] = (byType[control.type] || 0) + 1;
    
    if (control.status === 'implemented') {
      implementedCount++;
      totalEffectiveness += control.effectiveness || 0;
    }
  });

  return {
    total: controls.length,
    implemented: implementedCount,
    implementationRate: (implementedCount / (controls.length || 1)) * 100,
    averageEffectiveness: implementedCount > 0 ? totalEffectiveness / implementedCount : 0,
    byStatus,
    byType
  };
}

function generateRiskDistributionChart(risks) {
  const distribution = {};
  risks.forEach(risk => {
    distribution[risk.riskLevel] = (distribution[risk.riskLevel] || 0) + 1;
  });

  return Object.entries(distribution).map(([level, count]) => ({
    label: level.replace('_', ' ').toUpperCase(),
    value: count
  }));
}

function generateControlStatusChart(controls) {
  const distribution = {};
  controls.forEach(control => {
    distribution[control.status] = (distribution[control.status] || 0) + 1;
  });

  return Object.entries(distribution).map(([status, count]) => ({
    label: status.replace('_', ' ').toUpperCase(),
    value: count
  }));
}

function calculateMaturityLevel(data) {
  const assets = data.assets?.length || 0;
  const implementedControls = data.controls?.filter(c => c.status === 'implemented').length || 0;
  const totalControls = data.controls?.length || 1;
  const highRisks = data.risks?.filter(r => r.riskLevel === 'high' || r.riskLevel === 'very_high').length || 0;
  const totalRisks = data.risks?.length || 1;

  const assetScore = Math.min(assets * 2, 40);
  const controlScore = (implementedControls / totalControls) * 40;
  const riskScore = Math.max(0, 20 - (highRisks / totalRisks) * 20);

  return Math.round(assetScore + controlScore + riskScore);
}

function getContentType(format) {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'html':
      return 'text/html';
    default:
      return 'application/octet-stream';
  }
}