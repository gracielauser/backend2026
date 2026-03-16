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
    const logo = await convertImageToBase64("../assets/logo2.jpeg");

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
    const logo = await convertImageToBase64("../assets/logo2.jpeg");

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // Preparar contenido del PDF
    const content = [];

    // Resumen general - SOLO COMPRAS ACTIVAS (estado = 1)
    const totalCompras = compras.length;
    const comprasActivas = compras.filter(c => c.estado === 1);
    const comprasAnuladas = compras.filter(c => c.estado === 2);
    const montoTotalGeneral = comprasActivas.reduce((sum, c) => sum + (c.monto_total || 0), 0);
    const totalProductosComprados = comprasActivas.reduce((sum, c) => {
      const detalles = c.det_compras || [];
      return sum + detalles.reduce((s, d) => s + (d.cantidad || 0), 0);
    }, 0);

    content.push({
      style: 'resumen',
      table: {
        widths: ['*', 120],
        body: [
          [
            { text: 'RESUMEN - COMPRAS ACTIVAS', bold: true, colSpan: 2, alignment: 'center', fillColor: '#4CAF50', color: 'white', fontSize: 11 },
            {}
          ],
          [
            { text: 'Total de Compras:', bold: true },
            { text: `${comprasActivas.length} de ${totalCompras}`, alignment: 'right' }
          ],
          [
            { text: 'Compras Anuladas:', bold: true },
            { text: comprasAnuladas.length.toString(), alignment: 'right', color: 'red' }
          ],
          [
            { text: 'Monto Total (Activas):', bold: true },
            { text: `$${formatMoney(montoTotalGeneral)}`, alignment: 'right', color: 'blue', bold: true }
          ],
          [
            { text: 'Total Productos Comprados:', bold: true },
            { text: totalProductosComprados.toString(), alignment: 'right' }
          ]
        ]
      },
      layout: {
        hLineWidth: function (i, node) { return 0.5; },
        vLineWidth: function (i, node) { return 0.5; },
        hLineColor: function (i, node) { return '#cccccc'; },
        vLineColor: function (i, node) { return '#cccccc'; }
      },
      margin: [0, 0, 0, 20]
    });

    // Detalles de cada compra con sus productos
    content.push({ text: '\n\nDETALLE DE COMPRAS', style: 'subheader', fontSize: 12, bold: true, margin: [0, 0, 0, 15] });

    compras.forEach((compra, index) => {
      const detalles = compra.det_compras || [];
      const proveedor = compra.proveedor ? safeText(compra.proveedor.nombre) : 'N/A';
      const usuario = compra.usuario ? 
        (compra.usuario.empleado ? 
          `${safeText(compra.usuario.empleado.nombre)} ${safeText(compra.usuario.empleado.ap_paterno)} ${safeText(compra.usuario.empleado.ap_materno)}` : 
          safeText(compra.usuario.usuario)) : 
        "N/A";
      
      const esAnulada = compra.estado === 2;
      const estadoTexto = compra.estado === 1 ? 'ACTIVA' : 'ANULADA';
      const estadoColor = compra.estado === 1 ? '#2196F3' : '#f44336';
      const tituloCompra = `Compra #${safeText(compra.nro_compra) || compra.id_compra} - ${estadoTexto}`;
      
      // Separador entre compras
      if (index > 0) {
        content.push({ 
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], 
          margin: [0, 15, 0, 15] 
        });
      }
      
      content.push({ 
        text: tituloCompra, 
        style: 'compraTitle', 
        margin: [0, 10, 0, 5], 
        color: estadoColor,
        fontSize: 12,
        bold: true
      });
      
      content.push({
        columns: [
          { text: `Proveedor: ${proveedor}`, fontSize: 9, bold: true },
          { text: `Empleado: ${usuario}`, fontSize: 9 },
          { text: `Fecha: ${safeText(compra.fecha_registro).substring(0, 19)}`, fontSize: 9, alignment: 'right' }
        ],
        margin: [0, 0, 0, 10]
      });

      // Subtítulo de productos
      content.push({ 
        text: 'Productos de la compra:', 
        fontSize: 10, 
        bold: true, 
        margin: [0, 5, 0, 5],
        color: '#555555' 
      });

      const detalleBody = [
        [
          { text: "Producto", bold: true, fontSize: 9, color: 'white' },
          { text: "Código", bold: true, fontSize: 9, color: 'white' },
          { text: "Cantidad", bold: true, fontSize: 9, color: 'white' },
          { text: "P. Unitario", bold: true, fontSize: 9, color: 'white' },
          { text: "Subtotal", bold: true, fontSize: 9, color: 'white' }
        ]
      ];

      detalles.forEach((det) => {
        const colorDetalle = esAnulada ? '#999999' : '#333333';
        detalleBody.push([
          { text: det.producto ? safeText(det.producto.nombre) : 'N/A', fontSize: 9, color: colorDetalle },
          { text: det.producto ? safeText(det.producto.codigo) : 'N/A', fontSize: 9, color: colorDetalle },
          { text: det.cantidad || 0, fontSize: 9, alignment: 'center', color: colorDetalle },
          { text: `$${formatMoney(det.precio_unitario)}`, fontSize: 9, alignment: 'right', color: colorDetalle },
          { text: `$${formatMoney(det.sub_total)}`, fontSize: 9, alignment: 'right', color: colorDetalle, bold: true }
        ]);
      });

      detalleBody.push([
        { text: '', colSpan: 4, border: [false, false, false, false] },
        {},
        {},
        {},
        { 
          text: `TOTAL: $${formatMoney(compra.monto_total)}${esAnulada ? ' (ANULADA)' : ''}`, 
          bold: true, 
          fontSize: 10, 
          alignment: 'right', 
          fillColor: esAnulada ? '#ffebee' : '#e3f2fd',
          color: esAnulada ? '#999999' : '#1565C0',
          decoration: esAnulada ? 'lineThrough' : undefined,
          border: [true, true, true, true]
        }
      ]);

      content.push({
        table: {
          headerRows: 1,
          widths: ['*', 70, 50, 70, 70],
          body: detalleBody
        },
        layout: {
          fillColor: function (rowIndex, node, columnIndex) {
            return (rowIndex === 0) ? '#2196F3' : (rowIndex % 2 === 1 && rowIndex !== detalleBody.length - 1 ? '#f9f9f9' : null);
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
        },
        margin: [0, 0, 0, 10]
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
            { text: 'Compras Activas:', bold: true },
            { text: comprasActivas.length.toString(), alignment: 'right', color: 'green' }
          ],
          [
            { text: 'Compras Anuladas:', bold: true },
            { text: comprasAnuladas.length.toString(), alignment: 'right', color: 'red' }
          ],
          [
            { text: 'Monto Total (Solo Activas):', bold: true },
            { text: `$${formatMoney(montoTotalGeneral)}`, alignment: 'right', color: 'blue', bold: true }
          ],
          [
            { text: 'Total Productos Comprados (Activas):', bold: true },
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

// Obtener datos de compras resumido para vista previa (sin generar PDF)
const obtenerDatosComprasResumido = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, id_proveedor } = req.query;

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
          as: 'usuario_registro',
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
      return res.status(404).json({ mensaje: "No se encontraron compras" });
    }

    // Convertir a objetos planos
    const compras = comprasRaw.map(c => c.get ? c.get({ plain: true }) : c);

    // Calcular totales
    const totalCompras = compras.length;
    const montoTotalGeneral = compras.reduce((sum, c) => sum + (c.monto_total || 0), 0);
    const totalProductosComprados = compras.reduce((sum, c) => {
      const detalles = c.det_compras || [];
      return sum + detalles.reduce((s, d) => s + (d.cantidad || 0), 0);
    }, 0);

    // Procesar datos de compras
    const comprasProcesadas = compras.map((compra) => {
      const proveedor = compra.proveedor ? {
        id_proveedor: compra.proveedor.id_proveedor,
        nombre: compra.proveedor.nombre,
        ciudad: compra.proveedor.ciudad || '',
        celular: compra.proveedor.celular || '',
        email: compra.proveedor.email || ''
      } : null;

      const usuario = compra.usuario_registro ? {
        id_usuario: compra.usuario_registro.id_usuario,
        nombre_usuario: compra.usuario_registro.usuario,
        nombre_completo: compra.usuario_registro.empleado ? 
          `${compra.usuario_registro.empleado.nombre} ${compra.usuario_registro.empleado.ap_paterno} ${compra.usuario_registro.empleado.ap_materno}` : 
          compra.usuario_registro.usuario
      } : null;
      
      const detalles = compra.det_compras || [];
      const cantidadProductos = detalles.length;
      const totalCantidad = detalles.reduce((sum, d) => sum + (d.cantidad || 0), 0);

      return {
        id_compra: compra.id_compra,
        nro_compra: compra.nro_compra || compra.id_compra,
        fecha_registro: compra.fecha_registro,
        proveedor: proveedor,
        usuario: usuario,
        cantidad_productos: cantidadProductos,
        total_cantidad: totalCantidad,
        monto_total: parseFloat((compra.monto_total || 0).toFixed(2)),
        estado: compra.estado === 1 ? 'Activa' : 'Anulada',
        estado_valor: compra.estado
      };
    });

    // Construir respuesta
    const respuesta = {
      fecha_generacion: new Date().toLocaleString('es-ES'),
      filtros: {
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
        id_proveedor: id_proveedor || null
      },
      totales: {
        total_compras: totalCompras,
        monto_total_general: parseFloat(montoTotalGeneral.toFixed(2)),
        total_productos_comprados: totalProductosComprados
      },
      compras: comprasProcesadas
    };

    return res.status(200).json(respuesta);

  } catch (error) {
    console.error("Error en obtenerDatosComprasResumido:", error);
    return res.status(500).json({ 
      mensaje: "Error al obtener los datos de compras", 
      error: error.message 
    });
  }
};

