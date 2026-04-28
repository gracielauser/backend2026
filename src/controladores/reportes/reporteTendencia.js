const { db } = require("../../config/dataBase");
const { Sequelize, Op } = require("sequelize");
const PdfPrinter = require("pdfmake");
const fonts = require("../../utils/pdfFonts");
const convertImageToBase64 = require("../../utils/imageToBase64");

const obtenerDatosTendencia = async (req, res) => {
  try {
    const { nombre_codigo, id_categoria, id_marca, desde, hasta, tipo_venta, orden } = req.body || {};
    
    console.log('Body de reporteTendencia:', req.body);
    
    // Construir filtros para producto
    const whereProducto = {};
    
    if (id_categoria && String(id_categoria).trim() !== '') {
      whereProducto.id_categoria = parseInt(id_categoria);
    }
    
    if (id_marca && String(id_marca).trim() !== '') {
      whereProducto.id_marca = parseInt(id_marca);
    }
    
    if (nombre_codigo && String(nombre_codigo).trim() !== '') {
      const busqueda = String(nombre_codigo).trim();
      whereProducto[Op.or] = [
        { nombre: { [Op.iLike]: `%${busqueda}%` } },
        { codigo: { [Op.iLike]: `%${busqueda}%` } }
      ];
    }
    
    // Construir filtros para venta (fecha_registro y tipo_venta)
    const desdeVal = desde && String(desde).trim() !== '' ? String(desde).trim() : null;
    const hastaVal = hasta && String(hasta).trim() !== '' ? String(hasta).trim() : null;
    
    const whereVenta = {
      estado: 1,
      [Op.and]: [
        ...(desdeVal ? [Sequelize.literal(`SUBSTRING(CAST("ventum"."fecha_registro" AS TEXT), 1, 10) >= '${desdeVal}'`)] : []),
        ...(hastaVal ? [Sequelize.literal(`SUBSTRING(CAST("ventum"."fecha_registro" AS TEXT), 1, 10) <= '${hastaVal}'`)] : [])
      ]
    };
    
    // Filtro de tipo_venta (1=normal, 2=facturado, 0 o null=todos)
    if (tipo_venta && parseInt(tipo_venta) !== 0) {
      whereVenta.tipo_venta = parseInt(tipo_venta);
    }
    
    // Realizar la consulta agrupada por producto
    const resultados = await db.det_venta.findAll({
      attributes: [
        'id_producto',
        [Sequelize.fn('SUM', Sequelize.col('det_venta.cantidad')), 'total_vendido'],
        [Sequelize.fn('SUM', Sequelize.col('det_venta.sub_total')), 'total_ingresos'],
        [Sequelize.fn('SUM',
          Sequelize.literal(`
            CASE 
              WHEN "ventum"."tipo_venta" = 2 
              THEN (
                (("det_venta"."sub_total" - ("det_venta"."precio_compra" * "det_venta"."cantidad"))
                  * ((("ventum"."monto_total" - "ventum"."descuento")::numeric / "ventum"."monto_total"))
                )
                - ((("ventum"."monto_total" - "ventum"."descuento") * 0.13) * ("det_venta"."sub_total" / "ventum"."monto_total"))
              )
              ELSE (
                ("det_venta"."sub_total" - ("det_venta"."precio_compra" * "det_venta"."cantidad"))
                  * ((("ventum"."monto_total" - "ventum"."descuento")::numeric / "ventum"."monto_total"))
              )
            END
          `)
        ), 'ganancia_neta']
      ],
      include: [
        {
          model: db.venta,
          attributes: [],
          where: whereVenta,
          required: true
        },
        {
          model: db.producto,
          attributes: ['codigo', 'nombre', 'precio_compra', 'precio_venta', 'stock', 'estado'],
          where: whereProducto,
          required: true,
          include: [
            {
              model: db.categoria,
              attributes: ['nombre'],
              required: false
            },
            {
              model: db.marca,
              attributes: ['nombre'],
              required: false
            }
          ]
        }
      ],
      group: [
        'det_venta.id_producto', 
        'producto.id_producto', 
        'producto.codigo', 
        'producto.nombre',
        'producto.estado', 
        'producto.precio_compra', 
        'producto.precio_venta', 
        'producto.stock', 
        'producto->categorium.id_categoria', 
        'producto->categorium.nombre',
        'producto->marca.id_marca', 
        'producto->marca.nombre'
      ],
      order: [[Sequelize.literal('ganancia_neta'), 'DESC']],
      raw: true,
      nest: true
    });

    // Ordenar según el parámetro orden
    if (orden === 'vendido') {
      resultados.sort((a, b) => parseFloat(b.total_vendido) - parseFloat(a.total_vendido));
    } else if (orden === 'ingreso') {
      resultados.sort((a, b) => parseFloat(b.total_ingresos) - parseFloat(a.total_ingresos));
    } else if (orden === 'ganancia') {
      resultados.sort((a, b) => parseFloat(b.ganancia_neta) - parseFloat(a.ganancia_neta));
    }

    return res.status(200).json(resultados);

  } catch (error) {
    console.log('Error en obtenerDatosTendencia:', error);
    return res.status(500).json({ 
      mensaje: 'Error al obtener datos de tendencia', 
      error: error.message 
    });
  }
};

