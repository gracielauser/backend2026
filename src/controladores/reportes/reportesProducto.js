const express = require("express");
const router = express.Router();
const { db } = require("../../config/dataBase");
const PdfPrinter = require("pdfmake");
const fonts = require("../../utils/pdfFonts");
const convertImageToBase64 = require("../../utils/imageToBase64");
const { Op, Sequelize, literal } = require("sequelize");

const reporteInventario = async (req, res) => {
  try {
    console.log("Generando reporte de inventario...",req.body);
    const { id_categoria, id_marca, estado, busqueda, id_unidad_medida, stock_minimo } = req.body;

    // Buscar nombres para filtros
    let nombreCategoriaFiltro = null;
    let nombreMarcaFiltro = null;
    let nombreUnidadFiltro = null;
    
    if (id_categoria) {
      const categoriaObj = await db.categoria.findByPk(id_categoria).catch(() => null);
      if (categoriaObj) nombreCategoriaFiltro = categoriaObj.nombre;
    }
    
    if (id_marca) {
      const marcaObj = await db.marca.findByPk(id_marca).catch(() => null);
      if (marcaObj) nombreMarcaFiltro = marcaObj.nombre;
    }
    
    if (id_unidad_medida) {
      const unidadObj = await db.unidad_medida.findByPk(id_unidad_medida).catch(() => null);
      if (unidadObj) nombreUnidadFiltro = unidadObj.nombre;
    }

    // Construir filtros
    let whereClause = {};
    
    if (id_categoria) whereClause.id_categoria = id_categoria;
    if (id_marca) whereClause.id_marca = id_marca;
    if (estado !== undefined && estado !== null && estado !== '') whereClause.estado = estado;
    if (id_unidad_medida) whereClause.id_unidad_medida = id_unidad_medida;
    if (stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '') {
      whereClause.stock = { [Op.lte]: stock_minimo };
    }
    if (busqueda) {
      whereClause[Op.or] = [
        { codigo: { [Op.iLike]: `%${busqueda}%` } },
        { nombre: { [Op.iLike]: `%${busqueda}%` } }
      ];
    }

    // Obtener todos los productos con sus relaciones
    const productosRaw = await db.producto.findAll({
      where: whereClause,
      include: [
        { model: db.categoria, attributes: ['id_categoria', 'nombre'] },
        { model: db.marca, attributes: ['id_marca', 'nombre'] },
        { model: db.unidad_medida, attributes: ['id_unidad_medida', 'nombre', 'abreviatura'] },
        { model: db.inventario, attributes: ['id_inventario', 'fecha_registro', 'tipo_movimiento', 'motivo', 'cantidad'] }
      ],
      order: [['nombre', 'ASC']]
    });

    if (!productosRaw || productosRaw.length === 0) {
      return res.status(404).send("No se encontraron productos");
    }

    // Convertir a objetos planos
    const productos = productosRaw.map(p => p.get ? p.get({ plain: true }) : p);

    // Helper para texto seguro
    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        return v.nombre || v.NOMBRE || v.id || JSON.stringify(v);
      }
      return String(v);
    };

    const printer = new PdfPrinter(fonts);
    const logo = await convertImageToBase64("../assets/logo2.jpeg");

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // Líneas de filtros
    const filtroLines = [];
    if (id_categoria && nombreCategoriaFiltro) filtroLines.push(`Categoría: ${nombreCategoriaFiltro}`);
    if (id_marca && nombreMarcaFiltro) filtroLines.push(`Marca: ${nombreMarcaFiltro}`);
    if (estado !== undefined && estado !== null && estado !== '') filtroLines.push(`Estado: ${estado === 1 ? 'Activo' : 'Inactivo'}`);
    if (busqueda) filtroLines.push(`Búsqueda: ${busqueda}`);
    if (id_unidad_medida && nombreUnidadFiltro) filtroLines.push(`Unidad de Medida: ${nombreUnidadFiltro}`);
    if (stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '') filtroLines.push(`Stock <= ${stock_minimo}`);
    if (filtroLines.length === 0) filtroLines.push('Sin filtros aplicados');

    // Calcular totales
    const totalProductos = productos.length;
    const productosActivos = productos.filter(p => p.estado === 1).length;
    const productosInactivos = productos.filter(p => p.estado !== 1).length;
    const totalStock = productos.reduce((sum, p) => sum + (p.stock || 0), 0);
    const valorInventarioCompra = productos.reduce((sum, p) => sum + ((p.stock || 0) * (p.precio_compra || 0)), 0);
    const valorInventarioVenta = productos.reduce((sum, p) => sum + ((p.stock || 0) * (p.precio_venta || 0)), 0);
    const gananciaPotencial = valorInventarioVenta - valorInventarioCompra;
    const margenGananciaTotal = valorInventarioCompra > 0 
      ? ((gananciaPotencial / valorInventarioCompra) * 100).toFixed(2)
      : '0.00';

    // Preparar tabla de productos
    const tableBody = [
      [
        { text: "Código", bold: true, fontSize: 9 },
        { text: "Nombre", bold: true, fontSize: 9 },
        { text: "Categoría", bold: true, fontSize: 9 },
        { text: "Marca", bold: true, fontSize: 9 },
        { text: "U. Medida", bold: true, fontSize: 9 },
        { text: "Stock", bold: true, fontSize: 9 },
        { text: "Stock Mín", bold: true, fontSize: 9 },
        { text: "P. Compra", bold: true, fontSize: 9 },
        { text: "Margen", bold: true, fontSize: 9 },
        { text: "P. Venta", bold: true, fontSize: 9 },
        { text: "Estado", bold: true, fontSize: 9 }
      ]
    ];

    productos.forEach((producto) => {
      const precioCompra = parseFloat(producto.precio_compra) || 0;
      const precioVenta = parseFloat(producto.precio_venta) || 0;
      const margenProducto = precioCompra > 0 
        ? (((precioVenta - precioCompra) / precioCompra) * 100).toFixed(2)
        : '0.00';

      tableBody.push([
        { text: safeText(producto.codigo), fontSize: 8 },
        { text: safeText(producto.nombre), fontSize: 8 },
        { text: producto.categorium ? safeText(producto.categorium.nombre) : "N/A", fontSize: 8 },
        { text: producto.marca ? safeText(producto.marca.nombre) : "N/A", fontSize: 8 },
        { text: producto.unidad_medida ? safeText(producto.unidad_medida.abreviatura || producto.unidad_medida.nombre) : "N/A", fontSize: 8 },
        { text: producto.stock || 0, fontSize: 8, alignment: 'center' },
        { text: producto.stock_minimo || 0, fontSize: 8, alignment: 'center' },
        { text: `Bs ${formatMoney(producto.precio_compra)}`, fontSize: 8, alignment: 'right' },
        { text: `${margenProducto}%`, fontSize: 8, alignment: 'center', bold: true, color: parseFloat(margenProducto) > 0 ? 'green' : 'red' },
        { text: `Bs ${formatMoney(producto.precio_venta)}`, fontSize: 8, alignment: 'right' },
        { text: producto.estado === 1 ? "Activo" : "Inactivo", fontSize: 8, alignment: 'center' }
      ]);
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
                { text: 'REPORTE DE INVENTARIO DE PRODUCTOS', style: 'header', alignment: 'center' },
                { text: `Fecha: ${new Date().toLocaleDateString('es-ES')}`, style: 'subheader', alignment: 'center' },
                { text: `Total de Productos: ${totalProductos}`, style: 'subheader', alignment: 'center' },
                { text: 'Filtros aplicados:', fontSize: 8, bold: true, alignment: 'center', margin: [0, 5, 0, 2] },
                ...filtroLines.map(f => ({ text: f, fontSize: 7, alignment: 'center' }))
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
      content: [
        {
          style: 'totales',
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*'],
            body: [
              [
                { text: 'Indicador', bold: true, fillColor: '#4CAF50', fontSize: 10, color: 'white', alignment: 'center' },
                { text: 'Valor', bold: true, fillColor: '#4CAF50', fontSize: 10, color: 'white', alignment: 'center' },
                { text: 'Indicador', bold: true, fillColor: '#4CAF50', fontSize: 10, color: 'white', alignment: 'center' },
                { text: 'Valor', bold: true, fillColor: '#4CAF50', fontSize: 10, color: 'white', alignment: 'center' }
              ],
              [
                { text: 'Total de Productos:', bold: true, fontSize: 9 },
                { text: totalProductos.toString(), alignment: 'right', fontSize: 9 },
                { text: 'Productos Activos:', bold: true, fontSize: 9 },
                { text: productosActivos.toString(), alignment: 'right', fontSize: 9, color: 'green' }
              ],
              [
                { text: 'Total Unidades en Stock:', bold: true, fontSize: 9 },
                { text: totalStock.toString(), alignment: 'right', fontSize: 9 },
                { text: 'Productos Inactivos:', bold: true, fontSize: 9 },
                { text: productosInactivos.toString(), alignment: 'right', fontSize: 9, color: 'red' }
              ],
              [
                { text: 'Valor Inventario (Compra):', bold: true, fontSize: 9 },
                { text: `Bs ${formatMoney(valorInventarioCompra)}`, alignment: 'right', fontSize: 9, color: 'blue' },
                { text: 'Valor Inventario (Venta):', bold: true, fontSize: 9 },
                { text: `Bs ${formatMoney(valorInventarioVenta)}`, alignment: 'right', fontSize: 9, color: 'green' }
              ],
              [
                { text: 'Ganancia Potencial:', bold: true, fontSize: 9 },
                { text: `Bs ${formatMoney(gananciaPotencial)}`, alignment: 'right', fontSize: 9, color: 'orange', bold: true },
                { text: 'Margen de Ganancia Total:', bold: true, fontSize: 9 },
                { text: `${margenGananciaTotal}%`, alignment: 'right', fontSize: 9, color: 'purple', bold: true }
              ]
            ]
          },
          layout: {
            fillColor: function (rowIndex, node, columnIndex) {
              if (rowIndex === 0) return '#4CAF50';
              return (rowIndex % 2 === 0) ? '#f9f9f9' : null;
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
        },
        { text: '\n' },
        {
          table: {
            headerRows: 1,
            widths: [40, '*', 55, 55, 35, 30, 30, 42, 35, 42, 35],
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
        }
      ],
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
        totales: {
          fontSize: 10,
          margin: [0, 10, 0, 0]
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=reporte_inventario_${Date.now()}.pdf`);
    
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error("Error en reporteInventario:", error);
    res.status(500).send("Error al generar el reporte: " + error.message);
  }
};

// Reporte de catálogo de productos con fotos
const reporteCatalogoProductos = async (req, res) => {
  try {
    const {
      id_categoria,
      id_marca,
      codigo,
      estado,
      stock = false,
      usuario = '',
      nombreSistema = 'Auto Accesorios Pinedo'
    } = req.body || {};

    console.log('Reporte catálogo productos - parámetros:', req.body);

    // Construir filtros
    const whereProducto = {};

    // Filtro por categoría
    if (id_categoria && String(id_categoria).trim() !== '') {
      whereProducto.id_categoria = parseInt(id_categoria);
    }

    // Filtro por marca
    if (id_marca && String(id_marca).trim() !== '') {
      whereProducto.id_marca = parseInt(id_marca);
    }

    // Filtro por código (parcial, case-insensitive)
    if (codigo && String(codigo).trim() !== '') {
      whereProducto.codigo = {
        [Op.like]: `%${String(codigo).trim()}%`
      };
    }

    // Filtro por estado
    if (estado !== undefined && String(estado).trim() !== '') {
      whereProducto.estado = parseInt(estado);
    }

    // Filtro por stock
    if (stock === true || stock === 'true') {
      whereProducto.stock = {
        [Op.gt]: 0
      };
    }

    console.log('Where clause productos:', whereProducto);

    // Obtener productos con sus relaciones
    const productosRaw = await db.producto.findAll({
      where: whereProducto,
      include: [
        { model: db.categoria, attributes: ['id_categoria', 'nombre'] },
        { model: db.marca, attributes: ['id_marca', 'nombre'] },
        { model: db.unidad_medida, attributes: ['id_unidad_medida', 'nombre', 'abreviatura'] }
      ],
      order: [
        ['codigo', 'ASC'],
        ['nombre', 'ASC']
      ]
    });

    if (!productosRaw || productosRaw.length === 0) {
      return res.status(404).send("No se encontraron productos con los criterios especificados");
    }

    const productos = productosRaw.map(p => p.get ? p.get({ plain: true }) : p);

    // Helper para texto seguro
    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        return v.nombre || v.NOMBRE || v.id || JSON.stringify(v);
      }
      return String(v);
    };

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // Preparar contenido del PDF
    const content = [];
    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64("../assets/logo2.jpeg");
    // Construir filas de productos (3 productos por fila)
    for (let i = 0; i < productos.length; i += 3) {
      const producto1 = productos[i];
      const producto2 = productos[i + 1];
      const producto3 = productos[i + 2];

      const buildProductoCard = (producto) => {
        if (!producto) return { text: '' };

        // Intentar cargar la foto del producto
        let fotoProducto = null;
        if (producto.foto) {
          try {
            fotoProducto = convertImageToBase64(`../../uploads/${producto.foto}`);
          } catch (error) {
            console.log(`No se pudo cargar la foto: ${producto.foto}`);
            fotoProducto = null;
          }
        }

        // Columna de la foto
        const columnaFoto = fotoProducto 
          ? { image: fotoProducto, width: 50, height: 50, margin: [0, 0, 5, 0] }
          : { 
              canvas: [
                {
                  type: 'rect',
                  x: 0,
                  y: 0,
                  w: 50,
                  h: 50,
                  lineColor: '#ddd',
                  lineWidth: 1
                }
              ],
              margin: [0, 0, 5, 0]
            };

        // Columna de información
        const columnaInfo = {
          stack: [
            { text: `${safeText(producto.codigo)}`, fontSize: 6, bold: true, color: '#666' },
            { text: `${safeText(producto.nombre)}`, fontSize: 8, bold: true, margin: [0, 2, 0, 3] },
            { text: `${producto.categorium ? safeText(producto.categorium.nombre) : 'N/A'}`, fontSize: 6, margin: [0, 1, 0, 1] },
            { text: `${producto.marca ? safeText(producto.marca.nombre) : 'N/A'}`, fontSize: 6, margin: [0, 1, 0, 1] },
            { text: `${producto.unidad_medidum ? safeText(producto.unidad_medidum.nombre) : 'N/A'}`, fontSize: 6, margin: [0, 1, 0, 1] }
          ],
          width: '*'
        };

        // Layout horizontal: foto a la izquierda, info a la derecha
        return {
          columns: [
            columnaFoto,
            columnaInfo
          ],
          margin: [3, 3, 3, 3]
        };
      };

      // Crear una fila con 3 productos
      const row = {
        columns: [
          { 
            width: '31%', 
            stack: [buildProductoCard(producto1)],
            fillColor: '#f9f9f9'
          },
          { width: '3%', text: '' }, // Espaciador
          { 
            width: '31%', 
            stack: producto2 ? [buildProductoCard(producto2)] : [],
            fillColor: producto2 ? '#f9f9f9' : null
          },
          { width: '3%', text: '' }, // Espaciador
          { 
            width: '31%', 
            stack: producto3 ? [buildProductoCard(producto3)] : [],
            fillColor: producto3 ? '#f9f9f9' : null
          }
        ],
        margin: [0, 5, 0, 5]
      };

      content.push(row);

      // Línea separadora
      if (i + 3 < productos.length) {
        content.push({
          canvas: [{
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 520,
            y2: 0,
            lineWidth: 0.5,
            lineColor: '#ddd'
          }],
          margin: [0, 3, 0, 3]
        });
      }
    }

    // Construir líneas de filtros
    const filtroLines = [];
    if (id_categoria) {
      const cat = productos.find(p => p.id_categoria == id_categoria);
      if (cat && cat.categorium) {
        filtroLines.push(`Categoría: ${cat.categorium.nombre}`);
      }
    }
    if (id_marca) {
      const prod = productos.find(p => p.id_marca == id_marca);
      if (prod && prod.marca) {
        filtroLines.push(`Marca: ${prod.marca.nombre}`);
      }
    }
    if (codigo) filtroLines.push(`Código: ${codigo}`);
    if (estado !== undefined && estado !== null) {
      filtroLines.push(`Estado: ${estado == 1 ? 'Activos' : 'Inactivos'}`);
    }
    if (stock === true || stock === 'true') {
      filtroLines.push('Solo con stock disponible');
    }
    if (!filtroLines.length) filtroLines.push('Todos los productos');

    // Estructura del PDF
    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [36, 110, 36, 54],
      header: {
        margin: [40, 40, 40, 20],
        columns: [
          { image: logo, width: 60 },
          {
            stack: [
              { text: 'Catálogo de Productos', fontSize: 16, bold: true },
              ...filtroLines.map(l => ({ text: l, fontSize: 8 }))
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
        ]
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Total de productos: ${productos.length}`, alignment: 'left', margin: [40, 0, 0, 0], fontSize: 8 },
          { text: `${nombreSistema} - Página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 0, 40, 0], fontSize: 8 }
        ]
      }),
      content: content,
      defaultStyle: { fontSize: 9 }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=catalogo_productos_${Date.now()}.pdf`);

    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error("Error en reporteCatalogoProductos:", error);
    res.status(500).send("Error al generar el catálogo: " + error.message);
  }
};

// Reporte de ganancias por producto
const reporteGananciasProducto = async (req, res) => {
  try {
    const {
      usuario = '',
      nombreSistema = 'Auto Accesorios Pinedo',
      nombre_codigo,
      id_categoria,
      id_marca,
      desde,
      hasta
    } = req.body || {};

    console.log('Reporte de ganancias por producto - parámetros:', req.body);

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
    
    // Construir filtros para venta (fecha_registro)
    const whereVenta = { estado: 1 };
    
    if (desde && String(desde).trim() !== '') {
      whereVenta.fecha_registro = whereVenta.fecha_registro || {};
      whereVenta.fecha_registro[Op.gte] = String(desde).trim();
    }
    
    if (hasta && String(hasta).trim() !== '') {
      whereVenta.fecha_registro = whereVenta.fecha_registro || {};
      whereVenta.fecha_registro[Op.lte] = String(hasta).trim() + ' 23:59:59';
    }

    // Obtener detalles de venta agrupados por producto con ganancias calculadas
    const resultados = await db.det_venta.findAll({
      attributes: [
        'id_producto',
        [Sequelize.fn('SUM', Sequelize.col('det_venta.cantidad')), 'cantidad_vendida'],
    
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
          attributes: ['codigo', 'nombre', 'precio_compra', 'precio_venta', 'stock','estado'],
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
      group: ['det_venta.id_producto', 'producto.id_producto', 'producto.codigo', 'producto.nombre','producto.estado', 
              'producto.precio_compra', 'producto.precio_venta', 'producto.stock', 
              'producto->categorium.id_categoria', 'producto->categorium.nombre',
              'producto->marca.id_marca', 'producto->marca.nombre'],
      order: [[Sequelize.literal('ganancia_neta'), 'DESC']],
      raw: true,
      nest: true
    });

    if (resultados.length > 0) {
      console.log('Primer resultado:', JSON.stringify(resultados[0]));
    }

    if (!resultados || resultados.length === 0) {
      return res.status(404).send("No se encontraron datos de ganancias");
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
    
    if (id_categoria) {
      const cat = await db.categoria.findByPk(id_categoria, { attributes: ['nombre'] });
      if (cat) filtroLines.push(`Categoría: ${cat.nombre}`);
    }
    
    if (id_marca) {
      const marc = await db.marca.findByPk(id_marca, { attributes: ['nombre'] });
      if (marc) filtroLines.push(`Marca: ${marc.nombre}`);
    }
    
    if (nombre_codigo) filtroLines.push(`Búsqueda: ${nombre_codigo}`);
    
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
      { text: 'Ganancia Neta por Ventas', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'right' },
      { text: 'Beneficio Bruto Potencial', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'right' }
    ];
    tableBody.push(headerRow);

    let totalGananciaNeta = 0;
    let totalBeneficioBruto = 0;
    let totalCantidadVendida = 0;
    let totalStockActual = 0;

    // Datos
    resultados.forEach((item, index) => {
      const ganancia_neta = parseFloat(item.ganancia_neta) || 0;
      const precio_compra = parseFloat(item.producto.precio_compra) || 0;
      const precio_venta = parseFloat(item.producto.precio_venta) || 0;
      const stock = parseInt(item.producto.stock) || 0;
      const cantidad_vendida = parseInt(item.cantidad_vendida) || 0;
      const beneficio_bruto = item.producto.estado==1? (precio_venta - precio_compra) * stock: 0;

      totalGananciaNeta += ganancia_neta;
      totalBeneficioBruto += beneficio_bruto;
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
        { text: formatNumber(ganancia_neta), fontSize: 8, alignment: 'right', bold: true, color: ganancia_neta >= 0 ? '#00aa00' : '#aa0000' },
        { text: formatNumber(beneficio_bruto), fontSize: 8, alignment: 'right', bold: true, color: '#0000aa' }
      ];

      tableBody.push(row);
    });

    // Fila de totales
    tableBody.push([
      { text: 'TOTALES', bold: true, colSpan: 5, fillColor: '#aed6f1', fontSize: 9 },
      {}, {}, {}, {},
      { text: String(totalCantidadVendida), bold: true, fillColor: '#aed6f1', fontSize: 9, alignment: 'center' },
      { text: String(totalStockActual), bold: true, fillColor: '#aed6f1', fontSize: 9, alignment: 'center' },
      { text: formatNumber(totalGananciaNeta), bold: true, fillColor: '#aed6f1', fontSize: 9, alignment: 'right' },
      { text: formatNumber(totalBeneficioBruto), bold: true, fillColor: '#aed6f1', fontSize: 9, alignment: 'right' }
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
              { text: 'Reporte de Ganancias por Producto', fontSize: 16, bold: true },
              ...filtroLines.map(l => ({ text: l, fontSize: 8 }))
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
        ]
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Generado: ${new Date().toLocaleString('es-BO')} por: ${usuario || 'desconocido'}`, alignment: 'left', margin: [40, 0, 0, 0], fontSize: 8 },
          { text: `${nombreSistema} - Página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 0, 40, 0], fontSize: 8 }
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
          },
          margin: [0, 20, 0, 0]
        },
        { text: '\n' },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Leyenda:', bold: true, fontSize: 9, margin: [0, 0, 0, 5] },
                { text: '• Ganancia Neta: Ganancia real considerando descuentos e impuestos de ventas realizadas', fontSize: 7 },
                { text: '• Beneficio Bruto: Ganancia potencial del stock actual sin ventas', fontSize: 7 },
                { text: '• Para productos facturados (tipo_venta=2) se descuenta 3% de impuesto', fontSize: 7 }
              ]
            }
          ]
        }
      ],
      styles: {
        header: {
          fontSize: 16,
          bold: true
        }
      },
      defaultStyle: {
        fontSize: 9
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=reporte_ganancias_productos.pdf');
    
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error("Error en reporteGananciasProducto:", error);
    res.status(500).send("Error al generar el reporte de ganancias: " + error.message);
  }
};

