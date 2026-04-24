const { db } = require("../../config/dataBase");
const PdfPrinter = require("pdfmake");
const fonts = require("../../utils/pdfFonts");
const convertImageToBase64 = require("../../utils/imageToBase64");
const { Op, Sequelize } = require("sequelize");
const ExcelJS = require("exceljs");

// Helper para formatear números
const formatNumber = (num) => {
  const n = parseFloat(num) || 0;
  return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Reporte de clientes con beneficio por ventas
const reporteClientes = async (req, res) => {
  try {
    const {
      filtros = {},
      lista = [],
      usuario = '',
      nombreSistema = 'Auto Accesorios Pinedo'
    } = req.body || {};

    const { id_cliente, desde, hasta } = filtros || {};

    // Formatear fecha_registro: 'YYYY-MM-DD hh:mm:ss' → '12 Abril 2026, hh:mm:ss'
    const formatFechaRegistro = (fecha) => {
      if (!fecha) return '';
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const partes = String(fecha).split(' ');
      const [year, month, day] = (partes[0] || '').split('-');
      const timePart = partes[1] || '';
      const mesNombre = meses[parseInt(month, 10) - 1] || '';
      return `${parseInt(day, 10)} ${mesNombre} ${year}${timePart ? ', ' + timePart : ''}`;
    };

    // Construir tabla
    const body = [];
    const headerRow = [
      { text: 'Nro', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Nombre Completo', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'CI/NIT', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Celular', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Email', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Fecha Registro', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Cantidad Compras', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'center' },
      { text: 'Beneficio Total', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'right' }
    ];
    body.push(headerRow);

    let totalBeneficio = 0;
    let totalCompras = 0;
    let clientesConCompras = 0;

    lista.forEach((cliente, index) => {
      const nombreCompleto = String(cliente.nombre_completo || '').replace(/\n/g, ' ').trim();
      const ciNit = cliente.ci_nit || '';
      const celular = cliente.celular || '';
      const email = cliente.email || '';
      const fechaReg = formatFechaRegistro(cliente.fecha_registro);
      const cantidadCompras = Number(cliente.cantidad_compras) || 0;
      const beneficioCliente = Number(cliente.beneficio_total) || 0;

      totalBeneficio += beneficioCliente;
      totalCompras += cantidadCompras;
      if (cantidadCompras > 0) clientesConCompras++;

      body.push([
        { text: String(index + 1), fontSize: 8 },
        { text: nombreCompleto, fontSize: 8 },
        { text: String(ciNit), fontSize: 8 },
        { text: String(celular), fontSize: 8 },
        { text: String(email), fontSize: 8 },
        { text: fechaReg, fontSize: 8 },
        { text: String(cantidadCompras), fontSize: 8, alignment: 'center' },
        { text: formatNumber(beneficioCliente), fontSize: 8, alignment: 'right', bold: beneficioCliente > 0 }
      ]);
    });

    // Línea separadora antes del total
    body.push([
      { text: '', colSpan: 8, border: [false, true, false, false] },
      {}, {}, {}, {}, {}, {}, {}
    ]);

    // Fila de totales
    body.push([
      { text: 'TOTALES', bold: true, colSpan: 6, fillColor: '#aed6f1', fontSize: 9 },
      {}, {}, {}, {}, {},
      { text: String(totalCompras), bold: true, fillColor: '#aed6f1', alignment: 'center', fontSize: 9 },
      { text: formatNumber(totalBeneficio), bold: true, fillColor: '#aed6f1', alignment: 'right', fontSize: 9 }
    ]);

    // Línea separadora antes del resumen
    body.push([
      { text: '', colSpan: 8, border: [false, true, false, false] },
      {}, {}, {}, {}, {}, {}, {}
    ]);

    // Resumen estadístico
    body.push([
      { text: 'RESUMEN', bold: true, colSpan: 8, fillColor: '#f5f5f5', fontSize: 10, alignment: 'center' },
      {}, {}, {}, {}, {}, {}, {}
    ]);

    const promedioComprasPorCliente = lista.length > 0 ? (totalCompras / lista.length).toFixed(2) : 0;
    const promedioBeneficioPorCliente = lista.length > 0 ? (totalBeneficio / lista.length).toFixed(2) : 0;

    body.push([
      { text: 'Total de clientes:', colSpan: 6, fontSize: 8, fillColor: '#f9f9f9' },
      {}, {}, {}, {}, {},
      { text: String(lista.length), colSpan: 2, fontSize: 8, alignment: 'right', fillColor: '#f9f9f9' },
      {}
    ]);

    body.push([
      { text: 'Clientes con compras:', colSpan: 6, fontSize: 8, fillColor: '#f9f9f9' },
      {}, {}, {}, {}, {},
      { text: String(clientesConCompras), colSpan: 2, fontSize: 8, alignment: 'right', fillColor: '#f9f9f9' },
      {}
    ]);

    body.push([
      { text: 'Promedio compras por cliente:', colSpan: 6, fontSize: 8, fillColor: '#f9f9f9' },
      {}, {}, {}, {}, {},
      { text: promedioComprasPorCliente, colSpan: 2, fontSize: 8, alignment: 'right', fillColor: '#f9f9f9' },
      {}
    ]);

    body.push([
      { text: 'Promedio beneficio por cliente:', colSpan: 6, fontSize: 8, fillColor: '#f9f9f9' },
      {}, {}, {}, {}, {},
      { text: `Bs ${formatNumber(promedioBeneficioPorCliente)}`, colSpan: 2, fontSize: 8, alignment: 'right', fillColor: '#f9f9f9' },
      {}
    ]);

    // Anchos de columna (8 columnas)
    const colWidths = [25, '*', 60, 60, 90, 90, 55, 75];

    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64('../assets/logo2.jpeg');

    // Líneas de filtros: solo las que no son null/vacías
    const filtroLines = [];
    if (id_cliente) {
      const clienteFiltrado = lista.find(c => c.id_cliente == id_cliente);
      if (clienteFiltrado) {
        filtroLines.push(`Cliente: ${String(clienteFiltrado.nombre_completo || '').replace(/\n/g, ' ').trim()}`);
      }
    }
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);

    const encabezadoCols = [
      { image: logo, width: 70 },
      {
        stack: [
          { text: 'Reporte de Clientes - Beneficio por Ventas', style: 'titulo' },
          ...filtroLines.map(l => ({ text: l, style: 'filtro' }))
        ],
        margin: [10, 0, 0, 0],
        width: '*'
      },
      {
        stack: [
          { text: `Generado por: ${usuario || 'desconocido'}`, alignment: 'right', fontSize: 8 },
          { text: `Sistema: ${nombreSistema}`, alignment: 'right', fontSize: 8 },
          { text: `Fecha: ${new Date().toLocaleString('es-BO')}`, alignment: 'right', fontSize: 8 }
        ],
        width: 150
      }
    ];

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [36, 110, 36, 54],
      header: { margin: [40, 40, 40, 40], columns: encabezadoCols },
      defaultStyle: { fontSize: 9 },
      content: [
        { text: '\n' },
        {
          table: { headerRows: 1, widths: colWidths, body: body },
          layout: {
            hLineWidth: function (i, node) { return (i === 0 || i === node.table.body.length) ? 0 : 0.5; },
            vLineWidth: function (i, node) { return 0; },
            hLineColor: function (i, node) { return '#CCCCCC'; }
          },
          margin: [0, 20, 0, 0]
        }
      ],
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Generado: ${new Date().toLocaleString('es-BO')} por: ${usuario || 'desconocido'}`, alignment: 'left', margin: [40, 0, 0, 0], fontSize: 8 },
          { text: `${nombreSistema} - Página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 0, 40, 0], fontSize: 8 }
        ]
      }),
      styles: { titulo: { fontSize: 16, bold: true }, filtro: { fontSize: 8 } }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (c) => chunks.push(c));
    pdfDoc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=reporte_clientes.pdf');
      res.send(pdfBuffer);
    });
    pdfDoc.end();

  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar reporte de clientes');
  }
};