const tendenciaPDF = async (req, res) => {
  try {
    const { nombre_codigo, id_categoria, id_marca, desde, hasta, tipo_venta, orden, usuario, nombreSistema } = req.body || {};
    
    console.log('Body de tendenciaPDF:', req.body);
    
    // Construir filtros para producto
    const whereProducto = {};
    
    if (id_categoria && String(id_categoria).trim() !== '') {
      whereProducto.id_categoria = parseInt(id_categoria);
    }
    
    if (id_marca && String(id_marca).trim() !== '') {
      whereProducto.id_marca = parseInt(id_marca);
    }
    
    if (nombre_codigo && String(nombre_codigo).trim() !== '') {
      const busqueda = String(nombre_codigo).trim();
      whereProducto[Op.or] = [
        { nombre: { [Op.iLike]: `%${busqueda}%` } },
        { codigo: { [Op.iLike]: `%${busqueda}%` } }
      ];
    }
    
    // Construir filtros para venta (fecha_registro y tipo_venta)
    const desdeVal = desde && String(desde).trim() !== '' ? String(desde).trim() : null;
    const hastaVal = hasta && String(hasta).trim() !== '' ? String(hasta).trim() : null;
    
    const whereVenta = {
      estado: 1,
      [Op.and]: [
        ...(desdeVal ? [Sequelize.literal(`SUBSTRING(CAST("ventum"."fecha_registro" AS TEXT), 1, 10) >= '${desdeVal}'`)] : []),
        ...(hastaVal ? [Sequelize.literal(`SUBSTRING(CAST("ventum"."fecha_registro" AS TEXT), 1, 10) <= '${hastaVal}'`)] : [])
      ]
    };
    
    // Filtro de tipo_venta (1=normal, 2=facturado, 0 o null=todos)
    if (tipo_venta && parseInt(tipo_venta) !== 0) {
      whereVenta.tipo_venta = parseInt(tipo_venta);
    }
    
    // Realizar la consulta agrupada por producto
    const resultados = await db.det_venta.findAll({
      attributes: [
        'id_producto',
        [Sequelize.fn('SUM', Sequelize.col('det_venta.cantidad')), 'total_vendido'],
        [Sequelize.fn('SUM', Sequelize.col('det_venta.sub_total')), 'total_ingresos'],
        [Sequelize.fn('SUM',
          Sequelize.literal(`
            CASE 
              WHEN "ventum"."tipo_venta" = 2 
              THEN (
                (("det_venta"."sub_total" - ("det_venta"."precio_compra" * "det_venta"."cantidad"))
                  * ((("ventum"."monto_total" - "ventum"."descuento")::numeric / "ventum"."monto_total"))
                )
                - ((("ventum"."monto_total" - "ventum"."descuento") * 0.13) * ("det_venta"."sub_total" / "ventum"."monto_total"))
              )
              ELSE (
                ("det_venta"."sub_total" - ("det_venta"."precio_compra" * "det_venta"."cantidad"))
                  * ((("ventum"."monto_total" - "ventum"."descuento")::numeric / "ventum"."monto_total"))
              )
            END
          `)
        ), 'ganancia_neta']
      ],
      include: [
        {
          model: db.venta,
          attributes: [],
          where: whereVenta,
          required: true
        },
        {
          model: db.producto,
          attributes: ['codigo', 'nombre', 'precio_compra', 'precio_venta', 'stock', 'estado'],
          where: whereProducto,
          required: true,
          include: [
            {
              model: db.categoria,
              attributes: ['nombre'],
              required: false
            },
            {
              model: db.marca,
              attributes: ['nombre'],
              required: false
            }
          ]
        }
      ],
      group: [
        'det_venta.id_producto', 
        'producto.id_producto', 
        'producto.codigo', 
        'producto.nombre',
        'producto.estado', 
        'producto.precio_compra', 
        'producto.precio_venta', 
        'producto.stock', 
        'producto->categorium.id_categoria', 
        'producto->categorium.nombre',
        'producto->marca.id_marca', 
        'producto->marca.nombre'
      ],
      order: [[Sequelize.literal('ganancia_neta'), 'DESC']],
      raw: true,
      nest: true
    });

    if (!resultados || resultados.length === 0) {
      return res.status(404).send("No se encontraron datos para generar el reporte");
    }

    // Ordenar según el parámetro orden
    if (orden === 'vendido') {
      resultados.sort((a, b) => parseFloat(b.total_vendido) - parseFloat(a.total_vendido));
    } else if (orden === 'ingreso') {
      resultados.sort((a, b) => parseFloat(b.total_ingresos) - parseFloat(a.total_ingresos));
    } else if (orden === 'ganancia') {
      resultados.sort((a, b) => parseFloat(b.ganancia_neta) - parseFloat(a.ganancia_neta));
    }

    // Helper para formatear números
    const formatNumber = (num) => {
      const n = parseFloat(num) || 0;
      return n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      return String(v);
    };

    const printer = new PdfPrinter(fonts);
    const logo = await convertImageToBase64("../assets/logo2.jpeg");

    // Construir líneas de filtros para la cabecera
    const filtroLines = [];
    
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    
    if (tipo_venta && parseInt(tipo_venta) !== 0) {
      const tipoVentaTexto = parseInt(tipo_venta) === 1 ? 'Normal' : 'Facturado';
      filtroLines.push(`Tipo de Venta: ${tipoVentaTexto}`);
    }
    
    if (id_categoria) {
      const cat = await db.categoria.findByPk(id_categoria, { attributes: ['nombre'] });
      if (cat) filtroLines.push(`Categoría: ${cat.nombre}`);
    }
    
    if (id_marca) {
      const marc = await db.marca.findByPk(id_marca, { attributes: ['nombre'] });
      if (marc) filtroLines.push(`Marca: ${marc.nombre}`);
    }
    
    if (nombre_codigo) filtroLines.push(`Búsqueda: ${nombre_codigo}`);
    
    if (orden) {
      const ordenTexto = orden === 'vendido' ? 'Más Vendido' : orden === 'ingreso' ? 'Mayor Ingreso' : 'Mayor Ganancia';
      filtroLines.push(`Ordenado por: ${ordenTexto}`);
    }
    
    if (!filtroLines.length) filtroLines.push('Sin filtros aplicados');

    // Preparar tabla
    const tableBody = [];
    
    // Header
    const headerRow = [
      { text: 'Nro', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Código', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Producto', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Categoría', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Marca', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Cant. Vendida', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'center' },
      { text: 'Stock Actual', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'center' },
      { text: 'Total Ingresos', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'right' },
      { text: 'Ganancia Neta', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'right' }
    ];
    tableBody.push(headerRow);

    let totalGananciaNeta = 0;
    let totalIngresos = 0;
    let totalCantidadVendida = 0;
    let totalStockActual = 0;

    // Datos
    resultados.forEach((item, index) => {
      const ganancia_neta = parseFloat(item.ganancia_neta) || 0;
      const total_ingresos = parseFloat(item.total_ingresos) || 0;
      const stock = parseInt(item.producto.stock) || 0;
      const cantidad_vendida = parseInt(item.total_vendido) || 0;

      totalGananciaNeta += ganancia_neta;
      totalIngresos += total_ingresos;
      totalCantidadVendida += cantidad_vendida;
      totalStockActual += stock;

      const row = [
        { text: String(index + 1), fontSize: 8 },
        { text: safeText(item.producto.codigo), fontSize: 8 },
        { text: safeText(item.producto.nombre), fontSize: 8 },
        { text: safeText(item.producto.categorium?.nombre), fontSize: 8 },
        { text: safeText(item.producto.marca?.nombre), fontSize: 8 },
        { text: String(cantidad_vendida), fontSize: 8, alignment: 'center' },
        { text: String(stock), fontSize: 8, alignment: 'center' },
        { text: formatNumber(total_ingresos), fontSize: 8, alignment: 'right', bold: true },
        { text: formatNumber(ganancia_neta), fontSize: 8, alignment: 'right', bold: true, color: ganancia_neta >= 0 ? '#00aa00' : '#aa0000' }
      ];

      tableBody.push(row);
    });

    // Fila de totales
    tableBody.push([
      { text: 'TOTALES', bold: true, colSpan: 5, fillColor: '#aed6f1', fontSize: 9 },
      {}, {}, {}, {},
      { text: String(totalCantidadVendida), bold: true, fillColor: '#aed6f1', fontSize: 9, alignment: 'center' },
      { text: String(totalStockActual), bold: true, fillColor: '#aed6f1', fontSize: 9, alignment: 'center' },
      { text: formatNumber(totalIngresos), bold: true, fillColor: '#aed6f1', fontSize: 9, alignment: 'right' },
      { text: formatNumber(totalGananciaNeta), bold: true, fillColor: '#aed6f1', fontSize: 9, alignment: 'right' }
    ]);

    // Anchos de columna
    const colWidths = [30, 50, '*', 70, 60, 50, 50, 70, 70];

    // Estructura del PDF
    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [36, 110, 36, 54],
      header: {
        margin: [40, 40, 40, 20],
        columns: [
          { image: logo, width: 60 },
          {
            stack: [
              { text: 'Reporte de Tendencia de Productos', fontSize: 16, bold: true },
              ...filtroLines.map(l => ({ text: l, fontSize: 8 }))
            ],
            margin: [10, 0, 0, 0],
            width: '*'
          },
          {
            stack: [
              { text: `Generado por: ${usuario || 'desconocido'}`, alignment: 'right', fontSize: 8 },
              { text: `Sistema: ${nombreSistema || ''}`, alignment: 'right', fontSize: 8 },
              { text: `Fecha: ${new Date().toLocaleString('es-BO')}`, alignment: 'right', fontSize: 8 }
            ],
            width: 150
          }
        ]
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Generado: ${new Date().toLocaleString('es-BO')} por: ${usuario || 'desconocido'}`, alignment: 'left', margin: [40, 0, 0, 0], fontSize: 8 },
          { text: `${nombreSistema || ''} - Página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 0, 40, 0], fontSize: 8 }
        ]
      }),
      content: [
        { text: '\n' },
        {
          table: {
            headerRows: 1,
            widths: colWidths,
            body: tableBody
          },
          layout: {
            hLineWidth: function (i, node) {
              return (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5;
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
        }
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10]
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="reporte-tendencia.pdf"');
    
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.log('Error en tendenciaPDF:', error);
    return res.status(500).json({ 
      mensaje: 'Error al generar reporte PDF de tendencia', 
      error: error.message 
    });
  }
};
const tendenciaXlsx = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { nombre_codigo, id_categoria, id_marca, desde, hasta, tipo_venta, orden, usuario, nombreSistema } = req.body || {};
    
    console.log('Body de tendenciaXlsx:', req.body);
    
    // Construir filtros para producto
    const whereProducto = {};
    
    if (id_categoria && String(id_categoria).trim() !== '') {
      whereProducto.id_categoria = parseInt(id_categoria);
    }
    
    if (id_marca && String(id_marca).trim() !== '') {
      whereProducto.id_marca = parseInt(id_marca);
    }
    
    if (nombre_codigo && String(nombre_codigo).trim() !== '') {
      const busqueda = String(nombre_codigo).trim();
      whereProducto[Op.or] = [
        { nombre: { [Op.iLike]: `%${busqueda}%` } },
        { codigo: { [Op.iLike]: `%${busqueda}%` } }
      ];
    }
    
    // Construir filtros para venta (fecha_registro y tipo_venta)
    const desdeVal = desde && String(desde).trim() !== '' ? String(desde).trim() : null;
    const hastaVal = hasta && String(hasta).trim() !== '' ? String(hasta).trim() : null;
    
    const whereVenta = {
      estado: 1,
      [Op.and]: [
        ...(desdeVal ? [Sequelize.literal(`SUBSTRING(CAST(\"ventum\".\"fecha_registro\" AS TEXT), 1, 10) >= '${desdeVal}'`)] : []),
        ...(hastaVal ? [Sequelize.literal(`SUBSTRING(CAST(\"ventum\".\"fecha_registro\" AS TEXT), 1, 10) <= '${hastaVal}'`)] : [])
      ]
    };
    
    // Filtro de tipo_venta (1=normal, 2=facturado, 0 o null=todos)
    if (tipo_venta && parseInt(tipo_venta) !== 0) {
      whereVenta.tipo_venta = parseInt(tipo_venta);
    }
    
    // Realizar la consulta agrupada por producto
    const resultados = await db.det_venta.findAll({
      attributes: [
        'id_producto',
        [Sequelize.fn('SUM', Sequelize.col('det_venta.cantidad')), 'total_vendido'],
        [Sequelize.fn('SUM', Sequelize.col('det_venta.sub_total')), 'total_ingresos'],
        [Sequelize.fn('SUM',
          Sequelize.literal(`
            CASE 
              WHEN \"ventum\".\"tipo_venta\" = 2 
              THEN (
                ((\"det_venta\".\"sub_total\" - (\"det_venta\".\"precio_compra\" * \"det_venta\".\"cantidad\"))
                  * (((\"ventum\".\"monto_total\" - \"ventum\".\"descuento\")::numeric / \"ventum\".\"monto_total\"))
                )
                - (((\"ventum\".\"monto_total\" - \"ventum\".\"descuento\") * 0.13) * (\"det_venta\".\"sub_total\" / \"ventum\".\"monto_total\"))
              )
              ELSE (
                (\"det_venta\".\"sub_total\" - (\"det_venta\".\"precio_compra\" * \"det_venta\".\"cantidad\"))
                  * (((\"ventum\".\"monto_total\" - \"ventum\".\"descuento\")::numeric / \"ventum\".\"monto_total\"))
              )
            END
          `)
        ), 'ganancia_neta']
      ],
      include: [
        {
          model: db.venta,
          attributes: [],
          where: whereVenta,
          required: true
        },
        {
          model: db.producto,
          attributes: ['codigo', 'nombre', 'precio_compra', 'precio_venta', 'stock', 'estado'],
          where: whereProducto,
          required: true,
          include: [
            {
              model: db.categoria,
              attributes: ['nombre'],
              required: false
            },
            {
              model: db.marca,
              attributes: ['nombre'],
              required: false
            }
          ]
        }
      ],
      group: [
        'det_venta.id_producto', 
        'producto.id_producto', 
        'producto.codigo', 
        'producto.nombre',
        'producto.estado', 
        'producto.precio_compra', 
        'producto.precio_venta', 
        'producto.stock', 
        'producto->categorium.id_categoria', 
        'producto->categorium.nombre',
        'producto->marca.id_marca', 
        'producto->marca.nombre'
      ],
      order: [[Sequelize.literal('ganancia_neta'), 'DESC']],
      raw: true,
      nest: true
    });

    if (!resultados || resultados.length === 0) {
      return res.status(404).send("No se encontraron datos para generar el reporte");
    }

    // Ordenar según el parámetro orden
    if (orden === 'vendido') {
      resultados.sort((a, b) => parseFloat(b.total_vendido) - parseFloat(a.total_vendido));
    } else if (orden === 'ingreso') {
      resultados.sort((a, b) => parseFloat(b.total_ingresos) - parseFloat(a.total_ingresos));
    } else if (orden === 'ganancia') {
      resultados.sort((a, b) => parseFloat(b.ganancia_neta) - parseFloat(a.ganancia_neta));
    }

    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      return String(v);
    };

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // Construir líneas de filtros para la cabecera
    const filtroLines = [];
    
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    
    if (tipo_venta && parseInt(tipo_venta) !== 0) {
      const tipoVentaTexto = parseInt(tipo_venta) === 1 ? 'Normal' : 'Facturado';
      filtroLines.push(`Tipo de Venta: ${tipoVentaTexto}`);
    }
    
    if (id_categoria) {
      const cat = await db.categoria.findByPk(id_categoria, { attributes: ['nombre'] });
      if (cat) filtroLines.push(`Categoría: ${cat.nombre}`);
    }
    
    if (id_marca) {
      const marc = await db.marca.findByPk(id_marca, { attributes: ['nombre'] });
      if (marc) filtroLines.push(`Marca: ${marc.nombre}`);
    }
    
    if (nombre_codigo) filtroLines.push(`Búsqueda: ${nombre_codigo}`);
    
    if (orden) {
      const ordenTexto = orden === 'vendido' ? 'Más Vendido' : orden === 'ingreso' ? 'Mayor Ingreso' : 'Mayor Ganancia';
      filtroLines.push(`Ordenado por: ${ordenTexto}`);
    }
    
    if (!filtroLines.length) filtroLines.push('Sin filtros aplicados');

    // Calcular totales
    let totalGananciaNeta = 0;
    let totalIngresos = 0;
    let totalCantidadVendida = 0;
    let totalStockActual = 0;

    resultados.forEach((item) => {
      const ganancia_neta = parseFloat(item.ganancia_neta) || 0;
      const total_ingresos = parseFloat(item.total_ingresos) || 0;
      const stock = parseInt(item.producto.stock) || 0;
      const cantidad_vendida = parseInt(item.total_vendido) || 0;

      totalGananciaNeta += ganancia_neta;
      totalIngresos += total_ingresos;
      totalCantidadVendida += cantidad_vendida;
      totalStockActual += stock;
    });

    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tendencia de Productos');

    // Encabezado
    const firstRow = ['', 'Reporte de Tendencia de Productos'];
    const titleRow = sheet.addRow(firstRow);
    titleRow.font = { bold: true, size: 14 };

    const secondRow = [''];
    secondRow.push(`Fecha generación: ${new Date().toLocaleString('es-BO')}`);
    secondRow.push(`Generado por: ${usuario || 'desconocido'}`);
    for (const f of filtroLines) secondRow.push(f);
    sheet.addRow(secondRow);
    sheet.addRow([]);

    // Headers de tabla
    const headers = ['Nro', 'Código', 'Producto', 'Categoría', 'Marca', 'Cant. Vendida', 'Stock Actual', 'Total Ingresos', 'Ganancia Neta'];
    const colKeys = ['nro', 'codigo', 'producto', 'categoria', 'marca', 'cant_vendida', 'stock', 'ingresos', 'ganancia'];
    const colWidths = [8, 15, 30, 20, 20, 15, 12, 15, 15];
    
    sheet.columns = colKeys.map((key, idx) => ({ key, width: colWidths[idx] }));
    
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDFF2E6' } };
      cell.font = { bold: true };
    });

    // Agregar datos
    resultados.forEach((item, index) => {
      const ganancia_neta = parseFloat(item.ganancia_neta) || 0;
      const total_ingresos = parseFloat(item.total_ingresos) || 0;
      const stock = parseInt(item.producto.stock) || 0;
      const cantidad_vendida = parseInt(item.total_vendido) || 0;

      const rowData = [
        index + 1,
        safeText(item.producto.codigo),
        safeText(item.producto.nombre),
        safeText(item.producto.categorium?.nombre),
        safeText(item.producto.marca?.nombre),
        cantidad_vendida,
        stock,
        total_ingresos,
        ganancia_neta
      ];

      const row = sheet.addRow(rowData);
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).numFmt = '#,##0.00';
      
      // Color verde para ganancias positivas, rojo para negativas
      if (ganancia_neta >= 0) {
        row.getCell(9).font = { color: { argb: 'FF00AA00' }, bold: true };
      } else {
        row.getCell(9).font = { color: { argb: 'FFAA0000' }, bold: true };
      }
    });

    // Fila de totales
    const totalesRow = sheet.addRow([
      '',
      'TOTALES',
      '',
      '',
      '',
      totalCantidadVendida,
      totalStockActual,
      totalIngresos,
      totalGananciaNeta
    ]);
    
    totalesRow.eachCell((cell, colNumber) => {
      if (colNumber >= 2) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFAED6F1' } };
        cell.font = { bold: true };
      }
    });
    totalesRow.getCell(8).numFmt = '#,##0.00';
    totalesRow.getCell(9).numFmt = '#,##0.00';

    // Generar y enviar
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_tendencia_${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.log('Error en tendenciaXlsx:', error);
    return res.status(500).json({ 
      mensaje: 'Error al generar reporte XLSX de tendencia', 
      error: error.message 
    });
  }
};

module.exports = {
  obtenerDatosTendencia,
  tendenciaPDF,
  tendenciaXlsx
};