// Obtener datos de inventario para vista previa (sin generar PDF)
const obtenerDatosInventario = async (req, res) => {
  try {
    const { id_categoria, id_marca, estado, busqueda, id_unidad_medida, stock_minimo } = req.body;

    // Construir filtros
    let whereClause = {};
    
    if (id_categoria) whereClause.id_categoria = id_categoria;
    if (id_marca) whereClause.id_marca = id_marca;
    if (estado !== undefined && estado !== null && estado !== '') whereClause.estado = estado;
    if (id_unidad_medida) whereClause.id_unidad_medida = id_unidad_medida;
    if (stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '') {
      whereClause.stock = { [Op.lte]: stock_minimo };
    }
    if (busqueda) {
      whereClause[Op.or] = [
        { codigo: { [Op.iLike]: `%${busqueda}%` } },
        { nombre: { [Op.iLike]: `%${busqueda}%` } }
      ];
    }

    // Obtener todos los productos con sus relaciones
    const productosRaw = await db.producto.findAll({
      where: whereClause,
      include: [
        { model: db.categoria, attributes: ['id_categoria', 'nombre'] },
        { model: db.marca, attributes: ['id_marca', 'nombre'] },
        { model: db.unidad_medida, attributes: ['id_unidad_medida', 'nombre', 'abreviatura'] },
        { model: db.inventario, attributes: ['id_inventario', 'fecha_registro', 'tipo_movimiento', 'motivo', 'cantidad'] }
      ],
      order: [['nombre', 'ASC']]
    });

    if (!productosRaw || productosRaw.length === 0) {
      // return res.status(404).json({ mensaje: "No se encontraron productos" });
      return res.status(200).json({})
    }

    // Convertir a objetos planos
    const productos = productosRaw.map(p => p.get ? p.get({ plain: true }) : p);

    // Calcular totales
    const totalProductos = productos.length;
    const productosActivos = productos.filter(p => p.estado === 1).length;
    const productosInactivos = productos.filter(p => p.estado !== 1).length;
    const totalStock = productos.reduce((sum, p) => sum + (p.stock || 0), 0);
    const valorInventarioCompra = productos.reduce((sum, p) => sum + ((p.stock || 0) * (p.precio_compra || 0)), 0);
    const valorInventarioVenta = productos.reduce((sum, p) => sum + ((p.stock || 0) * (p.precio_venta || 0)), 0);
    const gananciaPotencial = valorInventarioVenta - valorInventarioCompra;
    const margenGananciaTotal = valorInventarioCompra > 0 
      ? ((gananciaPotencial / valorInventarioCompra) * 100).toFixed(2)
      : '0.00';

    // Preparar productos con margen calculado
    const productosConMargen = productos.map((producto) => {
      const precioCompra = parseFloat(producto.precio_compra) || 0;
      const precioVenta = parseFloat(producto.precio_venta) || 0;
      const margenProducto = precioCompra > 0 
        ? (((precioVenta - precioCompra) / precioCompra) * 100).toFixed(2)
        : '0.00';

      return {
        id_producto: producto.id_producto,
        codigo: producto.codigo || '',
        nombre: producto.nombre || '',
        descripcion: producto.descripcion || '',
        categoria: producto.categorium ? {
          id_categoria: producto.categorium.id_categoria,
          nombre: producto.categorium.nombre
        } : null,
        marca: producto.marca ? {
          id_marca: producto.marca.id_marca,
          nombre: producto.marca.nombre
        } : null,
        unidad_medida: producto.unidad_medida ? {
          id_unidad_medida: producto.unidad_medida.id_unidad_medida,
          nombre: producto.unidad_medida.nombre,
          abreviatura: producto.unidad_medida.abreviatura
        } : null,
        stock: producto.stock || 0,
        stock_minimo: producto.stock_minimo || 0,
        precio_compra: precioCompra,
        precio_venta: precioVenta,
        margen_porcentaje: parseFloat(margenProducto),
        estado: producto.estado === 1 ? 'Activo' : 'Inactivo',
        estado_valor: producto.estado,
        foto: producto.foto || null,
        movimientos_inventario: producto.inventarios || []
      };
    });

    // Construir respuesta
    const respuesta = {
      fecha_generacion: new Date().toLocaleString('es-ES'),
      totales: {
        total_productos: totalProductos,
        productos_activos: productosActivos,
        productos_inactivos: productosInactivos,
        total_unidades_stock: totalStock,
        valor_inventario_compra: parseFloat(valorInventarioCompra.toFixed(2)),
        valor_inventario_venta: parseFloat(valorInventarioVenta.toFixed(2)),
        ganancia_potencial: parseFloat(gananciaPotencial.toFixed(2)),
        margen_ganancia_total_porcentaje: parseFloat(margenGananciaTotal)
      },
      productos: productosConMargen
    };

    return res.status(200).json(respuesta);

  } catch (error) {
    console.error("Error en obtenerDatosInventario:", error);
    return res.status(500).json({ 
      mensaje: "Error al obtener los datos del inventario", 
      error: error.message 
    });
  }
};