// Obtener datos de clientes para vista previa (sin generar PDF)
const obtenerDatosClientes = async (req, res) => {
  try {
    const {
      id_cliente,
      desde,
      hasta
    } = req.body || {};
    
    console.log('Obtener datos de clientes - parámetros:', req.body);
    
    // Construir filtros para clientes
    const whereCliente = {};
    
    // Filtro por cliente específico
    if (id_cliente && String(id_cliente).trim() !== '') {
      whereCliente.id_cliente = parseInt(id_cliente);
    }
    
    console.log('Where clause clientes:', whereCliente);
    
    // Construir filtros para ventas (fecha_registro es STRING: 'YYYY-MM-DD hh:mm:ss')
    const desdeVal = desde && String(desde).trim() !== '' ? String(desde).trim() : null;
    const hastaVal = hasta && String(hasta).trim() !== '' ? String(hasta).trim() : null;
    
    const whereVenta = {
      estado: { [Op.ne]: 2 }, // Excluir ventas anuladas
      [Op.and]: [
        ...(desdeVal ? [Sequelize.literal(`SUBSTRING(CAST("venta"."fecha_registro" AS TEXT), 1, 10) >= '${desdeVal}'`)] : []),
        ...(hastaVal ? [Sequelize.literal(`SUBSTRING(CAST("venta"."fecha_registro" AS TEXT), 1, 10) <= '${hastaVal}'`)] : [])
      ]
    };
    
    console.log('Where clause ventas:', whereVenta);
    
    // Obtener clientes con sus ventas válidas
    const clientesRaw = await db.cliente.findAll({
      where: whereCliente,
      order: [["id_cliente", "ASC"]],
      include: [
        {
          model: db.venta,
          required: false,
          where: whereVenta
        }
      ]
    });
    
    if (!clientesRaw || clientesRaw.length === 0) {
      return res.status(404).json({ mensaje: "No se encontraron clientes" });
    }
    
    // Convertir a objetos planos
    const clientes = clientesRaw.map(c => c.get ? c.get({ plain: true }) : c);
    
    let totalBeneficio = 0;
    let totalCompras = 0;
    let clientesConCompras = 0;
    
    // Procesar datos de clientes
    const clientesProcesados = clientes.map((cliente, index) => {
      const nombreCompleto = `${cliente.nombre || ''} ${cliente.ap_paterno || ''} ${cliente.ap_materno || ''}`.trim();
      const ciNit = cliente.ci_nit || '';
      const celular = cliente.celular || '';
      const email = cliente.email || '';
      
      // Calcular beneficio del cliente (solo ventas válidas, estado != 2)
      let beneficioCliente = 0;
      let cantidadCompras = 0;
      
      if (cliente.venta && cliente.venta.length > 0) {
        cliente.venta.forEach(venta => {
          const monto = parseFloat(venta.monto_total) || 0;
          const descuento = parseFloat(venta.descuento) || 0;
          beneficioCliente += (monto - descuento);
          cantidadCompras++;
        });
      }
      
      // Acumular totales
      totalBeneficio += beneficioCliente;
      totalCompras += cantidadCompras;
      if (cantidadCompras > 0) {
        clientesConCompras++;
      }
      
      return {
        numero: index + 1,
        id_cliente: cliente.id_cliente,
        nombre_completo: nombreCompleto,
        nombre: cliente.nombre || '',
        ap_paterno: cliente.ap_paterno || '',
        ap_materno: cliente.ap_materno || '',
        ci_nit: ciNit,
        celular: celular,
        email: email,
        direccion: cliente.direccion || '',
        fecha_registro: cliente.fecha_registro || null,
        cantidad_compras: cantidadCompras,
        beneficio_total: parseFloat(beneficioCliente.toFixed(2))
      };
    });
    
    // Calcular estadísticas
    const promedioComprasPorCliente = clientes.length > 0 ? parseFloat((totalCompras / clientes.length).toFixed(2)) : 0;
    const promedioBeneficioPorCliente = clientes.length > 0 ? parseFloat((totalBeneficio / clientes.length).toFixed(2)) : 0;
    
    // Construir respuesta
    const respuesta = {
      fecha_generacion: new Date().toLocaleString('es-ES'),
      filtros: {
        id_cliente: id_cliente || null,
        desde: desde || null,
        hasta: hasta || null
      },
      totales: {
        total_clientes: clientes.length,
        clientes_con_compras: clientesConCompras,
        total_compras: totalCompras,
        total_beneficio: parseFloat(totalBeneficio.toFixed(2))
      },
      estadisticas: {
        promedio_compras_por_cliente: promedioComprasPorCliente,
        promedio_beneficio_por_cliente: promedioBeneficioPorCliente
      },
      clientes: clientesProcesados
    };
    
    return res.status(200).json(respuesta);
    
  } catch (error) {
    console.error("Error en obtenerDatosClientes:", error);
    return res.status(500).json({ 
      mensaje: "Error al obtener los datos de clientes", 
      error: error.message 
    });
  }
};

