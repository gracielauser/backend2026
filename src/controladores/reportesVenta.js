const express = require("express");
const router = express.Router();
const { db } = require("../config/dataBase");
const PdfPrinter = require("pdfmake");
const fonts = require("../utils/pdfFonts");
const convertImageToBase64 = require("../utils/imageToBase64");

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

module.exports = {ventaNota };