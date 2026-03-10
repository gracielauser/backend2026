const { db } = require("../../config/dataBase");
const PdfPrinter = require("pdfmake");
const fonts = require("../../utils/pdfFonts");
const convertImageToBase64 = require("../../utils/imageToBase64");
const { Op, Sequelize } = require("sequelize");

// Helper para formatear números
const formatNumber = (num) => {
  const n = parseFloat(num) || 0;
  return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Reporte de ventas facturadas
const reporteFacturas = async (req, res) => {
  try {
    const {
      desde,
      hasta,
      usuario = '',
      nombreSistema = 'Auto Accesorios Pinedo'
    } = req.body || {};
    
    console.log('Reporte de facturas - parámetros:', req.body);
    
    // Construir filtros
    const whereClause = {
      tipo_venta: 2 // Solo ventas facturadas
    };
    
    // Filtro por rango de fechas
    if (desde || hasta) {
      if (desde && String(desde).trim() !== '') {
        whereClause.fecha_registro = whereClause.fecha_registro || {};
        whereClause.fecha_registro[Op.gte] = String(desde).trim();
      }
      
      if (hasta && String(hasta).trim() !== '') {
        whereClause.fecha_registro = whereClause.fecha_registro || {};
        whereClause.fecha_registro[Op.lte] = String(hasta).trim();
      }
    }
    
    console.log('Where clause:', whereClause);
    
    // Obtener ventas facturadas con factura asociada
    const ventas = await db.venta.findAll({
      where: whereClause,
      order: [["id_venta", "DESC"]],
      include: [
        {
          model: db.factura,
          required: false
        },
        {
          model: db.cliente,
          required: false
        },
        {
          model: db.usuario,
          required: false,
          include: [{
            model: db.empleado,
            required: false
          }]
        }
      ]
    });
    
    // Construir tabla
    const body = [];
    const headerRow = [
      { text: 'Nro', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Fecha', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'N° Fac', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Cliente', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'N° Doc', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Met. Pago', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'center' },
      { text: 'Usuario', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Estado', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'center' },
      { text: 'Pagado', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'right' }
    ];
    body.push(headerRow);
    
    let totalGeneral = 0;
    const totalesPorEstado = {
      1: { cantidad: 0, monto: 0 }, // Válido
      2: { cantidad: 0, monto: 0 }  // Anulado
    };
    
    // Agregar filas de datos
    ventas.forEach((venta, index) => {
      const fecha = venta.fecha_registro ? String(venta.fecha_registro).substring(0, 10) : '';
      // Como la relación es hasMany, accedemos al array facturas
      const facturaAsociada = venta.facturas && venta.facturas.length > 0 ? venta.facturas[0] : null;
      const nroFactura = facturaAsociada?.nro_factura || 'S/N';
      const clienteNombre = venta.cliente 
        ? `${venta.cliente.nombre || ''} ${venta.cliente.ap_paterno || ''} ${venta.cliente.ap_materno || ''}`.trim()
        : 'S/N';
      const clienteDoc = venta.cliente?.ci_nit || '';
      const metodoPago = venta.tipo_pago === 1 ? 'Efectivo' : 'Transf Bancaria';
      const usuarioNombre = venta.usuario?.usuario || 'Sin usuario';
      const estadoText = venta.estado === 1 ? 'Válido' : 'Anulado';
      const estadoColor = venta.estado === 1 ? '#00aa00' : '#aa0000';
      
      const monto = parseFloat(venta.monto_total) || 0;
      const descuento = parseFloat(venta.descuento) || 0;
      const pagado = monto - descuento;
      
      // Acumular total general (sin importar estado)
      totalGeneral += pagado;
      
      // Acumular por estado
      const estadoKey = venta.estado || 1;
      if (!totalesPorEstado[estadoKey]) {
        totalesPorEstado[estadoKey] = { cantidad: 0, monto: 0 };
      }
      totalesPorEstado[estadoKey].cantidad++;
      totalesPorEstado[estadoKey].monto += pagado;
      
      body.push([
        { text: String(index + 1), fontSize: 8 },
        { text: fecha, fontSize: 8 },
        { text: String(nroFactura), fontSize: 8 },
        { text: clienteNombre, fontSize: 8 },
        { text: String(clienteDoc), fontSize: 8 },
        { text: metodoPago, fontSize: 8, alignment: 'center' },
        { text: usuarioNombre, fontSize: 8 },
        { text: estadoText, fontSize: 8, alignment: 'center', color: estadoColor },
        { text: formatNumber(pagado), fontSize: 8, alignment: 'right' }
      ]);
    });
    
    // Línea separadora antes del total
    body.push([
      { text: '', colSpan: 9, border: [false, true, false, false] },
      {}, {}, {}, {}, {}, {}, {}, {}
    ]);
    
    // Fila de total general
    body.push([
      { text: 'TOTAL GENERAL', bold: true, colSpan: 8, fillColor: '#aed6f1', fontSize: 9 },
      {}, {}, {}, {}, {}, {}, {},
      { text: formatNumber(totalGeneral), bold: true, fillColor: '#aed6f1', alignment: 'right', fontSize: 9 }
    ]);
    
    // Línea separadora antes del resumen
    body.push([
      { text: '', colSpan: 9, border: [false, true, false, false] },
      {}, {}, {}, {}, {}, {}, {}, {}
    ]);
    
    // Resumen de totales por estado
    body.push([
      { text: 'TOTALES POR ESTADO', bold: true, colSpan: 9, fillColor: '#f5f5f5', fontSize: 10, alignment: 'center' },
      {}, {}, {}, {}, {}, {}, {}, {}
    ]);
    
    body.push([
      { text: 'Estado', bold: true, colSpan: 6, fillColor: '#e8e8e8', fontSize: 9 },
      {}, {}, {}, {}, {},
      { text: 'Cantidad', bold: true, fillColor: '#e8e8e8', fontSize: 9, alignment: 'center' },
      { text: 'Monto Total', bold: true, colSpan: 2, fillColor: '#e8e8e8', fontSize: 9, alignment: 'right' },
      {}
    ]);
    
    // Agregar fila por cada estado
    Object.entries(totalesPorEstado).forEach(([estado, datos]) => {
      if (datos.cantidad > 0) {
        const estadoText = estado === '1' ? 'Válido' : 'Anulado';
        const estadoColor = estado === '1' ? '#00aa00' : '#aa0000';
        
        body.push([
          { text: estadoText, colSpan: 6, fontSize: 8, color: estadoColor },
          {}, {}, {}, {}, {},
          { text: String(datos.cantidad), fontSize: 8, alignment: 'center' },
          { text: formatNumber(datos.monto), colSpan: 2, fontSize: 8, alignment: 'right' },
          {}
        ]);
      }
    });
    
    // Configurar anchos de columna
    const colWidths = [30, 60, 50, '*', 70, 70, 80, 50, 70];
    
    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64('../assets/logo2.jpeg');
    
    const filtroLines = [];
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    if (!filtroLines.length) filtroLines.push('Sin filtros aplicados');
    
    const encabezadoCols = [
      { image: logo, width: 70 },
      {
        stack: [
          { text: 'Reporte de Facturas', style: 'titulo' },
          ...filtroLines.map(l => ({ text: l, style: 'filtro' }))
        ],
        margin: [10, 0, 0, 0],
        width: '*'
      },
      {
        stack: [
          { text: `Generado por: ${usuario || 'desconocido'}`, alignment: 'right', fontSize: 8 },
          { text: `Sistema: ${nombreSistema || 'TarijaSport'}`, alignment: 'right', fontSize: 8 },
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
          { text: `${nombreSistema || 'TarijaSport'} - Página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 0, 40, 0], fontSize: 8 }
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
      res.setHeader('Content-Disposition', 'inline; filename=reporte_facturas.pdf');
      res.send(pdfBuffer);
    });
    pdfDoc.end();
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar reporte de facturas');
  }
};

module.exports = { reporteFacturas };
