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
    // Parámetro 'nota' por query o body, por defecto false
    const nota = req.query.nota === 'true' || req.body?.nota === true || false;
    
    if (!id_venta) return res.status(400).send("Falta id_venta");

    const ventaRaw = await db.venta.findByPk(id_venta, {
      include: [
        { model: db.cliente },
        { model: db.usuario, include: [{ model: db.empleado }] },
        { model: db.det_venta, include: [{ model: db.producto }] }
      ]
    });

    if (!ventaRaw) return res.status(404).send("Venta no encontrada");

    // convertir a objeto plano para evitar instancias Sequelize en el PDF
    const venta = ventaRaw.get ? ventaRaw.get({ plain: true }) : ventaRaw;
    
    // Decidir si generar nota o factura
    if (nota) {
      // Generar nota de venta
      return await generarNotaVenta(venta, res);
    } else if (venta.tipo_venta === 2) {
      // Buscar factura asociada
      const facturaData = await db.factura.findOne({
        where: { id_venta: venta.id_venta }
      });
      // Generar factura boliviana
      return await generarFacturaBoliviana(venta, facturaData, res);
    } else {
      // Por defecto generar nota de venta
      return await generarNotaVenta(venta, res);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al generar documento");
  }
};

// Función auxiliar para generar Nota de Venta
const generarNotaVenta = async (venta, res) => {
  try {
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
    const logo = await convertImageToBase64("../assets/logo2.jpeg");

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
                  [{ text: "Vendedor", bold: true }, safeText(venta.usuario?.empleado ? `${venta.usuario.empleado.nombre || ''} ${venta.usuario.empleado.apellido_paterno || ''}`.trim() : venta.usuario?.usuario || 'Sin usuario')],
                  [{ text: "Cliente", bold: true }, safeText(venta.cliente ? `${venta.cliente.nombre || ''} ${venta.cliente.apellido_paterno || ''}`.trim() : 'Sin cliente')],
                  [{ text: "CI/NIT", bold: true }, safeText(venta.cliente?.ci_nit || venta.cliente?.CI_NIT)],
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
      res.setHeader("Content-Disposition", `inline; filename=nota_venta_${safeText(venta.nro_venta || venta.id_venta)}.pdf`);
      res.send(pdfBuffer);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Función auxiliar para generar Factura Boliviana
const generarFacturaBoliviana = async (venta, factura, res) => {
  try {
    // normalizar nombre de la colección de detalles
    const detalles =
      venta.det_venta || venta.det_ventas || venta.detventas || venta.detalles || [];

    // helper para forzar texto
    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        return v.nombre || v.NOMBRE || v.usuario || v.email || v.id_usuario || JSON.stringify(v);
      }
      return String(v);
    };

    const printer = new PdfPrinter(fonts);
    const logo = await convertImageToBase64("../assets/logo2.jpeg");

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // Datos de la empresa emisora (placeholders - ajustar según necesidad)
    const empresaNIT = "1234567890"; // NIT de la empresa
    const empresaNombre = "TARIJASPORT SRL";
    const empresaDireccion = "Av. Principal #123, Tarija - Bolivia";
    const empresaTelefono = "+591 4-1234567";
    
    // Calcular totales primero (necesarios para código de control)
    const subtotal = detalles.reduce((acc, d) => {
      const cantidad = Number(d.cantidad || d.cant || 0) || 0;
      const precioUnit = Number(d.precio_unitario || d.precio || 0) || 0;
      const st = Number(d.sub_total || d.subtotal) || cantidad * precioUnit;
      return acc + st;
    }, 0);
    const descuento = Number(venta.descuento) || 0;
    const monto_total = Number(venta.monto_total) || Number(venta.monto) || subtotal - descuento;
    const impuesto = Number(factura?.impuesto) || 0;
    const totalConImpuesto = monto_total - descuento;
    
    // Datos de factura (con placeholders si no existen en BD)
    const nroFactura = factura?.nro_factura || venta.nro_venta || "0";
    const codigoAutorizacion = "79040011007"; // Placeholder - debe venir de sistema de impuestos
    const fechaLimiteEmision = "31/12/2026"; // Placeholder
    const codigoControl = generarCodigoControl(nroFactura, empresaNIT, new Date(venta.fecha_registro || Date.now()), monto_total); // Generar código de control
    
    // Cliente
    const clienteNombre = venta.cliente 
      ? `${venta.cliente.nombre || ''} ${venta.cliente.apellido_paterno || ''} ${venta.cliente.apellido_materno || ''}`.trim()
      : 'S/N';
    const clienteNIT = venta.cliente?.ci_nit || '0';

    // tabla de items
    const itemsHeader = [
      { text: "Cant.", bold: true, alignment: "center", fillColor: '#eeeeee' },
      { text: "Detalle", bold: true, fillColor: '#eeeeee' },
      { text: "P. Unitario", bold: true, alignment: "right", fillColor: '#eeeeee' },
      { text: "Descuento", bold: true, alignment: "right", fillColor: '#eeeeee' },
      { text: "Subtotal", bold: true, alignment: "right", fillColor: '#eeeeee' },
    ];

    const itemsBody = detalles.map((d, i) => {
      const productoNombre = safeText(d.producto?.nombre || d.nombre || d.producto);
      const cantidad = Number(d.cantidad || d.cant || 0) || 0;
      const precioUnit = Number(d.precio_unitario || d.precio|| 0) || 0;
      const subtotalItem = Number(d.sub_total || d.subtotal) || cantidad * precioUnit;
      return [
        { text: String(cantidad), alignment: "center" },
        productoNombre,
        { text: formatMoney(precioUnit), alignment: "right" },
        { text: "0.00", alignment: "right" },
        { text: formatMoney(subtotalItem), alignment: "right" }
      ];
    });

    // Convertir monto a literal
    const montoLiteral = numeroALiteral(totalConImpuesto);

    const docDefinition = {
      pageSize: 'LETTER',
      pageMargins: [40, 40, 40, 40],
      content: [
        // Encabezado
        {
          columns: [
            {
              stack: [
                { image: logo, width: 70 },
                { text: empresaNombre, fontSize: 12, bold: true, margin: [0, 5, 0, 0] },
                { text: `Casa Matriz`, fontSize: 8 },
                { text: `NIT: ${empresaNIT}`, fontSize: 8 },
                { text: empresaDireccion, fontSize: 8 },
                { text: `Tel: ${empresaTelefono}`, fontSize: 8 },
              ],
              width: '*'
            },
            {
              stack: [
                { text: 'FACTURA', fontSize: 18, bold: true, alignment: 'right' },
                { text: `Nº ${String(nroFactura).padStart(10, '0')}`, fontSize: 14, bold: true, alignment: 'right', margin: [0, 2, 0, 0] },
                { text: `ORIGINAL`, fontSize: 10, alignment: 'right', margin: [0, 5, 0, 5], italics: true }
              ],
              width: 200
            }
          ]
        },
        
        // Línea separadora
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 10, 0, 10] },
        
        // Datos de autorización
        {
          columns: [
            {
              stack: [
                { text: `Nº de Autorización: ${codigoAutorizacion}`, fontSize: 8 },
                { text: `Código de Control: ${codigoControl}`, fontSize: 8, margin: [0, 2, 0, 0] },
                { text: `Fecha Límite de Emisión: ${fechaLimiteEmision}`, fontSize: 8, margin: [0, 2, 0, 0] }
              ],
              width: '*'
            }
          ],
          margin: [0, 0, 0, 10]
        },
        
        // Datos del cliente y fecha
        {
          table: {
            widths: [80, '*', 80, 100],
            body: [
              [
                { text: 'Fecha:', bold: true, border: [true, true, false, true] },
                { text: new Date(venta.fecha_registro || Date.now()).toLocaleDateString('es-BO'), border: [false, true, true, true] },
                { text: 'NIT/CI:', bold: true, border: [true, true, false, true] },
                { text: clienteNIT, border: [false, true, true, true] }
              ],
              [
                { text: 'Señor(es):', bold: true, border: [true, true, false, true] },
                { text: clienteNombre, colSpan: 3, border: [false, true, true, true] },
                {},
                {}
              ]
            ]
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
          },
          margin: [0, 0, 0, 10]
        },
        
        // Tabla de productos
        {
          table: {
            headerRows: 1,
            widths: [40, '*', 70, 60, 70],
            body: [itemsHeader, ...itemsBody]
          },
          layout: {
            hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
            vLineWidth: () => 1,
          }
        },
        
        // Totales
        {
          columns: [
            {
              stack: [
                { text: 'Son: ', bold: true, fontSize: 9, margin: [0, 10, 0, 0] },
                { text: montoLiteral, fontSize: 8, italics: true }
              ],
              width: '*'
            },
            {
              width: 200,
              table: {
                widths: ['*', 80],
                body: [
                  [{ text: 'SUBTOTAL Bs', alignment: 'right' }, { text: formatMoney(subtotal), alignment: 'right' }],
                  [{ text: 'DESCUENTO Bs', alignment: 'right' }, { text: formatMoney(descuento), alignment: 'right' }],
                  [{ text: 'IMPORTE BASE Bs', alignment: 'right', bold: true }, { text: formatMoney(monto_total), alignment: 'right', bold: true }],
                  [{ text: 'TOTAL Bs', alignment: 'right', bold: true, fontSize: 11 }, { text: formatMoney(totalConImpuesto), alignment: 'right', bold: true, fontSize: 11 }]
                ]
              },
              layout: 'noBorders',
              margin: [0, 5, 0, 0]
            }
          ]
        },
        
        // Leyenda legal
        {
          stack: [
            { text: '\n\n' },
            { 
              text: 'ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS. EL USO ILÍCITO DE ÉSTA SERÁ SANCIONADO DE ACUERDO A LEY', 
              fontSize: 7, 
              alignment: 'center',
              bold: true,
              margin: [0, 10, 0, 5]
            },
            {
              text: 'Ley Nº 453: El proveedor deberá exhibir certificaciones de homologación del producto y documentación técnica respaldatoria.',
              fontSize: 6,
              alignment: 'center',
              margin: [0, 5, 0, 0]
            },
            {
              text: `"Este documento es la Representación Gráfica de un Documento Fiscal Digital emitido en una modalidad de facturación en línea"`,
              fontSize: 6,
              alignment: 'center',
              italics: true,
              margin: [0, 5, 0, 0]
            }
          ]
        }
      ],
      styles: {
        title: { fontSize: 16, bold: true },
      },
      defaultStyle: {
        font: "Roboto",
        fontSize: 9
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on("data", (c) => chunks.push(c));
    pdfDoc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename=factura_${String(nroFactura).padStart(10, '0')}.pdf`);
      res.send(pdfBuffer);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Helper para generar código de control (simplificado)
const generarCodigoControl = (nroFactura, nit, fecha, monto) => {
  // Esto es un placeholder - el código de control real debe generarse según algoritmo de Impuestos Bolivia
  const base = `${nroFactura}${nit}${fecha.getTime()}${monto}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().substring(0, 13).padStart(13, '0');
};

// Helper para convertir número a literal (español)
const numeroALiteral = (numero) => {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];

  const convertirGrupo = (n) => {
    if (n === 0) return '';
    if (n < 10) return unidades[n];
    if (n >= 10 && n < 20) return especiales[n - 10];
    if (n >= 20 && n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return decenas[d] + (u > 0 ? ` Y ${unidades[u]}` : '');
    }
    if (n >= 100 && n < 1000) {
      const c = Math.floor(n / 100);
      const resto = n % 100;
      let resultado = n === 100 ? 'CIEN' : centenas[c];
      if (resto > 0) resultado += ` ${convertirGrupo(resto)}`;
      return resultado;
    }
    return '';
  };

  let parteEntera = Math.floor(numero);
  const parteDecimal = Math.round((numero - parteEntera) * 100);

  if (parteEntera === 0) {
    return `CERO ${parteDecimal}/100 BOLIVIANOS`;
  }

  let literal = '';
  
  if (parteEntera >= 1000000) {
    const millones = Math.floor(parteEntera / 1000000);
    literal += convertirGrupo(millones) + (millones === 1 ? ' MILLON ' : ' MILLONES ');
    parteEntera = parteEntera % 1000000;
  }
  
  if (parteEntera >= 1000) {
    const miles = Math.floor(parteEntera / 1000);
    if (miles === 1) {
      literal += 'MIL ';
    } else {
      literal += convertirGrupo(miles) + ' MIL ';
    }
    parteEntera = parteEntera % 1000;
  }
  
  if (parteEntera > 0) {
    literal += convertirGrupo(parteEntera);
  }

  return `${literal.trim()} ${parteDecimal}/100 BOLIVIANOS`;
};

