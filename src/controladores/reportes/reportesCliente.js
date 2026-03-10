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

// Reporte de clientes con beneficio por ventas
const reporteClientes = async (req, res) => {
  try {
    const {
      id_cliente,
      desde,
      hasta,
      usuario = '',
      nombreSistema = 'Auto Accesorios Pinedo'
    } = req.body || {};
    
    console.log('Reporte de clientes - parámetros:', req.body);
    
    // Construir filtros para clientes
    const whereCliente = {};
    
    // Filtro por cliente específico
    if (id_cliente && String(id_cliente).trim() !== '') {
      whereCliente.id_cliente = parseInt(id_cliente);
    }
    
    // Filtro por rango de fechas en cliente.fecha_registro
    if (desde || hasta) {
      if (desde && String(desde).trim() !== '') {
        whereCliente.fecha_registro = whereCliente.fecha_registro || {};
        whereCliente.fecha_registro[Op.gte] = String(desde).trim();
      }
      
      if (hasta && String(hasta).trim() !== '') {
        whereCliente.fecha_registro = whereCliente.fecha_registro || {};
        whereCliente.fecha_registro[Op.lte] = String(hasta).trim() + ' 23:59:59';
      }
    }
    
    console.log('Where clause clientes:', whereCliente);
    
    // Obtener clientes con sus ventas válidas
    const clientes = await db.cliente.findAll({
      where: whereCliente,
      order: [["id_cliente", "ASC"]],
      include: [
        {
          model: db.venta,
          required: false,
          where: {
            estado: {
              [Op.ne]: 2 // Excluir ventas anuladas
            }
          }
        }
      ]
    });
    console.log('clientes:', clientes);
    
    // Construir tabla
    const body = [];
    const headerRow = [
      { text: 'Nro', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Nombre Completo', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'CI/NIT', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Celular', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Email', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Cantidad Compras', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'center' },
      { text: 'Beneficio Total', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'right' }
    ];
    body.push(headerRow);
    
    let totalBeneficio = 0;
    let totalCompras = 0;
    let clientesConCompras = 0;
    
    // Agregar filas de datos
    clientes.forEach((cliente, index) => {
      const nombreCompleto = `${cliente.nombre || ''} ${cliente.apellido_paterno || ''} ${cliente.apellido_materno || ''}`.trim();
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
      
      body.push([
        { text: String(index + 1), fontSize: 8 },
        { text: nombreCompleto, fontSize: 8 },
        { text: String(ciNit), fontSize: 8 },
        { text: String(celular), fontSize: 8 },
        { text: String(email), fontSize: 8 },
        { text: String(cantidadCompras), fontSize: 8, alignment: 'center' },
        { text: formatNumber(beneficioCliente), fontSize: 8, alignment: 'right', bold: beneficioCliente > 0 }
      ]);
    });
    
    // Línea separadora antes del total
    body.push([
      { text: '', colSpan: 7, border: [false, true, false, false] },
      {}, {}, {}, {}, {}, {}
    ]);
    
    // Fila de totales
    body.push([
      { text: 'TOTALES', bold: true, colSpan: 5, fillColor: '#aed6f1', fontSize: 9 },
      {}, {}, {}, {},
      { text: String(totalCompras), bold: true, fillColor: '#aed6f1', alignment: 'center', fontSize: 9 },
      { text: formatNumber(totalBeneficio), bold: true, fillColor: '#aed6f1', alignment: 'right', fontSize: 9 }
    ]);
    
    // Línea separadora antes del resumen
    body.push([
      { text: '', colSpan: 7, border: [false, true, false, false] },
      {}, {}, {}, {}, {}, {}
    ]);
    
    // Resumen estadístico
    body.push([
      { text: 'RESUMEN', bold: true, colSpan: 7, fillColor: '#f5f5f5', fontSize: 10, alignment: 'center' },
      {}, {}, {}, {}, {}, {}
    ]);
    
    const promedioComprasPorCliente = clientes.length > 0 ? (totalCompras / clientes.length).toFixed(2) : 0;
    const promedioBeneficioPorCliente = clientes.length > 0 ? (totalBeneficio / clientes.length).toFixed(2) : 0;
    
    body.push([
      { text: 'Total de clientes:', colSpan: 5, fontSize: 8, fillColor: '#f9f9f9' },
      {}, {}, {}, {},
      { text: String(clientes.length), colSpan: 2, fontSize: 8, alignment: 'right', fillColor: '#f9f9f9' },
      {}
    ]);
    
    body.push([
      { text: 'Clientes con compras:', colSpan: 5, fontSize: 8, fillColor: '#f9f9f9' },
      {}, {}, {}, {},
      { text: String(clientesConCompras), colSpan: 2, fontSize: 8, alignment: 'right', fillColor: '#f9f9f9' },
      {}
    ]);
    
    body.push([
      { text: 'Promedio compras por cliente:', colSpan: 5, fontSize: 8, fillColor: '#f9f9f9' },
      {}, {}, {}, {},
      { text: promedioComprasPorCliente, colSpan: 2, fontSize: 8, alignment: 'right', fillColor: '#f9f9f9' },
      {}
    ]);
    
    body.push([
      { text: 'Promedio beneficio por cliente:', colSpan: 5, fontSize: 8, fillColor: '#f9f9f9' },
      {}, {}, {}, {},
      { text: `Bs ${formatNumber(promedioBeneficioPorCliente)}`, colSpan: 2, fontSize: 8, alignment: 'right', fillColor: '#f9f9f9' },
      {}
    ]);
    
    // Configurar anchos de columna
    const colWidths = [30, '*', 70, 70, 100, 60, 80];
    
    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64('../assets/logo.png');
    
    const filtroLines = [];
    if (id_cliente) {
      const clienteFiltrado = clientes.find(c => c.id_cliente == id_cliente);
      if (clienteFiltrado) {
        const nombreCli = `${clienteFiltrado.nombre || ''} ${clienteFiltrado.apellido_paterno || ''}`.trim();
        filtroLines.push(`Cliente: ${nombreCli}`);
      }
    }
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    if (!filtroLines.length) filtroLines.push('Todos los clientes');
    
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
      res.setHeader('Content-Disposition', 'inline; filename=reporte_clientes.pdf');
      res.send(pdfBuffer);
    });
    pdfDoc.end();
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar reporte de clientes');
  }
};

module.exports = { reporteClientes };