// Reporte de inventario en Excel
const reporteInventarioXlsx = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { id_categoria, id_marca, estado, busqueda, id_unidad_medida, stock_minimo } = req.body;

    // Buscar nombres para filtros
    let nombreCategoriaFiltro = null;
    let nombreMarcaFiltro = null;
    let nombreUnidadFiltro = null;
    
    if (id_categoria) {
      const categoriaObj = await db.categoria.findByPk(id_categoria).catch(() => null);
      if (categoriaObj) nombreCategoriaFiltro = categoriaObj.nombre;
    }
    
    if (id_marca) {
      const marcaObj = await db.marca.findByPk(id_marca).catch(() => null);
      if (marcaObj) nombreMarcaFiltro = marcaObj.nombre;
    }
    
    if (id_unidad_medida) {
      const unidadObj = await db.unidad_medida.findByPk(id_unidad_medida).catch(() => null);
      if (unidadObj) nombreUnidadFiltro = unidadObj.nombre;
    }

    // Construir filtros
    let whereClause = {};
    
    if (id_categoria) whereClause.id_categoria = id_categoria;
    if (id_marca) whereClause.id_marca = id_marca;
    if (estado !== undefined && estado !== null && estado !== '') whereClause.estado = estado;
    if (id_unidad_medida) whereClause.id_unidad_medida = id_unidad_medida;
    if (stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '') {
      whereClause.stock = { [Op.lte]: stock_minimo };
    }
    if (busqueda) {
      whereClause[Op.or] = [
        { codigo: { [Op.iLike]: `%${busqueda}%` } },
        { nombre: { [Op.iLike]: `%${busqueda}%` } }
      ];
    }

    // Obtener productos
    const productosRaw = await db.producto.findAll({
      where: whereClause,
      include: [
        { model: db.categoria, attributes: ['id_categoria', 'nombre'] },
        { model: db.marca, attributes: ['id_marca', 'nombre'] },
        { model: db.unidad_medida, attributes: ['id_unidad_medida', 'nombre', 'abreviatura'] }
      ],
      order: [['nombre', 'ASC']]
    });

    if (!productosRaw || productosRaw.length === 0) {
      return res.status(404).send("No se encontraron productos");
    }

    const productos = productosRaw.map(p => p.get ? p.get({ plain: true }) : p);

    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        return v.nombre || v.NOMBRE || v.id || JSON.stringify(v);
      }
      return String(v);
    };

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // Líneas de filtros
    const filtroLines = [];
    if (id_categoria && nombreCategoriaFiltro) filtroLines.push(`Categoría: ${nombreCategoriaFiltro}`);
    if (id_marca && nombreMarcaFiltro) filtroLines.push(`Marca: ${nombreMarcaFiltro}`);
    if (estado !== undefined && estado !== null && estado !== '') filtroLines.push(`Estado: ${estado === 1 ? 'Activo' : 'Inactivo'}`);
    if (busqueda) filtroLines.push(`Búsqueda: ${busqueda}`);
    if (id_unidad_medida && nombreUnidadFiltro) filtroLines.push(`Unidad de Medida: ${nombreUnidadFiltro}`);
    if (stock_minimo !== undefined && stock_minimo !== null && stock_minimo !== '') filtroLines.push(`Stock <= ${stock_minimo}`);
    if (filtroLines.length === 0) filtroLines.push('Sin filtros aplicados');

    // Calcular totales
    const totalProductos = productos.length;
    const productosActivos = productos.filter(p => p.estado === 1).length;
    const productosInactivos = productos.filter(p => p.estado !== 1).length;
    const totalStock = productos.reduce((sum, p) => sum + (p.stock || 0), 0);
    const valorInventarioCompra = productos.reduce((sum, p) => sum + ((p.stock || 0) * (p.precio_compra || 0)), 0);
    const valorInventarioVenta = productos.reduce((sum, p) => sum + ((p.stock || 0) * (p.precio_venta || 0)), 0);
    const gananciaPotencial = valorInventarioVenta - valorInventarioCompra;
    const margenGananciaTotal = valorInventarioCompra > 0 
      ? ((gananciaPotencial / valorInventarioCompra) * 100).toFixed(2)
      : '0.00';

    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventario');

    // Encabezado
    const firstRow = ['', 'Reporte de Inventario de Productos'];
    const titleRow = sheet.addRow(firstRow);
    titleRow.font = { bold: true, size: 14 };

    const secondRow = [''];
    secondRow.push(`Fecha generación: ${new Date().toLocaleString('es-BO')}`);
    for (const f of filtroLines) secondRow.push(f);
    sheet.addRow(secondRow);
    sheet.addRow([]);

    // Resumen de totales
    const resumenRow = sheet.addRow(['', 'RESUMEN GENERAL']);
    resumenRow.font = { bold: true, size: 12 };
    resumenRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
    resumenRow.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    sheet.addRow(['', 'Total de Productos:', totalProductos]);
    sheet.addRow(['', 'Productos Activos:', productosActivos]);
    sheet.addRow(['', 'Productos Inactivos:', productosInactivos]);
    sheet.addRow(['', 'Total Unidades en Stock:', totalStock]);
    const valorCompraRow = sheet.addRow(['', 'Valor Inventario (Compra):', valorInventarioCompra]);
    valorCompraRow.getCell(3).numFmt = '#,##0.00';
    const valorVentaRow = sheet.addRow(['', 'Valor Inventario (Venta):', valorInventarioVenta]);
    valorVentaRow.getCell(3).numFmt = '#,##0.00';
    const gananciaPotRow = sheet.addRow(['', 'Ganancia Potencial:', gananciaPotencial]);
    gananciaPotRow.getCell(3).numFmt = '#,##0.00';
    sheet.addRow(['', 'Margen de Ganancia Total:', `${margenGananciaTotal}%`]);

    sheet.addRow([]);

    // Headers de tabla
    const headers = ['Código', 'Nombre', 'Categoría', 'Marca', 'U. Medida', 'Stock', 'Stock Mín', 'P. Compra', 'Margen %', 'P. Venta', 'Estado'];
    const colKeys = ['codigo', 'nombre', 'categoria', 'marca', 'unidad', 'stock', 'stock_min', 'p_compra', 'margen', 'p_venta', 'estado'];
    const colWidths = [15, 30, 20, 20, 12, 10, 10, 12, 12, 12, 12];
    
    sheet.columns = colKeys.map((key, idx) => ({ key, width: colWidths[idx] }));
    
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4CAF50' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    // Agregar productos
    productos.forEach((producto) => {
      const precioCompra = parseFloat(producto.precio_compra) || 0;
      const precioVenta = parseFloat(producto.precio_venta) || 0;
      const margenProducto = precioCompra > 0 
        ? (((precioVenta - precioCompra) / precioCompra) * 100).toFixed(2)
        : '0.00';

      const rowData = [
        safeText(producto.codigo),
        safeText(producto.nombre),
        producto.categorium ? safeText(producto.categorium.nombre) : "N/A",
        producto.marca ? safeText(producto.marca.nombre) : "N/A",
        producto.unidad_medida ? safeText(producto.unidad_medida.abreviatura || producto.unidad_medida.nombre) : "N/A",
        producto.stock || 0,
        producto.stock_minimo || 0,
        precioCompra,
        parseFloat(margenProducto),
        precioVenta,
        producto.estado === 1 ? "Activo" : "Inactivo"
      ];

      const row = sheet.addRow(rowData);
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(10).numFmt = '#,##0.00';
    });

    // Generar y enviar
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_inventario_${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Error en reporteInventarioXlsx:", error);
    res.status(500).send("Error al generar el reporte de inventario Excel: " + error.message);
  }
};

module.exports = {
  reporteInventario,
  reporteCatalogoProductos,
  reporteGananciasProducto,
  obtenerDatosInventario,
  reporteInventarioXlsx
};