// Helper para formatear números
const formatNumber = (num) => {
  const n = parseFloat(num) || 0;
  return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper para formatear fecha al formato '23 Mar 2026 hh:mm:ss'
const formatFecha = (fecha) => {
  if (!fecha) return '';
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const d = new Date(fecha);
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const anio = d.getFullYear();
  const horas = String(d.getHours()).padStart(2, '0');
  const minutos = String(d.getMinutes()).padStart(2, '0');
  const segundos = String(d.getSeconds()).padStart(2, '0');
  return `${dia} ${mes} ${anio} ${horas}:${minutos}:${segundos}`;
};

// Helper para construir fila de venta en PDF
const buildVentaRowPdf = (venta, counter, orden) => {
  const row = [];
  
  // Nro
  row.push({ text: String(counter), fontSize: 8 });
  
  // Nro Venta
  row.push({ text: String(venta.nro_venta || ''), fontSize: 8 });
  
  // Usuario (si no está agrupado por usuario)
  if (orden !== 'usuario') {
    const nombreUsuario = venta.usuario?.empleado 
      ? `${venta.usuario.empleado.nombre || ''} ${venta.usuario.empleado.apellido_paterno || ''}`.trim()
      : (venta.usuario?.usuario || 'Sin usuario');
    row.push({ text: nombreUsuario, fontSize: 8 });
  }
  
  // Fecha
  const fecha = formatFecha(venta.fecha_registro);
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
  
  // Tipo de pago
  const tipoPagoText = venta.tipo_pago === 2 ? 'QR' : 'Efectivo';
  row.push({ text: tipoPagoText, fontSize: 8, alignment: 'center' });
  
  // Estado
  const estadoText = venta.estado === 1 ? 'Válido' : venta.estado === 2 ? 'Anulado' : String(venta.estado);
  const estadoColor = venta.estado === 1 ? '#00aa00' : '#aa0000';
  row.push({ text: estadoText, fontSize: 8, alignment: 'center', color: estadoColor });
  
  return row;
};

// Reporte de ventas RESUMIDO con filtros y agrupación
const reporteVentasResumido = async (req, res) => {
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
    
    console.log('Reporte de ventas resumido - parámetros:', req.body);
    
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
    headerRow.push({ text: 'Nro Venta', bold: true, fillColor: '#dff2e6' });
    if (orden !== 'usuario') headerRow.push({ text: 'Usuario', bold: true, fillColor: '#dff2e6' });
    headerRow.push({ text: 'Fecha', bold: true, fillColor: '#dff2e6' });
    if (orden !== 'cliente') headerRow.push({ text: 'Cliente', bold: true, fillColor: '#dff2e6' });
    if (orden !== 'tipo_venta') headerRow.push({ text: 'Tipo', bold: true, fillColor: '#dff2e6' });
    headerRow.push({ text: 'Monto', bold: true, alignment: 'right', fillColor: '#dff2e6' });
    headerRow.push({ text: 'Desc', bold: true, alignment: 'right', fillColor: '#dff2e6' });
    headerRow.push({ text: 'Total', bold: true, alignment: 'right', fillColor: '#dff2e6' });
    headerRow.push({ text: 'Tipo Pago', bold: true, alignment: 'center', fillColor: '#dff2e6' });
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
          // Excluir ventas anuladas
          if (v.estado === 2) continue;
          const montoNum = parseFloat(v.monto_total) || 0;
          const descuentoNum = parseFloat(v.descuento) || 0;
          clienteTotal += (montoNum - descuentoNum);
        }
        
        const totalRow = [];
        for (let i = 0; i < numCols; i++) {
          if (i === numCols - 5) totalRow.push({ text: `Total ${nombreCliente}`, bold: true, fillColor: '#dff2e6' });
          else if (i === numCols - 3) totalRow.push({ text: formatNumber(clienteTotal), alignment: 'right', bold: true, fillColor: '#dff2e6' });
          else totalRow.push({ text: '', fillColor: i === numCols - 5 || i === numCols - 3 ? '#dff2e6' : undefined });
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
          // Excluir ventas anuladas
          if (v.estado === 2) continue;
          const montoNum = parseFloat(v.monto_total) || 0;
          const descuentoNum = parseFloat(v.descuento) || 0;
          usuarioTotal += (montoNum - descuentoNum);
        }
        
        const totalRow = [];
        for (let i = 0; i < numCols; i++) {
          if (i === numCols - 5) totalRow.push({ text: `Total ${nombreUsuario}`, bold: true, fillColor: '#dff2e6' });
          else if (i === numCols - 3) totalRow.push({ text: formatNumber(usuarioTotal), alignment: 'right', bold: true, fillColor: '#dff2e6' });
          else totalRow.push({ text: '', fillColor: i === numCols - 5 || i === numCols - 3 ? '#dff2e6' : undefined });
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
          // Excluir ventas anuladas
          if (v.estado === 2) continue;
          const montoNum = parseFloat(v.monto_total) || 0;
          const descuentoNum = parseFloat(v.descuento) || 0;
          tipoTotal += (montoNum - descuentoNum);
        }
        
        const totalRow = [];
        for (let i = 0; i < numCols; i++) {
          if (i === numCols - 5) totalRow.push({ text: `Total ${nombreTipo}`, bold: true, fillColor: '#dff2e6' });
          else if (i === numCols - 3) totalRow.push({ text: formatNumber(tipoTotal), alignment: 'right', bold: true, fillColor: '#dff2e6' });
          else totalRow.push({ text: '', fillColor: i === numCols - 5 || i === numCols - 3 ? '#dff2e6' : undefined });
        }
        body.push(totalRow);
      }
    }
    
    // Resumen global
    const separatorRow = [];
    for (let i = 0; i < numCols; i++) {
      separatorRow.push({ text: '', border: [false, true, false, false] });
    }
    body.push(separatorRow);
    
    // Calcular totales por método de pago (solo ventas válidas, excluir anuladas)
    let totalEfectivo = 0;
    let totalQR = 0;
    for (const v of ventas) {
      // Excluir ventas anuladas (estado=2)
      if (v.estado === 2) continue;
      
      const montoNum = parseFloat(v.monto_total) || 0;
      const descuentoNum = parseFloat(v.descuento) || 0;
      const totalVenta = montoNum - descuentoNum;
      if (v.tipo_pago === 2) {
        totalQR += totalVenta;
      } else {
        totalEfectivo += totalVenta;
      }
    }
    
    // Total por método de pago - Efectivo
    const totalEfectivoRow = [];
    for (let i = 0; i < numCols; i++) {
      if (i === numCols - 4) totalEfectivoRow.push({ text: 'Total Efectivo', bold: true, fillColor: '#e8f5e9', color: '#388e3c' });
      else if (i === numCols - 3) totalEfectivoRow.push({ text: formatNumber(totalEfectivo), alignment: 'right', bold: true, fillColor: '#e8f5e9', color: '#388e3c' });
      else totalEfectivoRow.push({ text: '', fillColor: i === numCols - 4 || i === numCols - 3 ? '#e8f5e9' : undefined });
    }
    body.push(totalEfectivoRow);
    
    // Total por método de pago - QR
    const totalQRRow = [];
    for (let i = 0; i < numCols; i++) {
      if (i === numCols - 4) totalQRRow.push({ text: 'Total QR', bold: true, fillColor: '#e8f5e9', color: '#1976d2' });
      else if (i === numCols - 3) totalQRRow.push({ text: formatNumber(totalQR), alignment: 'right', bold: true, fillColor: '#e8f5e9', color: '#1976d2' });
      else totalQRRow.push({ text: '', fillColor: i === numCols - 4 || i === numCols - 3 ? '#e8f5e9' : undefined });
    }
    body.push(totalQRRow);
    
    // Línea separadora antes del total general
    const separatorRow2 = [];
    for (let i = 0; i < numCols; i++) {
      separatorRow2.push({ text: '', border: [false, true, false, false] });
    }
    body.push(separatorRow2);
    
    // Total general
    const totalGlobalRow = [];
    for (let i = 0; i < numCols; i++) {
      if (i === numCols - 4) totalGlobalRow.push({ text: 'TOTAL GENERAL', bold: true, fillColor: '#aed6f1' });
      else if (i === numCols - 3) totalGlobalRow.push({ text: formatNumber(totalVentas), alignment: 'right', bold: true, fillColor: '#aed6f1', fontSize: 10 });
      else totalGlobalRow.push({ text: '', fillColor: i === numCols - 4 || i === numCols - 3 ? '#aed6f1' : undefined });
    }
    body.push(totalGlobalRow);
    
    // Configurar anchos de columna para aprovechar todo el ancho de la hoja
    const colWidths = [];
    colWidths.push(25); // Nro
    colWidths.push(45); // Nro Venta
    if (orden !== 'usuario') colWidths.push('*'); // Usuario
    colWidths.push(95); // Fecha
    if (orden !== 'cliente') colWidths.push('*'); // Cliente
    if (orden !== 'tipo_venta') colWidths.push(55); // Tipo
    colWidths.push(70); // Monto
    colWidths.push(50); // Desc
    colWidths.push(70); // Total
    colWidths.push(50); // Tipo Pago
    colWidths.push(50); // Estado
    
    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64('../assets/logo2.jpeg');
    
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
          { text: 'Reporte de ventas - RESUMIDO', style: 'titulo' },
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
      res.setHeader('Content-Disposition', 'inline; filename=ventas_reporte_resumido.pdf');
      res.send(pdfBuffer);
    });
    pdfDoc.end();
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar PDF de ventas resumido');
  }
};