// Generar reporte de clientes en Excel
const reporteClientesXlsx = async (req, res) => {
  try {
    const {
      id_cliente,
      desde,
      hasta,
      usuario = '',
      nombreSistema = 'Auto Accesorios Pinedo'
    } = req.body || {};

    console.log('Generar Excel clientes - parámetros:', req.body);

    // Construir filtros para clientes
    const whereCliente = {};
    if (id_cliente && String(id_cliente).trim() !== '') {
      whereCliente.id_cliente = parseInt(id_cliente);
    }

    // Construir filtros para ventas (fecha_registro es STRING: 'YYYY-MM-DD hh:mm:ss')
    const desdeVal = desde && String(desde).trim() !== '' ? String(desde).trim() : null;
    const hastaVal = hasta && String(hasta).trim() !== '' ? String(hasta).trim() : null;

    const whereVenta = {
      estado: { [Op.ne]: 2 }, // Excluir ventas anuladas
      [Op.and]: [
        ...(desdeVal ? [Sequelize.literal(`SUBSTRING(CAST("venta"."fecha_registro" AS TEXT), 1, 10) >= '${desdeVal}'`)] : []),
        ...(hastaVal ? [Sequelize.literal(`SUBSTRING(CAST("venta"."fecha_registro" AS TEXT), 1, 10) <= '${hastaVal}'`)] : [])
      ]
    };

    // Obtener clientes con sus ventas válidas
    const clientesRaw = await db.cliente.findAll({
      where: whereCliente,
      order: [["id_cliente", "ASC"]],
      include: [
        {
          model: db.venta,
          required: false,
          where: whereVenta
        }
      ]
    });

    if (!clientesRaw || clientesRaw.length === 0) {
      return res.status(404).send('No se encontraron clientes con los filtros especificados');
    }

    // Convertir a objetos planos
    const clientes = clientesRaw.map(c => c.get ? c.get({ plain: true }) : c);

    // Formatear fecha_registro: 'YYYY-MM-DD hh:mm:ss' → '12 Abril 2026, hh:mm:ss'
    const formatFechaRegistro = (fecha) => {
      if (!fecha) return '';
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const partes = String(fecha).split(' ');
      const [year, month, day] = (partes[0] || '').split('-');
      const timePart = partes[1] || '';
      const mesNombre = meses[parseInt(month, 10) - 1] || '';
      return `${parseInt(day, 10)} ${mesNombre} ${year}${timePart ? ', ' + timePart : ''}`;
    };

    let totalBeneficio = 0;
    let totalCompras = 0;
    let clientesConCompras = 0;

    // Procesar datos de clientes
    const clientesProcesados = clientes.map((cliente, index) => {
      const nombreCompleto = `${cliente.nombre || ''} ${cliente.ap_paterno || ''} ${cliente.ap_materno || ''}`.trim();
      const ciNit = cliente.ci_nit || '';
      const celular = cliente.celular || '';
      const email = cliente.email || '';
      const fechaReg = formatFechaRegistro(cliente.fecha_registro);

      // Calcular beneficio del cliente (solo ventas válidas, estado != 2)
      let beneficioCliente = 0;
      let cantidadCompras = 0;

      if (cliente.venta && cliente.venta.length > 0) {
        cliente.venta.forEach(venta => {
          const monto = parseFloat(venta.monto_total) || 0;
          const descuento = parseFloat(venta.descuento) || 0;
          beneficioCliente += (monto - descuento);
          cantidadCompras++;
        });
      }

      // Acumular totales
      totalBeneficio += beneficioCliente;
      totalCompras += cantidadCompras;
      if (cantidadCompras > 0) {
        clientesConCompras++;
      }

      return {
        numero: index + 1,
        nombre_completo: nombreCompleto,
        ci_nit: ciNit,
        celular: celular,
        email: email,
        fecha_registro: fechaReg,
        cantidad_compras: cantidadCompras,
        beneficio_total: beneficioCliente
      };
    });

    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = nombreSistema || 'Auto Accesorios Pinedo';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Clientes');

    // Líneas de filtros
    const filtroLines = [];
    if (id_cliente) {
      const clienteFiltrado = clientes.find(c => c.id_cliente == id_cliente);
      if (clienteFiltrado) {
        const nombreFiltrado = `${clienteFiltrado.nombre || ''} ${clienteFiltrado.ap_paterno || ''} ${clienteFiltrado.ap_materno || ''}`.trim();
        filtroLines.push(`Cliente: ${nombreFiltrado}`);
      }
    }
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);

    // Encabezado (título y filtros)
    const firstRow = ['', 'Reporte de Clientes - Beneficio por Ventas'];
    const titleRow = sheet.addRow(firstRow);
    titleRow.font = { bold: true, size: 14 };

    const secondRow = [''];
    secondRow.push(`Fecha generación: ${new Date().toLocaleString('es-BO')}`);
    for (const f of filtroLines) secondRow.push(f);
    sheet.addRow(secondRow);
    sheet.addRow([]);

    // Definir columnas
    sheet.columns = [
      { key: 'nro', width: 6 },
      { key: 'nombre', width: 32 },
      { key: 'ci', width: 14 },
      { key: 'celular', width: 16 },
      { key: 'email', width: 28 },
      { key: 'fecha', width: 24 },
      { key: 'compras', width: 12 },
      { key: 'beneficio', width: 16 }
    ];

    // Insertar fila de encabezado
    const headerLabels = ['Nro', 'Nombre Completo', 'CI/NIT', 'Celular', 'Email', 'Fecha Registro', 'Cantidad Compras', 'Beneficio Total'];
    const headerRow = sheet.addRow(headerLabels);
    headerRow.font = { bold: true, size: 11 };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDFF2E6' } };
    });

    // Añadir datos de clientes
    clientesProcesados.forEach((cliente) => {
      const row = sheet.addRow([
        cliente.numero,
        cliente.nombre_completo,
        cliente.ci_nit,
        cliente.celular,
        cliente.email,
        cliente.fecha_registro,
        cliente.cantidad_compras,
        cliente.beneficio_total.toFixed(2)
      ]);
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'right' };
    });

    // Fila de totales
    const totalRow = sheet.addRow(['', 'TOTALES', '', '', '', '', totalCompras, totalBeneficio.toFixed(2)]);
    sheet.mergeCells(totalRow.number, 1, totalRow.number, 6);
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFAED6F1' } };
    });
    totalRow.getCell(7).alignment = { horizontal: 'center' };
    totalRow.getCell(8).alignment = { horizontal: 'right' };
    totalRow.getCell(8).numFmt = '#,##0.00';

    // Línea vacía antes del resumen
    sheet.addRow([]);

    // Franja de resumen
    const bandRow = sheet.addRow(['RESUMEN']);
    sheet.mergeCells(bandRow.number, 1, bandRow.number, 8);
    const bandCell = sheet.getCell(bandRow.number, 1);
    bandCell.font = { bold: true, size: 12 };
    bandCell.alignment = { horizontal: 'center' };
    bandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };

    // Calcular estadísticas
    const promedioComprasPorCliente = clientes.length > 0 ? (totalCompras / clientes.length).toFixed(2) : 0;
    const promedioBeneficioPorCliente = clientes.length > 0 ? (totalBeneficio / clientes.length).toFixed(2) : 0;

    // Resúmenes
    const sumRow1 = sheet.addRow([]);
    sumRow1.getCell(2).value = `Total de clientes: ${clientes.length}`;
    sumRow1.getCell(4).value = `Clientes con compras: ${clientesConCompras}`;
    sumRow1.getCell(2).font = { bold: true };
    sumRow1.getCell(4).font = { bold: true };
    sumRow1.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
    sumRow1.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };

    const sumRow2 = sheet.addRow([]);
    sumRow2.getCell(2).value = `Promedio compras por cliente: ${promedioComprasPorCliente}`;
    sumRow2.getCell(4).value = `Promedio beneficio por cliente: Bs ${parseFloat(promedioBeneficioPorCliente).toFixed(2)}`;
    sumRow2.getCell(2).font = { bold: true };
    sumRow2.getCell(4).font = { bold: true };
    sumRow2.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
    sumRow2.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };

    // Formato general
    sheet.eachRow((row) => {
      row.font = { size: 9 };
      row.alignment = { vertical: 'middle', wrapText: true };
    });

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = `reporte_clientes_${new Date().getTime()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Error al generar XLSX de clientes:', error);
    res.status(500).send('Error al generar reporte Excel de clientes');
  }
};

module.exports = { reporteClientes, obtenerDatosClientes, reporteClientesXlsx };
