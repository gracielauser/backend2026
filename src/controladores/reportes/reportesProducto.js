const express = require("express");
const router = express.Router();
const { db } = require("../../config/dataBase");
const PdfPrinter = require("pdfmake");
const fonts = require("../../utils/pdfFonts");
const convertImageToBase64 = require("../../utils/imageToBase64");
const { Op, Sequelize, literal } = require("sequelize");

const reporteInventario = async (req, res) => {
  try {
    // Obtener todos los productos con sus relaciones
    const productosRaw = await db.producto.findAll({
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
        { text: "P. Venta", bold: true, fontSize: 9 },
        { text: "Estado", bold: true, fontSize: 9 }
      ]
    ];

    productos.forEach((producto) => {
      tableBody.push([
        { text: safeText(producto.codigo), fontSize: 8 },
        { text: safeText(producto.nombre), fontSize: 8 },
        { text: producto.categorium ? safeText(producto.categorium.nombre) : "N/A", fontSize: 8 },
        { text: producto.marca ? safeText(producto.marca.nombre) : "N/A", fontSize: 8 },
        { text: producto.unidad_medidum ? safeText(producto.unidad_medidum.abreviatura || producto.unidad_medidum.nombre) : "N/A", fontSize: 8 },
        { text: producto.stock || 0, fontSize: 8, alignment: 'center' },
        { text: producto.stock_minimo || 0, fontSize: 8, alignment: 'center' },
        { text: `$${formatMoney(producto.precio_compra)}`, fontSize: 8, alignment: 'right' },
        { text: `$${formatMoney(producto.precio_venta)}`, fontSize: 8, alignment: 'right' },
        { text: producto.estado === 1 ? "Activo" : "Inactivo", fontSize: 8, alignment: 'center' }
      ]);
    });

    // Calcular totales
    const totalProductos = productos.length;
    const totalStock = productos.reduce((sum, p) => sum + (p.stock || 0), 0);
    const valorInventarioCompra = productos.reduce((sum, p) => sum + ((p.stock || 0) * (p.precio_compra || 0)), 0);
    const valorInventarioVenta = productos.reduce((sum, p) => sum + ((p.stock || 0) * (p.precio_venta || 0)), 0);

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
                { text: `Total de Productos: ${totalProductos}`, style: 'subheader', alignment: 'center' }
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
          table: {
            headerRows: 1,
            widths: [40, '*', 60, 60, 40, 35, 35, 45, 45, 40],
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
        },
        { text: '\n' },
        {
          style: 'totales',
          table: {
            widths: ['*', 100],
            body: [
              [
                { text: 'Total de Productos:', bold: true },
                { text: totalProductos.toString(), alignment: 'right' }
              ],
              [
                { text: 'Total Unidades en Stock:', bold: true },
                { text: totalStock.toString(), alignment: 'right' }
              ],
              [
                { text: 'Valor Total Inventario (Precio Compra):', bold: true },
                { text: `$${formatMoney(valorInventarioCompra)}`, alignment: 'right', color: 'blue' }
              ],
              [
                { text: 'Valor Total Inventario (Precio Venta):', bold: true },
                { text: `$${formatMoney(valorInventarioVenta)}`, alignment: 'right', color: 'green' }
              ],
              [
                { text: 'Ganancia Potencial:', bold: true },
                { text: `$${formatMoney(valorInventarioVenta - valorInventarioCompra)}`, alignment: 'right', color: 'orange' }
              ]
            ]
          },
          layout: 'noBorders'
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

module.exports = {
  reporteInventario
};