// Reporte de ventas DETALLADO con productos
const reporteVentasDetallado = async (req, res) => {
  try {
    const {
      desde,
      hasta,
      usuario = '',
      id_usuario,
      nombreSistema = 'TarijaSport',
      estado,
      id_cliente,
      tipo_venta
    } = req.body || {};
    
    console.log('Reporte de ventas detallado - parámetros:', req.body);
    
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
    
    // Calcular totales
    let whereTotalVentas;
    if (estado !== undefined && String(estado).trim() !== '') {
      whereTotalVentas = { ...whereClause };
    } else {
      whereTotalVentas = { ...whereClause, estado: 1 };
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
    
    // Obtener ventas con detalles
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
    
    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64('../assets/logo2.jpeg');
    
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
          { text: 'Reporte de ventas - DETALLADO', style: 'titulo' },
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
    
    // Construir contenido con detalles de cada venta
    const content = [];
    
    let counter = 1;
    ventas.forEach((venta) => {
      const detalles = venta.det_ventas || venta.det_venta || [];
      const nombreUsuario = venta.usuario?.empleado 
        ? `${venta.usuario.empleado.nombre || ''} ${venta.usuario.empleado.apellido_paterno || ''}`.trim()
        : (venta.usuario?.usuario || 'Sin usuario');
      const nombreCliente = venta.cliente 
        ? `${venta.cliente.nombre || ''} ${venta.cliente.apellido_paterno || ''}`.trim()
        : 'Sin cliente';
      const fecha = formatFecha(venta.fecha_registro);
      const tipoText = venta.tipo_venta === 2 ? 'Facturado' : 'Normal';
      const tipoPagoText = venta.tipo_pago === 2 ? 'QR' : 'Efectivo';
      const estadoText = venta.estado === 1 ? 'Válido' : venta.estado === 2 ? 'Anulado' : String(venta.estado);
      const estadoColor = venta.estado === 1 ? '#00aa00' : '#aa0000';
      
      // Título de la venta
      content.push({
        text: `Venta #${counter} - Nro: ${venta.nro_venta || venta.id_venta} - ${fecha}`,
        style: 'ventaTitle',
        margin: [0, counter > 1 ? 20 : 0, 0, 5]
      });
      
      // Información de la venta
      content.push({
        columns: [
          {
            width: '*',
            stack: [
              { text: `Cliente: ${nombreCliente}`, fontSize: 9 },
              { text: `Usuario: ${nombreUsuario}`, fontSize: 9 },
              { text: `Tipo: ${tipoText}`, fontSize: 9 }
            ]
          },
          {
            width: '*',
            stack: [
              { text: `Fecha: ${fecha}`, fontSize: 9, alignment: 'right' },
              { text: `Estado: ${estadoText}`, fontSize: 9, alignment: 'right', color: estadoColor },
              { text: `CI/NIT: ${venta.cliente?.ci_nit || 'N/A'}`, fontSize: 9, alignment: 'right' }
            ]
          },
          {
            width: 120,
            stack: [
              { text: `Tipo Pago: ${tipoPagoText}`, fontSize: 9, alignment: 'right', bold: true, color: venta.tipo_pago === 2 ? '#1976d2' : '#388e3c' }
            ]
          }
        ],
        margin: [0, 0, 0, 10]
      });
      
      // Tabla de productos
      const productosBody = [
        [
          { text: 'Producto', bold: true, fontSize: 8, fillColor: '#e3f2fd' },
          { text: 'Código', bold: true, fontSize: 8, fillColor: '#e3f2fd' },
          { text: 'Cant.', bold: true, fontSize: 8, alignment: 'center', fillColor: '#e3f2fd' },
          { text: 'P. Unit.', bold: true, fontSize: 8, alignment: 'right', fillColor: '#e3f2fd' },
          { text: 'Subtotal', bold: true, fontSize: 8, alignment: 'right', fillColor: '#e3f2fd' }
        ]
      ];
      
      detalles.forEach((det) => {
        const productoNombre = det.producto?.nombre || 'N/A';
        const productoCodigo = det.producto?.codigo || 'N/A';
        const cantidad = parseFloat(det.cantidad) || 0;
        const precioUnit = parseFloat(det.precio_unitario) || 0;
        const subtotal = parseFloat(det.sub_total) || (cantidad * precioUnit);
        
        productosBody.push([
          { text: productoNombre, fontSize: 8 },
          { text: productoCodigo, fontSize: 8 },
          { text: cantidad.toString(), fontSize: 8, alignment: 'center' },
          { text: formatNumber(precioUnit), fontSize: 8, alignment: 'right' },
          { text: formatNumber(subtotal), fontSize: 8, alignment: 'right' }
        ]);
      });
      
      // Fila de totales de la venta
      const monto = parseFloat(venta.monto_total) || 0;
      const descuento = parseFloat(venta.descuento) || 0;
      const total = monto - descuento;
      
      productosBody.push([
        { text: '', colSpan: 3, border: [false, false, false, false] },
        {},
        {},
        { text: 'Monto:', bold: true, fontSize: 8, alignment: 'right' },
        { text: formatNumber(monto), fontSize: 8, alignment: 'right' }
      ]);
      
      if (descuento > 0) {
        productosBody.push([
          { text: '', colSpan: 3, border: [false, false, false, false] },
          {},
          {},
          { text: 'Descuento:', bold: true, fontSize: 8, alignment: 'right' },
          { text: formatNumber(descuento), fontSize: 8, alignment: 'right', color: 'red' }
        ]);
      }
      
      productosBody.push([
        { text: '', colSpan: 3, border: [false, false, false, false] },
        {},
        {},
        { text: 'TOTAL:', bold: true, fontSize: 9, alignment: 'right', fillColor: '#e8f5e9' },
        { text: formatNumber(total), bold: true, fontSize: 9, alignment: 'right', fillColor: '#e8f5e9' }
      ]);
      
      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 80, 40, 70, 70],
          body: productosBody
        },
        layout: {
          hLineWidth: function (i, node) { return 0.5; },
          vLineWidth: function (i, node) { return 0.5; },
          hLineColor: function (i, node) { return '#CCCCCC'; },
          vLineColor: function (i, node) { return '#CCCCCC'; }
        }
      });
      
      counter++;
    });
    
    // Resumen general al final
    content.push({ text: '\n', pageBreak: 'before' });
    content.push({
      text: 'RESUMEN GENERAL',
      style: 'titulo',
      alignment: 'center',
      margin: [0, 20, 0, 20]
    });
    
    // Calcular totales por método de pago (solo ventas válidas, excluir anuladas)
    let totalEfectivo = 0;
    let totalQR = 0;
    let cantEfectivo = 0;
    let cantQR = 0;
    let totalVentasValidas = 0;
    
    for (const v of ventas) {
      // Excluir ventas anuladas (estado=2)
      if (v.estado === 2) continue;
      
      totalVentasValidas++;
      const montoNum = parseFloat(v.monto_total) || 0;
      const descuentoNum = parseFloat(v.descuento) || 0;
      const totalVenta = montoNum - descuentoNum;
      if (v.tipo_pago === 2) {
        totalQR += totalVenta;
        cantQR++;
      } else {
        totalEfectivo += totalVenta;
        cantEfectivo++;
      }
    }
    
    content.push({
      table: {
        widths: ['*', 120],
        body: [
          [
            { text: 'Total de Ventas:', bold: true, fontSize: 11 },
            { text: totalVentasValidas.toString(), alignment: 'right', fontSize: 11 }
          ],
          [
            { text: 'Ventas en Efectivo:', fontSize: 10, color: '#388e3c' },
            { text: `${cantEfectivo} (${formatNumber(totalEfectivo)})`, alignment: 'right', fontSize: 10, color: '#388e3c' }
          ],
          [
            { text: 'Ventas con QR:', fontSize: 10, color: '#1976d2' },
            { text: `${cantQR} (${formatNumber(totalQR)})`, alignment: 'right', fontSize: 10, color: '#1976d2' }
          ],
          [
            { text: 'Monto Total:', bold: true, fontSize: 12, fillColor: '#e8f5e9' },
            { text: formatNumber(totalVentas), alignment: 'right', fontSize: 12, bold: true, color: 'blue', fillColor: '#e8f5e9' }
          ]
        ]
      },
      layout: {
        hLineWidth: function (i, node) { return 0.5; },
        vLineWidth: function (i, node) { return 0.5; }
      }
    });
    
    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [36, 110, 36, 54],
      header: { margin: [40, 40, 40, 40], columns: encabezadoCols },
      defaultStyle: { fontSize: 9 },
      content: content,
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Generado: ${new Date().toLocaleString('es-BO')} por: ${usuario || 'desconocido'}`, alignment: 'left', margin: [40, 0, 0, 0] },
          { text: `${nombreSistema || 'TarijaSport'} - Página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 0, 40, 0] }
        ]
      }),
      styles: { 
        titulo: { fontSize: 16, bold: true }, 
        filtro: { fontSize: 8 },
        ventaTitle: { fontSize: 12, bold: true, color: '#1976d2' }
      }
    };
    
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (c) => chunks.push(c));
    pdfDoc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=ventas_reporte_detallado.pdf');
      res.send(pdfBuffer);
    });
    pdfDoc.end();
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar PDF de ventas detallado');
  }
};

module.exports = { ventaNota, reporteVentasResumido, reporteVentasDetallado };