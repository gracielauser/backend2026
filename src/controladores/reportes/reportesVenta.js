const express = require("express");
const router = express.Router();
const { db } = require("../../config/dataBase");
const PdfPrinter = require("pdfmake");
const fonts = require("../../utils/pdfFonts");
const convertImageToBase64 = require("../../utils/imageToBase64");
const { Op, Sequelize, literal } = require("sequelize");

const ventaNota = async (req, res) => {
  try {
    const id_venta = req.params.idVenta;
    if (!id_venta) return res.status(400).send("Falta id_venta");

    const ventaRaw = await db.venta.findByPk(id_venta, {
      include: [
        { model: db.cliente },
        { model: db.usuario },
        { model: db.det_venta, include: [{ model: db.producto }] }
      ]
    });

    if (!ventaRaw) return res.status(404).send("Venta no encontrada");

    // convertir a objeto plano para evitar instancias Sequelize en el PDF
    const venta = ventaRaw.get ? ventaRaw.get({ plain: true }) : ventaRaw;

    // normalizar nombre de la colección de detalles por si difiere
    const detalles =
      venta.det_venta || venta.det_ventas || venta.detventas || venta.detalles || [];

    // helper para forzar texto
    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      // si es objeto tratar de sacar campos comunes
      if (typeof v === "object") {
        return v.nombre || v.NOMBRE || v.usuario || v.email || v.id_usuario || JSON.stringify(v);
      }
      return String(v);
    };

    const printer = new PdfPrinter(fonts);
    const logo = await convertImageToBase64("../assets/logo.png");

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // tabla de items
    const itemsHeader = [
      { text: "N°", bold: true },
      { text: "Producto", bold: true },
      { text: "Cant.", bold: true, alignment: "right" },
      { text: "P.Unit", bold: true, alignment: "right" },
      { text: "SubTotal", bold: true, alignment: "right" },
    ];

    const itemsBody = detalles.map((d, i) => {
      const productoNombre = safeText(d.producto?.nombre || d.nombre || d.producto);
      const cantidad = Number(d.cantidad || d.cant || 0) || 0;
      const precioUnit = Number(d.precio_unitario || d.precio || 0) || 0;
      const subtotalItem = Number(d.sub_total || d.subtotal) || cantidad * precioUnit;
      return [
        { text: String(i + 1) },
        productoNombre,
        { text: String(cantidad), alignment: "right" },
        { text: formatMoney(precioUnit), alignment: "right" },
        { text: formatMoney(subtotalItem), alignment: "right" }
      ];
    });

    const subtotal = detalles.reduce((acc, d) => {
      const cantidad = Number(d.cantidad || d.cant || 0) || 0;
      const precioUnit = Number(d.precio_unitario || d.precio || 0) || 0;
      const st = Number(d.sub_total || d.subtotal) || cantidad * precioUnit;
      return acc + st;
    }, 0);
    const descuento = Number(venta.descuento) || 0;
    const monto_total = Number(venta.monto_total) || Number(venta.monto) || subtotal - descuento;

    const docDefinition = {
      content: [
        {
          columns: [
            { image: logo, width: 60 },
            {
              stack: [
                { text: "NOTA DE VENTA", style: "title", alignment: "center" },
                { text: `Nro: ${safeText(venta.nro_venta || venta.nro || "")}`, alignment: "center" },
                { text: `Fecha: ${safeText(new Date(venta.fecha_registro || venta.fecha || Date.now()).toLocaleDateString())}`, alignment: "center" }
              ],
              width: "*"
            },
            {
              table: {
                body: [
                  [{ text: "Vendedor", bold: true }, safeText(venta.usuario)],
                  [{ text: "Cliente", bold: true }, safeText(venta.cliente)],
                  [{ text: "CI/CUIT", bold: true }, safeText(venta.cliente?.ci_nit || venta.cliente?.CI_NIT)],
                  [{ text: "Tel", bold: true }, safeText(venta.cliente?.celular || venta.cliente?.CELULAR)]
                ]
              },
              layout: "noBorders",
              width: 220
            }
          ]
        },
        { text: "\n" },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "*", "auto", "auto", "auto"],
            body: [itemsHeader, ...itemsBody]
          },
          layout: "lightHorizontalLines"
        },
        {
          columns: [
            { width: "*", text: "" },
            {
              width: 200,
              table: {
                body: [
                  [{ text: "Subtotal", alignment: "left" }, { text: formatMoney(subtotal), alignment: "right" }],
                  [{ text: "Descuento", alignment: "left" }, { text: formatMoney(descuento), alignment: "right" }],
                  [{ text: "Total", bold: true, alignment: "left" }, { text: formatMoney(monto_total), bold: true, alignment: "right" }]
                ]
              },
              layout: "noBorders"
            }
          ]
        },
        { text: "\n" },
        { text: `Observaciones: ${safeText(venta.descripcion || venta.DESCRIPCION || "")}`, italics: true }
      ],
      styles: {
        title: { fontSize: 16, bold: true },
      },
      defaultStyle: {
        font: "Roboto"
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on("data", (c) => chunks.push(c));
    pdfDoc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=nota_venta_${safeText(venta.nro_venta || venta.id_venta || id_venta)}.pdf`);
      res.send(pdfBuffer);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al generar Nota de Venta");
  }
};

// Helper para formatear números
const formatNumber = (num) => {
  const n = parseFloat(num) || 0;
  return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper para construir fila de venta en PDF
const buildVentaRowPdf = (venta, counter, orden) => {
  const row = [];
  
  // Nro
  row.push({ text: String(counter), fontSize: 8 });
  
  // Usuario (si no está agrupado por usuario)
  if (orden !== 'usuario') {
    const nombreUsuario = venta.usuario?.empleado 
      ? `${venta.usuario.empleado.nombre || ''} ${venta.usuario.empleado.apellido_paterno || ''}`.trim()
      : (venta.usuario?.usuario || 'Sin usuario');
    row.push({ text: nombreUsuario, fontSize: 8 });
  }
  
  // Fecha
  const fecha = venta.fecha_registro ? new Date(venta.fecha_registro).toLocaleDateString('es-BO') : '';
  row.push({ text: fecha, fontSize: 8 });
  
  // Cliente (si no está agrupado por cliente)
  if (orden !== 'cliente') {
    const nombreCliente = venta.cliente 
      ? `${venta.cliente.nombre || ''} ${venta.cliente.apellido_paterno || ''}`.trim()
      : 'Sin cliente';
    row.push({ text: nombreCliente, fontSize: 8 });
  }
  
  // Tipo venta (si no está agrupado por tipo_venta)
  if (orden !== 'tipo_venta') {
    const tipoText = venta.tipo_venta === 2 ? 'Facturado' : 'Normal';
    row.push({ text: tipoText, fontSize: 8 });
  }
  
  // Monto
  const monto = parseFloat(venta.monto_total) || 0;
  row.push({ text: formatNumber(monto), alignment: 'right', fontSize: 8 });
  
  // Descuento
  const descuento = parseFloat(venta.descuento) || 0;
  row.push({ text: formatNumber(descuento), alignment: 'right', fontSize: 8 });
  
  // Total
  const total = monto - descuento;
  row.push({ text: formatNumber(total), alignment: 'right', fontSize: 8, bold: true });
  
  // Estado
  const estadoText = venta.estado === 1 ? 'Válido' : venta.estado === 2 ? 'Anulado' : String(venta.estado);
  const estadoColor = venta.estado === 1 ? '#00aa00' : '#aa0000';
  row.push({ text: estadoText, fontSize: 8, alignment: 'center', color: estadoColor });
  
  return row;
};

// Reporte de ventas con filtros y agrupación
const reporteVentas = async (req, res) => {
  try {
    const {
      desde,
      hasta,
      usuario = '',
      id_usuario,
      nombreSistema = 'TarijaSport',
      estado,
      id_cliente,
      tipo_venta,
      orden = null // null, 'cliente', 'usuario', 'tipo_venta'
    } = req.body || {};
    
    console.log('Reporte de ventas - parámetros:', req.body);
    
    const whereClause = {};
    
    // Filtro por cliente
    if (id_cliente && String(id_cliente).trim() !== '') {
      whereClause.id_cliente = parseInt(id_cliente);
    }
    
    // Filtro por estado
    if (estado !== undefined && String(estado).trim() !== '') {
      whereClause.estado = parseInt(estado);
    }
    
    // Filtro por usuario
    if (id_usuario && String(id_usuario).trim() !== '') {
      whereClause.id_usuario = parseInt(id_usuario);
    }
    
    // Filtro por tipo de venta
    if (tipo_venta !== undefined && String(tipo_venta).trim() !== '') {
      whereClause.tipo_venta = parseInt(tipo_venta);
    }
    
    // Filtro por rango de fechas
    if (desde || hasta) {
      whereClause[Op.and] = whereClause[Op.and] || [];
      
      if (desde && String(desde).trim() !== '') {
        whereClause[Op.and].push(
          literal(`"venta"."fecha_registro" >= '${String(desde).trim()}'`)
        );
      }
      
      if (hasta && String(hasta).trim() !== '') {
        whereClause[Op.and].push(
          literal(`"venta"."fecha_registro" <= '${String(hasta).trim()}'`)
        );
      }
    }
    
    console.log('Where clause:', whereClause);
    
    // Calcular totales
    let whereTotalVentas;
    if (estado !== undefined && String(estado).trim() !== '') {
      whereTotalVentas = { ...whereClause };
    } else {
      whereTotalVentas = { ...whereClause, estado: 1 }; // Por defecto solo válidas
    }
    
    const resultadoTotalVentas = await db.venta.findOne({
      where: whereTotalVentas,
      attributes: [
        [Sequelize.fn('COALESCE', 
          Sequelize.fn('SUM', 
            Sequelize.literal('monto_total - COALESCE(descuento, 0)')
          ), 
          0
        ), 'total']
      ],
      raw: true
    });
    const totalVentas = parseFloat(resultadoTotalVentas?.total) || 0;
    
    // Obtener ventas
    const ventas = await db.venta.findAll({
      where: whereClause,
      order: [["id_venta", "DESC"]],
      include: [
        {
          model: db.det_venta,
          include: [
            {
              model: db.producto,
            }
          ]
        },
        {
          model: db.usuario,
          include: [{
            model: db.empleado,
          }]
        },
        {
          model: db.cliente
        }
      ]
    });
    
    // Construir tabla
    const body = [];
    const headerRow = [];
    headerRow.push({ text: 'Nro', bold: true, fillColor: '#dff2e6' });
    if (orden !== 'usuario') headerRow.push({ text: 'Usuario', bold: true, fillColor: '#dff2e6' });
    headerRow.push({ text: 'Fecha', bold: true, fillColor: '#dff2e6' });
    if (orden !== 'cliente') headerRow.push({ text: 'Cliente', bold: true, fillColor: '#dff2e6' });
    if (orden !== 'tipo_venta') headerRow.push({ text: 'Tipo', bold: true, fillColor: '#dff2e6' });
    headerRow.push({ text: 'Monto', bold: true, alignment: 'right', fillColor: '#dff2e6' });
    headerRow.push({ text: 'Desc', bold: true, alignment: 'right', fillColor: '#dff2e6' });
    headerRow.push({ text: 'Total', bold: true, alignment: 'right', fillColor: '#dff2e6' });
    headerRow.push({ text: 'Estado', bold: true, alignment: 'center', fillColor: '#dff2e6' });
    body.push(headerRow);
    
    const numCols = headerRow.length;
    let counter = 1;
    
    // Si orden es null, solo listar sin agrupar
    if (orden === null || orden === undefined || orden === '') {
      for (const v of ventas) {
        body.push(buildVentaRowPdf(v, counter, orden));
        counter++;
      }
    } else if (orden === 'cliente') {
      // Agrupar por cliente
      const byCliente = {};
      for (const v of ventas) {
        const cid = v.id_cliente || 'sin';
        if (!byCliente[cid]) byCliente[cid] = [];
        byCliente[cid].push(v);
      }
      
      for (const [cid, ventasCli] of Object.entries(byCliente)) {
        if (!ventasCli.length) continue;
        
        let nombreCliente = 'Sin cliente';
        if (cid !== 'sin') {
          const cli = ventasCli[0].cliente;
          nombreCliente = cli ? `${cli.nombre || ''} ${cli.apellido_paterno || ''}`.trim() : `Cliente ${cid}`;
        }
        
        const groupHeader = [{ text: nombreCliente, colSpan: numCols, bold: true, fillColor: '#eaf7ef' }];
        for (let i = 1; i < numCols; i++) groupHeader.push({});
        body.push(groupHeader);
        
        for (const v of ventasCli) {
          body.push(buildVentaRowPdf(v, counter, orden));
          counter++;
        }
        
        let clienteTotal = 0;
        for (const v of ventasCli) {
          const montoNum = parseFloat(v.monto_total) || 0;
          const descuentoNum = parseFloat(v.descuento) || 0;
          clienteTotal += (montoNum - descuentoNum);
        }
        
        const totalRow = [];
        for (let i = 0; i < numCols; i++) {
          if (i === numCols - 3) totalRow.push({ text: `Total ${nombreCliente}`, bold: true, fillColor: '#dff2e6' });
          else if (i === numCols - 2) totalRow.push({ text: formatNumber(clienteTotal), alignment: 'right', bold: true, fillColor: '#dff2e6' });
          else totalRow.push({ text: '', fillColor: i === numCols - 3 || i === numCols - 2 ? '#dff2e6' : undefined });
        }
        body.push(totalRow);
      }
    } else if (orden === 'usuario') {
      // Agrupar por usuario
      const byUsuario = {};
      for (const v of ventas) {
        const uid = v.id_usuario || 'sin';
        if (!byUsuario[uid]) byUsuario[uid] = [];
        byUsuario[uid].push(v);
      }
      
      for (const [uid, ventasUsr] of Object.entries(byUsuario)) {
        if (!ventasUsr.length) continue;
        
        let nombreUsuario = 'Sin usuario';
        if (uid !== 'sin') {
          const usr = ventasUsr[0].usuario;
          nombreUsuario = usr?.empleado 
            ? `${usr.empleado.nombre || ''} ${usr.empleado.apellido_paterno || ''}`.trim()
            : (usr?.usuario || `Usuario ${uid}`);
        }
        
        const groupHeader = [{ text: nombreUsuario, colSpan: numCols, bold: true, fillColor: '#eaf7ef' }];
        for (let i = 1; i < numCols; i++) groupHeader.push({});
        body.push(groupHeader);
        
        for (const v of ventasUsr) {
          body.push(buildVentaRowPdf(v, counter, orden));
          counter++;
        }
        
        let usuarioTotal = 0;
        for (const v of ventasUsr) {
          const montoNum = parseFloat(v.monto_total) || 0;
          const descuentoNum = parseFloat(v.descuento) || 0;
          usuarioTotal += (montoNum - descuentoNum);
        }
        
        const totalRow = [];
        for (let i = 0; i < numCols; i++) {
          if (i === numCols - 3) totalRow.push({ text: `Total ${nombreUsuario}`, bold: true, fillColor: '#dff2e6' });
          else if (i === numCols - 2) totalRow.push({ text: formatNumber(usuarioTotal), alignment: 'right', bold: true, fillColor: '#dff2e6' });
          else totalRow.push({ text: '', fillColor: i === numCols - 3 || i === numCols - 2 ? '#dff2e6' : undefined });
        }
        body.push(totalRow);
      }
    } else if (orden === 'tipo_venta') {
      // Agrupar por tipo de venta
      const byTipo = {};
      for (const v of ventas) {
        const tid = v.tipo_venta || 1;
        if (!byTipo[tid]) byTipo[tid] = [];
        byTipo[tid].push(v);
      }
      
      for (const [tid, ventasTipo] of Object.entries(byTipo)) {
        if (!ventasTipo.length) continue;
        
        const nombreTipo = tid == 2 ? 'Facturado' : 'Normal';
        
        const groupHeader = [{ text: nombreTipo, colSpan: numCols, bold: true, fillColor: '#eaf7ef' }];
        for (let i = 1; i < numCols; i++) groupHeader.push({});
        body.push(groupHeader);
        
        for (const v of ventasTipo) {
          body.push(buildVentaRowPdf(v, counter, orden));
          counter++;
        }
        
        let tipoTotal = 0;
        for (const v of ventasTipo) {
          const montoNum = parseFloat(v.monto_total) || 0;
          const descuentoNum = parseFloat(v.descuento) || 0;
          tipoTotal += (montoNum - descuentoNum);
        }
        
        const totalRow = [];
        for (let i = 0; i < numCols; i++) {
          if (i === numCols - 3) totalRow.push({ text: `Total ${nombreTipo}`, bold: true, fillColor: '#dff2e6' });
          else if (i === numCols - 2) totalRow.push({ text: formatNumber(tipoTotal), alignment: 'right', bold: true, fillColor: '#dff2e6' });
          else totalRow.push({ text: '', fillColor: i === numCols - 3 || i === numCols - 2 ? '#dff2e6' : undefined });
        }
        body.push(totalRow);
      }
    }
    
    // Resumen global (excepto cuando está agrupado)
    if (orden !== null && orden !== undefined && orden !== '') {
      // Separador visual
      const separatorRow = [];
      for (let i = 0; i < numCols; i++) {
        separatorRow.push({ text: '', border: [false, true, false, false] });
      }
      body.push(separatorRow);
      
      // Total general
      const totalGlobalRow = [];
      for (let i = 0; i < numCols; i++) {
        if (i === numCols - 3) totalGlobalRow.push({ text: 'TOTAL GENERAL', bold: true, fillColor: '#aed6f1' });
        else if (i === numCols - 2) totalGlobalRow.push({ text: formatNumber(totalVentas), alignment: 'right', bold: true, fillColor: '#aed6f1', fontSize: 10 });
        else totalGlobalRow.push({ text: '', fillColor: i === numCols - 3 || i === numCols - 2 ? '#aed6f1' : undefined });
      }
      body.push(totalGlobalRow);
    }
    
    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64('../assets/logo.png');
    
    const filtroLines = [];
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    if (id_cliente) {
      const clienteData = await db.cliente.findByPk(id_cliente);
      if (clienteData) {
        filtroLines.push(`Cliente: ${clienteData.nombre || ''} ${clienteData.apellido_paterno || ''}`);
      }
    }
    if (id_usuario) {
      const usuarioData = await db.usuario.findOne({ 
        where: { id_usuario },
        include: [{ model: db.empleado }]
      });
      if (usuarioData) {
        const nombreUsr = usuarioData.empleado 
          ? `${usuarioData.empleado.nombre || ''} ${usuarioData.empleado.apellido_paterno || ''}`.trim()
          : usuarioData.usuario;
        filtroLines.push(`Usuario: ${nombreUsr}`);
      }
    }
    if (nombreSistema) filtroLines.push(`Sistema: ${nombreSistema}`);
    if (estado !== undefined && estado !== null) {
      filtroLines.push(`Estado: ${estado == 1 ? 'Válido' : estado == 2 ? 'Anulado' : String(estado)}`);
    }
    if (tipo_venta !== undefined && tipo_venta !== null) {
      filtroLines.push(`Tipo: ${tipo_venta == 2 ? 'Facturado' : 'Normal'}`);
    }
    if (!filtroLines.length) filtroLines.push('Sin filtros aplicados');
    
    const encabezadoCols = [
      { image: logo, width: 70 },
      {
        stack: [
          { text: 'Reporte de ventas', style: 'titulo' },
          ...filtroLines.map(l => ({ text: l, style: 'filtro' }))
        ],
        margin: [10, 0, 0, 0],
        width: '*'
      },
      {
        stack: [
          { text: `Generado por: ${usuario || 'desconocido'}`, alignment: 'right' },
          { text: `Sistema: ${nombreSistema || 'TarijaSport'}`, alignment: 'right' },
          { text: `Fecha: ${new Date().toLocaleString('es-BO')}`, alignment: 'right' }
        ],
        width: 160
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
          table: { headerRows: 1, widths: 'auto', body: body },
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
          { text: `Generado: ${new Date().toLocaleString('es-BO')} por: ${usuario || 'desconocido'}`, alignment: 'left', margin: [40, 0, 0, 0] },
          { text: `${nombreSistema || 'TarijaSport'} - Página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 0, 40, 0] }
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
      res.setHeader('Content-Disposition', 'inline; filename=ventas_reporte.pdf');
      res.send(pdfBuffer);
    });
    pdfDoc.end();
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar PDF de ventas');
  }
};

module.exports = { ventaNota, reporteVentas };