// Obtener datos de compras detallado para vista previa (sin generar PDF)
const obtenerDatosComprasDetallado = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, id_proveedor } = req.query;

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
          as: 'usuario_registro',
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
      return res.status(404).json({ mensaje: "No se encontraron compras" });
    }

    // Convertir a objetos planos
    const compras = comprasRaw.map(c => c.get ? c.get({ plain: true }) : c);

    // Calcular totales - SOLO COMPRAS ACTIVAS (estado = 1)
    const totalCompras = compras.length;
    const comprasActivas = compras.filter(c => c.estado === 1);
    const comprasAnuladas = compras.filter(c => c.estado === 2);
    const montoTotalGeneral = comprasActivas.reduce((sum, c) => sum + (c.monto_total || 0), 0);
    const totalProductosComprados = comprasActivas.reduce((sum, c) => {
      const detalles = c.det_compras || [];
      return sum + detalles.reduce((s, d) => s + (d.cantidad || 0), 0);
    }, 0);

    // Procesar datos de compras con detalles
    const comprasProcesadas = compras.map((compra) => {
      const proveedor = compra.proveedor ? {
        id_proveedor: compra.proveedor.id_proveedor,
        nombre: compra.proveedor.nombre,
        ciudad: compra.proveedor.ciudad || '',
        celular: compra.proveedor.celular || '',
        email: compra.proveedor.email || ''
      } : null;

      const usuario = compra.usuario_registro ? {
        id_usuario: compra.usuario_registro.id_usuario,
        nombre_usuario: compra.usuario_registro.usuario,
        nombre_completo: compra.usuario_registro.empleado ? 
          `${compra.usuario_registro.empleado.nombre} ${compra.usuario_registro.empleado.ap_paterno} ${compra.usuario_registro.empleado.ap_materno}` : 
          compra.usuario_registro.usuario
      } : null;
      
      const detalles = compra.det_compras || [];
      const detallesProcesados = detalles.map((det) => ({
        id_detcompra: det.id_detcompra,
        producto: det.producto ? {
          id_producto: det.producto.id_producto,
          nombre: det.producto.nombre,
          codigo: det.producto.codigo
        } : null,
        cantidad: det.cantidad || 0,
        precio_unitario: parseFloat((det.precio_unitario || 0).toFixed(2)),
        sub_total: parseFloat((det.sub_total || 0).toFixed(2))
      }));

      const esActiva = compra.estado === 1;

      return {
        id_compra: compra.id_compra,
        nro_compra: compra.nro_compra || compra.id_compra,
        fecha_registro: compra.fecha_registro,
        proveedor: proveedor,
        usuario: usuario,
        monto_total: parseFloat((compra.monto_total || 0).toFixed(2)),
        estado: compra.estado === 1 ? 'Activa' : 'Anulada',
        estado_valor: compra.estado,
        detalles: detallesProcesados,
        incluida_en_totales: esActiva
      };
    });

    // Construir respuesta
    const respuesta = {
      fecha_generacion: new Date().toLocaleString('es-ES'),
      filtros: {
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
        id_proveedor: id_proveedor || null
      },
      totales: {
        total_compras: totalCompras,
        compras_activas: comprasActivas.length,
        compras_anuladas: comprasAnuladas.length,
        monto_total_general: parseFloat(montoTotalGeneral.toFixed(2)),
        total_productos_comprados: totalProductosComprados
      },
      nota: "Los totales (monto_total_general y total_productos_comprados) solo incluyen compras con estado=1 (Activas). Las compras anuladas se muestran pero no se suman.",
      compras: comprasProcesadas
    };

    return res.status(200).json(respuesta);

  } catch (error) {
    console.error("Error en obtenerDatosComprasDetallado:", error);
    return res.status(500).json({ 
      mensaje: "Error al obtener los datos de compras detalladas", 
      error: error.message 
    });
  }
};

module.exports = {
  reporteComprasResumido,
  reporteComprasDetallado,
  obtenerDatosComprasResumido,
  obtenerDatosComprasDetallado
};
