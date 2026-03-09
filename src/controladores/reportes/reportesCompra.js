const { db } = require("../../config/dataBase");
const PdfPrinter = require("pdfmake");
const fonts = require("../../utils/pdfFonts");
const convertImageToBase64 = require("../../utils/imageToBase64");
const { Op, Sequelize, literal } = require("sequelize");

const reporteComprasResumido = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, id_proveedor } = req.body;

    // Construir filtros
    let whereClause = {};
    
    if (fecha_inicio && fecha_fin) {
      whereClause.fecha_registro = {
        [Op.between]: [fecha_inicio, fecha_fin]
      };
    }
    
    if (id_proveedor) {
      whereClause.id_proveedor = id_proveedor;
    }

    // Obtener compras con sus relaciones
    const comprasRaw = await db.compra.findAll({
      where: whereClause,
      include: [
        { 
          model: db.proveedor, 
          attributes: ['id_proveedor', 'nombre', 'ciudad', 'celular', 'email'] 
        },
        { 
          model: db.usuario, 
          attributes: ['id_usuario', 'usuario'],
          include: [
            {
              model: db.empleado,
              attributes: ['nombre', 'ap_paterno','ap_materno']
            }
          ]
        },
        { 
          model: db.det_compra,
          attributes: ['id_detcompra', 'cantidad', 'sub_total']
        }
      ],
      order: [['fecha_registro', 'DESC']]
    });

    if (!comprasRaw || comprasRaw.length === 0) {
      return res.status(404).send("No se encontraron compras");
    }

    // Convertir a objetos planos
    const compras = comprasRaw.map(c => c.get ? c.get({ plain: true }) : c);

    // Helper para texto seguro
    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        return v.nombre || v.NOMBRE || v.usuario || v.id || JSON.stringify(v);
      }
      return String(v);
    };

    const printer = new PdfPrinter(fonts);
    const logo = await convertImageToBase64("../assets/logo.png");

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // Preparar contenido del PDF
    const content = [];

    // Tabla de compras
    const tableBody = [
      [
        { text: "N° Compra", bold: true, fontSize: 9 },
        { text: "Fecha", bold: true, fontSize: 9 },
        { text: "Proveedor", bold: true, fontSize: 9 },
        { text: "Empleado", bold: true, fontSize: 9 },
        { text: "Productos", bold: true, fontSize: 9 },
        { text: "Monto Total", bold: true, fontSize: 9 },
        { text: "Estado", bold: true, fontSize: 9 }
      ]
    ];

    compras.forEach((compra) => {
      const proveedor = compra.proveedor ? safeText(compra.proveedor.nombre) : "N/A";
      const usuario = compra.usuario ? 
        (compra.usuario.empleado ? 
          `${safeText(compra.usuario.empleado.nombre)} ${safeText(compra.usuario.empleado.ap_paterno)} ${safeText(compra.usuario.empleado.ap_materno)}` : 
          safeText(compra.usuario.usuario)) : 
        "N/A";
      
      const detalles = compra.det_compras || [];
      const cantidadProductos = detalles.length;

      tableBody.push([
        { text: safeText(compra.nro_compra) || compra.id_compra, fontSize: 8 },
        { text: safeText(compra.fecha_registro).substring(0, 19), fontSize: 8 },
        { text: proveedor, fontSize: 8 },
        { text: usuario, fontSize: 8 },
        { text: cantidadProductos.toString(), fontSize: 8, alignment: 'center' },
        { text: `$${formatMoney(compra.monto_total)}`, fontSize: 8, alignment: 'right' },
        { text: compra.estado === 1 ? "Activa" : "Anulada", fontSize: 8, alignment: 'center' }
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        widths: [60, 60, '*', '*', 50, 70, 50],
        body: tableBody
      },
      layout: {
        fillColor: function (rowIndex, node, columnIndex) {
          return (rowIndex === 0) ? '#4CAF50' : (rowIndex % 2 === 0 ? '#f3f3f3' : null);
        },
        hLineWidth: function (i, node) {
          return 0.5;
        },
        vLineWidth: function (i, node) {
          return 0.5;
        },
        hLineColor: function (i, node) {
          return '#cccccc';
        },
        vLineColor: function (i, node) {
          return '#cccccc';
        }
      }
    });

    // Resumen general
    const totalCompras = compras.length;
    const montoTotalGeneral = compras.reduce((sum, c) => sum + (c.monto_total || 0), 0);
    const totalProductosComprados = compras.reduce((sum, c) => {
      const detalles = c.det_compras || [];
      return sum + detalles.reduce((s, d) => s + (d.cantidad || 0), 0);
    }, 0);

    content.push({ text: '\n' });
    content.push({
      style: 'resumen',
      table: {
        widths: ['*', 120],
        body: [
          [
            { text: 'RESUMEN GENERAL', bold: true, fontSize: 12, colSpan: 2, alignment: 'center', fillColor: '#4CAF50', color: 'white' },
            {}
          ],
          [
            { text: 'Total de Compras:', bold: true },
            { text: totalCompras.toString(), alignment: 'right' }
          ],
          [
            { text: 'Monto Total General:', bold: true },
            { text: `$${formatMoney(montoTotalGeneral)}`, alignment: 'right', color: 'blue', bold: true }
          ],
          [
            { text: 'Total Productos Comprados:', bold: true },
            { text: totalProductosComprados.toString(), alignment: 'right' }
          ]
        ]
      },
      layout: {
        hLineWidth: function (i, node) {
          return 0.5;
        },
        vLineWidth: function (i, node) {
          return 0.5;
        }
      },
      margin: [0, 10, 0, 0]
    });

    // Estructura del PDF
    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 80, 20, 60],
      header: function(currentPage, pageCount) {
        return {
          margin: [20, 20, 20, 10],
          columns: [
            {
              image: logo,
              width: 50,
              height: 50
            },
            {
              width: '*',
              stack: [
                { text: 'REPORTE DE COMPRAS - RESUMIDO', style: 'header', alignment: 'center' },
                { text: `Fecha: ${new Date().toLocaleDateString('es-ES')}`, style: 'subheader', alignment: 'center' },
                { 
                  text: fecha_inicio && fecha_fin ? 
                    `Periodo: ${fecha_inicio} - ${fecha_fin}` : 
                    'Todas las compras', 
                  style: 'subheader', 
                  alignment: 'center' 
                }
              ]
            }
          ]
        };
      },
      footer: function(currentPage, pageCount) {
        return {
          margin: [20, 10],
          columns: [
            { text: `Generado: ${new Date().toLocaleString('es-ES')}`, fontSize: 8, alignment: 'left' },
            { text: `Página ${currentPage} de ${pageCount}`, fontSize: 8, alignment: 'right' }
          ]
        };
      },
      content: content,
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          margin: [0, 5, 0, 5]
        },
        subheader: {
          fontSize: 10,
          margin: [0, 2, 0, 2]
        },
        resumen: {
          fontSize: 11,
          margin: [0, 0, 0, 10]
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=reporte_compras_resumido_${Date.now()}.pdf`);
    
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error("Error en reporteComprasResumido:", error);
    res.status(500).send("Error al generar el reporte: " + error.message);
  }
};

const reporteComprasDetallado = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, id_proveedor } = req.body;

    // Construir filtros
    let whereClause = {};
    
    if (fecha_inicio && fecha_fin) {
      whereClause.fecha_registro = {
        [Op.between]: [fecha_inicio, fecha_fin]
      };
    }
    
    if (id_proveedor) {
      whereClause.id_proveedor = id_proveedor;
    }

    // Obtener compras con sus relaciones
    const comprasRaw = await db.compra.findAll({
      where: whereClause,
      include: [
        { 
          model: db.proveedor, 
          attributes: ['id_proveedor', 'nombre', 'ciudad', 'celular', 'email'] 
        },
        { 
          model: db.usuario, 
          attributes: ['id_usuario', 'usuario'],
          include: [
            {
              model: db.empleado,
              attributes: ['nombre', 'ap_paterno','ap_materno']
            }
          ]
        },
        { 
          model: db.det_compra,
          include: [
            { 
              model: db.producto,
              attributes: ['id_producto', 'nombre', 'codigo']
            }
          ]
        }
      ],
      order: [['fecha_registro', 'DESC']]
    });

    if (!comprasRaw || comprasRaw.length === 0) {
      return res.status(404).send("No se encontraron compras");
    }

    // Convertir a objetos planos
    const compras = comprasRaw.map(c => c.get ? c.get({ plain: true }) : c);

    // Helper para texto seguro
    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        return v.nombre || v.NOMBRE || v.usuario || v.id || JSON.stringify(v);
      }
      return String(v);
    };

    const printer = new PdfPrinter(fonts);
    const logo = await convertImageToBase64("../assets/logo.png");

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // Preparar contenido del PDF
    const content = [];

    // Resumen general
    const totalCompras = compras.length;
    const montoTotalGeneral = compras.reduce((sum, c) => sum + (c.monto_total || 0), 0);
    const totalProductosComprados = compras.reduce((sum, c) => {
      const detalles = c.det_compras || [];
      return sum + detalles.reduce((s, d) => s + (d.cantidad || 0), 0);
    }, 0);

    content.push({
      style: 'resumen',
      table: {
        widths: ['*', 120],
        body: [
          [
            { text: 'Total de Compras:', bold: true },
            { text: totalCompras.toString(), alignment: 'right' }
          ],
          [
            { text: 'Monto Total General:', bold: true },
            { text: `$${formatMoney(montoTotalGeneral)}`, alignment: 'right', color: 'blue' }
          ],
          [
            { text: 'Total Productos Comprados:', bold: true },
            { text: totalProductosComprados.toString(), alignment: 'right' }
          ]
        ]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 20]
    });

    // Tabla de compras
    const tableBody = [
      [
        { text: "N° Compra", bold: true, fontSize: 9 },
        { text: "Fecha", bold: true, fontSize: 9 },
        { text: "Proveedor", bold: true, fontSize: 9 },
        { text: "Empleado", bold: true, fontSize: 9 },
        { text: "Productos", bold: true, fontSize: 9 },
        { text: "Monto Total", bold: true, fontSize: 9 },
        { text: "Estado", bold: true, fontSize: 9 }
      ]
    ];

    compras.forEach((compra) => {
      const proveedor = compra.proveedor ? safeText(compra.proveedor.nombre) : "N/A";
      const usuario = compra.usuario ? 
        (compra.usuario.empleado ? 
          `${safeText(compra.usuario.empleado.nombre)} ${safeText(compra.usuario.empleado.ap_paterno)} ${safeText(compra.usuario.empleado.ap_materno)}` : 
          safeText(compra.usuario.usuario)) : 
        "N/A";
      
      const detalles = compra.det_compras || [];
      const cantidadProductos = detalles.length;

      tableBody.push([
        { text: safeText(compra.nro_compra) || compra.id_compra, fontSize: 8 },
        { text: safeText(compra.fecha_registro).substring(0, 19), fontSize: 8 },
        { text: proveedor, fontSize: 8 },
        { text: usuario, fontSize: 8 },
        { text: cantidadProductos.toString(), fontSize: 8, alignment: 'center' },
        { text: `$${formatMoney(compra.monto_total)}`, fontSize: 8, alignment: 'right' },
        { text: compra.estado === 1 ? "Activa" : "Anulada", fontSize: 8, alignment: 'center' }
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        widths: [60, 60, '*', '*', 50, 70, 50],
        body: tableBody
      },
      layout: {
        fillColor: function (rowIndex, node, columnIndex) {
          return (rowIndex === 0) ? '#4CAF50' : (rowIndex % 2 === 0 ? '#f3f3f3' : null);
        },
        hLineWidth: function (i, node) {
          return 0.5;
        },
        vLineWidth: function (i, node) {
          return 0.5;
        },
        hLineColor: function (i, node) {
          return '#cccccc';
        },
        vLineColor: function (i, node) {
          return '#cccccc';
        }
      }
    });

    // Detalles de cada compra
    content.push({ text: '\n\nDETALLE DE COMPRAS', style: 'subheader', pageBreak: 'before' });

    compras.forEach((compra, index) => {
      const detalles = compra.det_compras || [];
      const proveedor = compra.proveedor ? safeText(compra.proveedor.nombre) : 'N/A';
      const usuario = compra.usuario ? 
        (compra.usuario.empleado ? 
          `${safeText(compra.usuario.empleado.nombre)} ${safeText(compra.usuario.empleado.ap_paterno)}` : 
          safeText(compra.usuario.usuario)) : 
        "N/A";
      
      content.push({ text: `Compra #${safeText(compra.nro_compra) || compra.id_compra}`, style: 'compraTitle', margin: [0, 10, 0, 5] });
      
      content.push({
        columns: [
          { text: `Proveedor: ${proveedor}`, fontSize: 9 },
          { text: `Empleado: ${usuario}`, fontSize: 9 },
          { text: `Fecha: ${safeText(compra.fecha_registro).substring(0, 19)}`, fontSize: 9, alignment: 'right' }
        ],
        margin: [0, 0, 0, 10]
      });

      const detalleBody = [
        [
          { text: "Producto", bold: true, fontSize: 8 },
          { text: "Código", bold: true, fontSize: 8 },
          { text: "Cantidad", bold: true, fontSize: 8 },
          { text: "P. Unitario", bold: true, fontSize: 8 },
          { text: "Subtotal", bold: true, fontSize: 8 }
        ]
      ];

      detalles.forEach((det) => {
        detalleBody.push([
          { text: det.producto ? safeText(det.producto.nombre) : 'N/A', fontSize: 8 },
          { text: det.producto ? safeText(det.producto.codigo) : 'N/A', fontSize: 8 },
          { text: det.cantidad || 0, fontSize: 8, alignment: 'center' },
          { text: `$${formatMoney(det.precio_unitario)}`, fontSize: 8, alignment: 'right' },
          { text: `$${formatMoney(det.sub_total)}`, fontSize: 8, alignment: 'right' }
        ]);
      });

      detalleBody.push([
        { text: '', colSpan: 4, border: [false, false, false, false] },
        {},
        {},
        {},
        { text: `Total: $${formatMoney(compra.monto_total)}`, bold: true, fontSize: 9, alignment: 'right', fillColor: '#e3f2fd' }
      ]);

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 60, 50, 60, 60],
          body: detalleBody
        },
        layout: {
          fillColor: function (rowIndex, node, columnIndex) {
            return (rowIndex === 0) ? '#2196F3' : null;
          }
        },
        margin: [0, 0, 0, 15]
      });
    });

    // Resumen general
    content.push({ text: '\n', pageBreak: 'before' });
    content.push({
      style: 'resumen',
      table: {
        widths: ['*', 120],
        body: [
          [
            { text: 'RESUMEN GENERAL', bold: true, fontSize: 12, colSpan: 2, alignment: 'center', fillColor: '#4CAF50', color: 'white' },
            {}
          ],
          [
            { text: 'Total de Compras:', bold: true },
            { text: totalCompras.toString(), alignment: 'right' }
          ],
          [
            { text: 'Monto Total General:', bold: true },
            { text: `$${formatMoney(montoTotalGeneral)}`, alignment: 'right', color: 'blue', bold: true }
          ],
          [
            { text: 'Total Productos Comprados:', bold: true },
            { text: totalProductosComprados.toString(), alignment: 'right' }
          ]
        ]
      },
      layout: {
        hLineWidth: function (i, node) {
          return 0.5;
        },
        vLineWidth: function (i, node) {
          return 0.5;
        }
      },
      margin: [0, 10, 0, 0]
    });

    // Estructura del PDF
    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 80, 20, 60],
      header: function(currentPage, pageCount) {
        return {
          margin: [20, 20, 20, 10],
          columns: [
            {
              image: logo,
              width: 50,
              height: 50
            },
            {
              width: '*',
              stack: [
                { text: 'REPORTE DE COMPRAS - DETALLADO', style: 'header', alignment: 'center' },
                { text: `Fecha: ${new Date().toLocaleDateString('es-ES')}`, style: 'subheader', alignment: 'center' },
                { 
                  text: fecha_inicio && fecha_fin ? 
                    `Periodo: ${fecha_inicio} - ${fecha_fin}` : 
                    'Todas las compras', 
                  style: 'subheader', 
                  alignment: 'center' 
                }
              ]
            }
          ]
        };
      },
      footer: function(currentPage, pageCount) {
        return {
          margin: [20, 10],
          columns: [
            { text: `Generado: ${new Date().toLocaleString('es-ES')}`, fontSize: 8, alignment: 'left' },
            { text: `Página ${currentPage} de ${pageCount}`, fontSize: 8, alignment: 'right' }
          ]
        };
      },
      content: content,
      styles: {
        header: {
          fontSize: 16,
          bold: true,
          margin: [0, 5, 0, 5]
        },
        subheader: {
          fontSize: 10,
          margin: [0, 2, 0, 2]
        },
        resumen: {
          fontSize: 11,
          margin: [0, 0, 0, 10]
        },
        compraTitle: {
          fontSize: 11,
          bold: true,
          color: '#2196F3'
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=reporte_compras_detallado_${Date.now()}.pdf`);
    
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error("Error en reporteComprasDetallado:", error);
    res.status(500).send("Error al generar el reporte: " + error.message);
  }
};

module.exports = {
  reporteComprasResumido,
  reporteComprasDetallado
};
