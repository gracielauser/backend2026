const express = require("express");
const router = express.Router();
const { db } = require("../../config/dataBase");
const PdfPrinter = require("pdfmake");
const fonts = require("../../utils/pdfFonts");
const convertImageToBase64 = require("../../utils/imageToBase64");
const qrcode = require("qrcode");
const { sendPdfReport } = require("../../utils/auxiliares");
const { Op, Sequelize, literal } = require("sequelize");
const ExcelJS = require("exceljs");

const ventaNota = async (req, res) => {
  try {
    const id_venta = req.params.idVenta;
    // Parámetro 'nota' por query o body, por defecto false
    const nota = req.query.nota === "true" || req.body?.nota === true || false;

    if (!id_venta) return res.status(400).send("Falta id_venta");

    const ventaRaw = await db.venta.findByPk(id_venta, {
      include: [
        { model: db.cliente },
        {
          model: db.usuario,
          as: "usuario_registro",
          include: [{ model: db.empleado }],
        },
        { model: db.det_venta, include: [{ model: db.producto }] },
      ],
    });

    if (!ventaRaw) return res.status(404).send("Venta no encontrada");

    // convertir a objeto plano para evitar instancias Sequelize en el PDF
    const venta = ventaRaw.get ? ventaRaw.get({ plain: true }) : ventaRaw;

    // Decidir si generar nota o factura
    const enviarEmail =
      req.query.enviarEmail === "true" ||
      req.body?.enviarEmail === true ||
      false;
    if (nota) {
      // Generar nota de venta
      return await generarNotaVenta(venta, res);
    } else if (venta.tipo_venta === 2) {
      // Buscar factura asociada
      const facturaData = await db.factura.findOne({
        where: { id_venta: venta.id_venta },
      });
      // Generar factura boliviana
      return await generarFacturaBoliviana(
        enviarEmail,
        venta,
        facturaData,
        res,
      );
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
      venta.det_venta ||
      venta.det_ventas ||
      venta.detventas ||
      venta.detalles ||
      [];

    // helper para forzar texto
    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      )
        return String(v);
      // si es objeto tratar de sacar campos comunes
      if (typeof v === "object") {
        return (
          v.nombre ||
          v.NOMBRE ||
          v.usuario ||
          v.email ||
          v.id_usuario ||
          JSON.stringify(v)
        );
      }
      return String(v);
    };

    const printer = new PdfPrinter(fonts);
    const logo = await convertImageToBase64("../assets/logo2.jpeg");

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // tabla de items
    const itemsHeader = [
      { text: "Nro", bold: true },
      { text: "Producto", bold: true },
      { text: "Cantidad", bold: true, alignment: "right" },
      { text: "P.Unit", bold: true, alignment: "right" },
      { text: "SubTotal", bold: true, alignment: "right" },
    ];

    const itemsBody = detalles.map((d, i) => {
      const productoNombre = safeText(
        d.producto?.nombre || d.nombre || d.producto,
      );
      const cantidad = Number(d.cantidad || d.cant || 0) || 0;
      const precioUnit = Number(d.precio_unitario || d.precio || 0) || 0;
      const subtotalItem =
        Number(d.sub_total || d.subtotal) || cantidad * precioUnit;
      return [
        { text: String(i + 1) },
        productoNombre,
        { text: String(cantidad), alignment: "right" },
        { text: formatMoney(precioUnit), alignment: "right" },
        { text: formatMoney(subtotalItem), alignment: "right" },
      ];
    });

    const subtotal = detalles.reduce((acc, d) => {
      const cantidad = Number(d.cantidad || d.cant || 0) || 0;
      const precioUnit = Number(d.precio_unitario || d.precio || 0) || 0;
      const st = Number(d.sub_total || d.subtotal) || cantidad * precioUnit;
      return acc + st;
    }, 0);
    const descuento = Number(venta.descuento) || 0;
    const totalCalculado = subtotal - descuento;

    const docDefinition = {
      content: [
        {
          columns: [
            {
              stack: [
                { image: logo, width: 60 },
                {
                  text: "Auto Accesorios Pinedo",
                  bold: true,
                  fontSize: 11,
                  margin: [0, 8, 0, 2],
                },
                { text: "Av. Circunvalación & Timoteo Raña", fontSize: 8 },
                { text: "Tarija - Bolivia", fontSize: 8 },
                { text: "Tel: +591 71895925", fontSize: 8 },
              ],
              width: 160,
            },
            {
              stack: [
                { text: "NOTA DE VENTA", style: "title", alignment: "center" },
                {
                  text: `Nro: ${safeText(venta.nro_venta || venta.nro || "")}`,
                  alignment: "center",
                  margin: [0, 4, 0, 0],
                },
                {
                  text: `Fecha: ${safeText(venta.fecha_registro || venta.fecha || Date.now())}`,
                  alignment: "center",
                  margin: [0, 2, 0, 0],
                },
              ],
              width: "*",
            },
            {
              table: {
                body: [
                  [
                    {
                      text: "Vendedor",
                      bold: true,
                      border: [false, false, false, false],
                    },
                    {
                      text: safeText(
                        venta.usuario_registro?.empleado
                          ? `${venta.usuario_registro.empleado.nombre || ""} ${venta.usuario_registro.empleado.ap_paterno || ""} ${venta.usuario_registro.empleado.ap_materno || ""}`.trim()
                          : venta.usuario_registro?.usuario || "Sin usuario",
                      ),
                      border: [false, false, false, false],
                    },
                  ],
                  [
                    {
                      text: "Cliente",
                      bold: true,
                      border: [false, false, false, false],
                    },
                    {
                      text: safeText(
                        venta.cliente
                          ? `${venta.cliente.nombre_completo || ""}`.trim()
                          : "Sin cliente",
                      ),
                      border: [false, false, false, false],
                    },
                  ],
                  [
                    {
                      text: "CI/NIT",
                      bold: true,
                      border: [false, false, false, false],
                    },
                    {
                      text: safeText(
                        venta.cliente?.ci_nit || venta.cliente?.CI_NIT,
                      ),
                      border: [false, false, false, false],
                    },
                  ],
                  [
                    {
                      text: "Tel",
                      bold: true,
                      border: [false, false, false, false],
                    },
                    {
                      text: safeText(
                        venta.cliente?.celular || venta.cliente?.CELULAR,
                      ),
                      border: [false, false, false, false],
                    },
                  ],
                ],
              },
              layout: "noBorders",
              width: 220,
            },
          ],
        },
        { text: "\n" },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "*", "auto", "auto", "auto"],
            body: [itemsHeader, ...itemsBody],
          },
          layout: "lightHorizontalLines",
        },
        {
          columns: [
            { width: "*", text: "" },
            {
              width: 220,
              table: {
                body: [
                  [
                    { text: "Subtotal", alignment: "left" },
                    { text: formatMoney(subtotal), alignment: "right" },
                  ],
                  [
                    { text: "Descuento", alignment: "left" },
                    { text: formatMoney(descuento), alignment: "right" },
                  ],
                  [
                    { text: "Total", bold: true, alignment: "left" },
                    {
                      text: formatMoney(totalCalculado),
                      bold: true,
                      alignment: "right",
                    },
                  ],
                ],
              },
              layout: "noBorders",
            },
          ],
        },
        { text: "\n" },
        {
          text: `Observaciones: ${safeText(venta.descripcion || venta.DESCRIPCION || "")}`,
          italics: true,
        },
        {
          text: "Gracias por su preferencia.",
          alignment: "center",
          margin: [0, 10, 0, 0],
          italics: true,
        },
      ],
      styles: {
        title: { fontSize: 16, bold: true },
      },
      defaultStyle: {
        font: "Roboto",
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on("data", (c) => chunks.push(c));
    pdfDoc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename=nota_venta_${safeText(venta.nro_venta || venta.id_venta)}.pdf`,
      );
      res.send(pdfBuffer);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Función auxiliar para generar Factura Boliviana
const generarFacturaBoliviana = async (
  enviarEmail = false,
  venta,
  factura,
  res,
) => {
  try {
    // normalizar nombre de la colección de detalles
    const detalles =
      venta.det_venta ||
      venta.det_ventas ||
      venta.detventas ||
      venta.detalles ||
      [];

    // helper para forzar texto
    const safeText = (v) => {
      if (v === undefined || v === null) return "";
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      )
        return String(v);
      if (typeof v === "object") {
        return (
          v.nombre ||
          v.NOMBRE ||
          v.usuario ||
          v.email ||
          v.id_usuario ||
          JSON.stringify(v)
        );
      }
      return String(v);
    };

    const printer = new PdfPrinter(fonts);
    const logo = await convertImageToBase64("../assets/logo2.jpeg");

    const formatMoney = (n) =>
      typeof n === "number" ? n.toFixed(2) : (Number(n) || 0).toFixed(2);

    // Datos de la empresa emisora (placeholders - ajustar según necesidad)
    const empresaNIT = "1234567890"; // NIT de la empresa
    const empresaNombre = "Auto Accesorios Pinedo";
    const empresaDireccion =
      "Av. Circunvalación & Timoteo Raña, Tarija - Bolivia";
    const empresaTelefono = "+591 71895925";

    // Calcular totales primero (necesarios para código de control)
    const subtotal = detalles.reduce((acc, d) => {
      const cantidad = Number(d.cantidad || d.cant || 0) || 0;
      const precioUnit = Number(d.precio_unitario || d.precio || 0) || 0;
      const st = Number(d.sub_total || d.subtotal) || cantidad * precioUnit;
      return acc + st;
    }, 0);
    const descuento = Number(venta.descuento) || 0;
    const totalCalculado = subtotal - descuento;
    const impuesto = Number(factura?.impuesto) || 0;
    const totalConImpuesto = totalCalculado;

    // Datos de factura (con placeholders si no existen en BD)
    const nroFactura = factura?.nro_factura || venta.nro_venta || "0";
    const codigoAutorizacion = "79040011007"; // Placeholder - debe venir de sistema de impuestos
    // const fechaLimiteEmision = "31/12/2026"; // Placeholder
    const codigoControl = generarCodigoControl(
      nroFactura,
      empresaNIT,
      new Date(venta.fecha_registro || Date.now()),
      totalCalculado,
    ); // Generar código de control

    // Cliente
    const clienteNombre = venta.cliente
      ? `${venta.cliente.nombre || ""} ${venta.cliente.ap_paterno || ""} ${venta.cliente.ap_materno || ""}`.trim()
      : "S/N";
    const clienteNIT = venta.cliente?.ci_nit || "0";

    // tabla de items
    const itemsHeader = [
      { text: "Nro", bold: true, alignment: "center", fillColor: "#eeeeee" },
      { text: "Producto", bold: true, fillColor: "#eeeeee" },
      {
        text: "Cantidad",
        bold: true,
        alignment: "center",
        fillColor: "#eeeeee",
      },
      {
        text: "P. Unitario",
        bold: true,
        alignment: "right",
        fillColor: "#eeeeee",
      },
      {
        text: "Subtotal",
        bold: true,
        alignment: "right",
        fillColor: "#eeeeee",
      },
    ];

    const itemsBody = detalles.map((d, i) => {
      const productoNombre = safeText(
        d.producto?.nombre || d.nombre || d.producto,
      );
      const cantidad = Number(d.cantidad || d.cant || 0) || 0;
      const precioUnit = Number(d.precio_unitario || d.precio || 0) || 0;
      const subtotalItem =
        Number(d.sub_total || d.subtotal) || cantidad * precioUnit;
      return [
        { text: String(i + 1), alignment: "center" },
        productoNombre,
        { text: String(cantidad), alignment: "center" },
        { text: formatMoney(precioUnit), alignment: "right" },
        { text: formatMoney(subtotalItem), alignment: "right" },
      ];
    });

    // Convertir monto a literal
    const montoLiteral = numeroALiteral(totalCalculado);

    // Generar datos para QR (formato boliviano)
    const fechaFormateada = new Date(venta.fecha_registro || Date.now())
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "/");
    const qrData = `https://www.impuestos.gob.bo/`;

    const docDefinition = {
      pageSize: "LETTER",
      pageMargins: [40, 40, 40, 40],
      content: [
        // Encabezado
        {
          columns: [
            {
              stack: [
                { image: logo, width: 70 },
                {
                  text: empresaNombre,
                  fontSize: 12,
                  bold: true,
                  margin: [0, 5, 0, 0],
                },
                { text: `Casa Matriz`, fontSize: 8 },
                { text: `NIT: ${empresaNIT}`, fontSize: 8 },
                { text: empresaDireccion, fontSize: 8 },
                { text: `Tel: ${empresaTelefono}`, fontSize: 8 },
              ],
              width: "*",
            },
            {
              stack: [
                {
                  text: "FACTURA",
                  fontSize: 18,
                  bold: true,
                  alignment: "right",
                },
                {
                  text: `Nº ${String(nroFactura).padStart(10, "0")}`,
                  fontSize: 14,
                  bold: true,
                  alignment: "right",
                  margin: [0, 2, 0, 0],
                },
                {
                  text: `ORIGINAL`,
                  fontSize: 10,
                  alignment: "right",
                  margin: [0, 5, 0, 5],
                  italics: true,
                },
              ],
              width: 200,
            },
          ],
        },

        // Línea separadora
        {
          canvas: [
            { type: "line", x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 },
          ],
          margin: [0, 10, 0, 10],
        },

        // Datos de autorización
        {
          columns: [
            {
              stack: [
                {
                  text: `Nº de Autorización: ${codigoAutorizacion}`,
                  fontSize: 8,
                },
                {
                  text: `Código de Control: ${codigoControl}`,
                  fontSize: 8,
                  margin: [0, 2, 0, 0],
                },
                // { text: `Fecha Límite de Emisión: ${fechaLimiteEmision}`, fontSize: 8, margin: [0, 2, 0, 0] }
              ],
              width: "*",
            },
          ],
          margin: [0, 0, 0, 10],
        },

        // Datos del cliente y fecha
        {
          table: {
            widths: [80, "*", 80, 100],
            body: [
              [
                {
                  text: "Fecha:",
                  bold: true,
                  border: [true, true, false, true],
                },
                {
                  text: safeText(venta.fecha_registro || Date.now()),
                  border: [false, true, true, true],
                },
                {
                  text: "NIT/CI:",
                  bold: true,
                  border: [true, true, false, true],
                },
                { text: clienteNIT, border: [false, true, true, true] },
              ],
              [
                {
                  text: "Señor(es):",
                  bold: true,
                  border: [true, true, false, true],
                },
                {
                  text: clienteNombre,
                  colSpan: 3,
                  border: [false, true, true, true],
                },
                {},
                {},
              ],
            ],
          },
          layout: {
            hLineWidth: () => 1,
            vLineWidth: () => 1,
          },
          margin: [0, 0, 0, 10],
        },

        // Tabla de productos
        {
          table: {
            headerRows: 1,
            widths: [30, "*", 50, 70, 70],
            body: [itemsHeader, ...itemsBody],
          },
          layout: {
            hLineWidth: (i, node) =>
              i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
            vLineWidth: () => 1,
          },
        },

        // Totales
        {
          columns: [
            {
              stack: [
                {
                  text: "Son: ",
                  bold: true,
                  fontSize: 9,
                  margin: [0, 10, 0, 0],
                },
                { text: montoLiteral, fontSize: 8, italics: true },
              ],
              width: "*",
            },
            {
              width: 200,
              table: {
                widths: ["*", 80],
                body: [
                  [
                    { text: "SUBTOTAL Bs", alignment: "right" },
                    { text: formatMoney(subtotal), alignment: "right" },
                  ],
                  [
                    { text: "DESCUENTO Bs", alignment: "right" },
                    { text: formatMoney(descuento), alignment: "right" },
                  ],
                  [
                    { text: "IMPORTE BASE Bs", alignment: "right", bold: true },
                    {
                      text: formatMoney(totalCalculado),
                      alignment: "right",
                      bold: true,
                    },
                  ],
                  [
                    {
                      text: "TOTAL Bs",
                      alignment: "right",
                      bold: true,
                      fontSize: 11,
                    },
                    {
                      text: formatMoney(totalCalculado),
                      alignment: "right",
                      bold: true,
                      fontSize: 11,
                    },
                  ],
                ],
              },
              layout: "noBorders",
              margin: [0, 5, 0, 0],
            },
          ],
        },

        // Leyenda legal
        {
          stack: [
            { text: "\n\n" },
            {
              text: "ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS. EL USO ILÍCITO DE ÉSTA SERÁ SANCIONADO DE ACUERDO A LEY",
              fontSize: 7,
              alignment: "center",
              bold: true,
              margin: [0, 10, 0, 5],
            },
            {
              text: "Ley Nº 453: El proveedor deberá exhibir certificaciones de homologación del producto y documentación técnica respaldatoria.",
              fontSize: 6,
              alignment: "center",
              margin: [0, 5, 0, 0],
            },
            {
              text: `"Este documento es la Representación Gráfica de un Documento Fiscal Digital emitido en una modalidad de facturación en línea"`,
              fontSize: 6,
              alignment: "center",
              italics: true,
              margin: [0, 5, 0, 0],
            },
          ],
        },

        // Código QR
        {
          qr: qrData,
          fit: 100,
          alignment: "center",
          margin: [0, 20, 0, 0],
        },
      ],
      styles: {
        title: { fontSize: 16, bold: true },
      },
      defaultStyle: {
        font: "Roboto",
        fontSize: 9,
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on("data", (c) => chunks.push(c));
    pdfDoc.on("end", async () => {
      const pdfBuffer = Buffer.concat(chunks);

      // Enviar por email si se solicitó y el cliente tiene email
      if (enviarEmail && venta.cliente?.email) {
        try {
          await sendPdfReport({
            to: venta.cliente.email,
            subject: `Factura Nº ${String(nroFactura).padStart(10, "0")} - Auto Accesorios Pinedo`,
            text: `Estimado/a ${clienteNombre},\n\nAdjunto encontrará su factura Nº ${String(nroFactura).padStart(10, "0")}.\n\nGracias por su preferencia.\nAuto Accesorios Pinedo`,
            filename: `factura_${String(nroFactura).padStart(10, "0")}.pdf`,
            pdfBuffer,
          });
        } catch (mailErr) {
          console.error("Error al enviar email de factura:", mailErr.message);
        }
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename=factura_${String(nroFactura).padStart(10, "0")}.pdf`,
      );
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
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash)
    .toString(16)
    .toUpperCase()
    .substring(0, 13)
    .padStart(13, "0");
};

// Helper para convertir número a literal (español)
const numeroALiteral = (numero) => {
  const unidades = [
    "",
    "UN",
    "DOS",
    "TRES",
    "CUATRO",
    "CINCO",
    "SEIS",
    "SIETE",
    "OCHO",
    "NUEVE",
  ];
  const decenas = [
    "",
    "",
    "VEINTE",
    "TREINTA",
    "CUARENTA",
    "CINCUENTA",
    "SESENTA",
    "SETENTA",
    "OCHENTA",
    "NOVENTA",
  ];
  const centenas = [
    "",
    "CIENTO",
    "DOSCIENTOS",
    "TRESCIENTOS",
    "CUATROCIENTOS",
    "QUINIENTOS",
    "SEISCIENTOS",
    "SETECIENTOS",
    "OCHOCIENTOS",
    "NOVECIENTOS",
  ];
  const especiales = [
    "DIEZ",
    "ONCE",
    "DOCE",
    "TRECE",
    "CATORCE",
    "QUINCE",
    "DIECISEIS",
    "DIECISIETE",
    "DIECIOCHO",
    "DIECINUEVE",
  ];

  const convertirGrupo = (n) => {
    if (n === 0) return "";
    if (n < 10) return unidades[n];
    if (n >= 10 && n < 20) return especiales[n - 10];
    if (n >= 20 && n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return decenas[d] + (u > 0 ? ` Y ${unidades[u]}` : "");
    }
    if (n >= 100 && n < 1000) {
      const c = Math.floor(n / 100);
      const resto = n % 100;
      let resultado = n === 100 ? "CIEN" : centenas[c];
      if (resto > 0) resultado += ` ${convertirGrupo(resto)}`;
      return resultado;
    }
    return "";
  };

  let parteEntera = Math.floor(numero);
  const parteDecimal = Math.round((numero - parteEntera) * 100);

  if (parteEntera === 0) {
    return `CERO ${parteDecimal}/100 BOLIVIANOS`;
  }

  let literal = "";

  if (parteEntera >= 1000000) {
    const millones = Math.floor(parteEntera / 1000000);
    literal +=
      convertirGrupo(millones) + (millones === 1 ? " MILLON " : " MILLONES ");
    parteEntera = parteEntera % 1000000;
  }

  if (parteEntera >= 1000) {
    const miles = Math.floor(parteEntera / 1000);
    if (miles === 1) {
      literal += "MIL ";
    } else {
      literal += convertirGrupo(miles) + " MIL ";
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
  return n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Helper para formatear fecha al formato '23 Mar 2026 hh:mm:ss'
const formatFecha = (fecha) => {
  if (!fecha) return "";
  const meses = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const d = new Date(fecha);
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const anio = d.getFullYear();
  const horas = String(d.getHours()).padStart(2, "0");
  const minutos = String(d.getMinutes()).padStart(2, "0");
  const segundos = String(d.getSeconds()).padStart(2, "0");
  return `${dia} ${mes} ${anio} ${horas}:${minutos}:${segundos}`;
};

// Helper para construir fila de venta en PDF
const buildVentaRowPdf = (venta, counter, orden) => {
  const row = [];

  // Nro
  row.push({ text: String(counter), fontSize: 8 });

  // Nro Venta
  row.push({ text: String(venta.nro_venta || ""), fontSize: 8 });

  // Usuario (si no está agrupado por usuario)
  if (orden !== "usuario") {
    const usr = venta.usuario;
    const nombreUsuario = usr?.empleado
      ? `${usr.empleado.nombre || ""} ${usr.empleado.ap_paterno || ""}`.trim()
      : usr?.usuario || usr?.nombre_usuario || "Sin usuario";
    row.push({ text: nombreUsuario, fontSize: 8 });
  }

  // Fecha
  row.push({ text: formatFecha(venta.fecha_registro), fontSize: 8 });

  // Cliente (si no está agrupado por cliente)
  if (orden !== "cliente") {
    const cli = venta.cliente;
    const nombreCliente = cli
      ? `${cli.nombre_completo || ""}`.trim() || "Sin cliente"
      : "Sin cliente";
    row.push({ text: nombreCliente, fontSize: 8 });
  }

  // Tipo venta (si no está agrupado por tipo_venta) — viene como string del frontend
  if (orden !== "tipo_venta") {
    let tipoVentaText = venta.tipo_venta || "Normal";
    if (
      (venta.tipo_venta === "Facturado" || venta.tipo_venta_valor === 2) &&
      venta.nro_factura
    ) {
      tipoVentaText = `Facturado Nro. ${venta.nro_factura}`;
    }
    row.push({
      text: tipoVentaText,
      fontSize: 8,
      fillColor: venta.nro_factura ? "#d4edda" : undefined,
    });
  }

  // Monto
  const monto = parseFloat(venta.monto_total) || 0;
  row.push({ text: formatNumber(monto), alignment: "right", fontSize: 8 });

  // Descuento
  const descuento = parseFloat(venta.descuento) || 0;
  row.push({ text: formatNumber(descuento), alignment: "right", fontSize: 8 });

  // Total (ya viene calculado)
  const total = parseFloat(venta.total) ?? monto - descuento;
  row.push({
    text: formatNumber(total),
    alignment: "right",
    fontSize: 8,
    bold: true,
  });

  // Tipo de pago — viene como string del frontend
  row.push({
    text: venta.tipo_pago || "Efectivo",
    fontSize: 8,
    alignment: "center",
  });

  // Ganancia neta
  const ganancia = parseFloat(venta.ganancia_neta) || 0;
  row.push({
    text: venta.estado_valor === 1 ? formatNumber(ganancia) : "-",
    fontSize: 8,
    alignment: "right",
    bold: ganancia > 0,
    color: ganancia > 0 ? "#2e7d32" : ganancia < 0 ? "#c62828" : undefined,
  });

  // Estado — si está anulada, mostrar quien anuló
  const estadoColor = venta.estado_valor === 1 ? "#00aa00" : "#aa0000";
  let estadoTexto = venta.estado || "N/A";
  if (venta.estado_valor === 2 && venta.usuario_anulador) {
    estadoTexto = `Anulada por ${venta.usuario_anulador.usuario || "desconocido"}`;
  }
  row.push({
    text: estadoTexto,
    fontSize: 8,
    alignment: "center",
    color: estadoColor,
  });

  return row;
};

// Reporte de ventas RESUMIDO con filtros y agrupación
const reporteVentasResumido = async (req, res) => {
  try {
    const {
      filtros = {},
      lista = [],
      nombreSistema = "Auto Accesorios Pinedo",
      orden = null,
      usuario = "",
    } = req.body || {};

    const {
      desde,
      hasta,
      tipo_venta,
      estado,
      tipo_pago,
      id_cliente,
      id_usuario,
      busqueda,
    } = filtros;

    console.log("Reporte de ventas resumido - parámetros:", req.body);

    // Buscar nombres de cliente y usuario para filtros
    let nombreClienteFiltro = null;
    let nombreUsuarioFiltro = null;

    if (id_cliente) {
      const clienteObj = await db.cliente
        .findByPk(id_cliente)
        .catch(() => null);
      if (clienteObj) {
        nombreClienteFiltro =
          `${clienteObj.nombre || ""} ${clienteObj.ap_paterno || ""} ${clienteObj.ap_materno || ""}`.trim();
      }
    }

    if (id_usuario) {
      const usuarioObj = await db.usuario
        .findByPk(id_usuario)
        .catch(() => null);
      if (usuarioObj) {
        nombreUsuarioFiltro = usuarioObj.usuario || `Usuario ${id_usuario}`;
      }
    }

    // Totales desde la lista (solo ventas incluidas en totales)
    const totalVentas = lista
      .filter((v) => v.incluida_en_totales)
      .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

    // Total de ventas anuladas
    const totalVentasAnuladas = lista
      .filter((v) => v.estado_valor === 2)
      .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

    // La lista del frontend ya viene filtrada
    const ventas = lista;

    // Buscar usuarios anuladores para ventas anuladas
    for (const venta of ventas) {
      if (venta.estado_valor === 2) {
        const ventaDB = await db.venta
          .findOne({
            where: { id_venta: venta.id_venta },
            include: [{ model: db.usuario, as: "usuario_anulador" }],
          })
          .catch(() => null);
        if (ventaDB && ventaDB.usuario_anulador) {
          venta.usuario_anulador = ventaDB.usuario_anulador;
        }
      }
    }

    // Buscar facturas para ventas tipo "Facturado"
    for (const venta of ventas) {
      if (venta.tipo_venta === "Facturado" || venta.tipo_venta_valor === 2) {
        const factura = await db.factura
          .findOne({
            where: { id_venta: venta.id_venta },
          })
          .catch(() => null);
        if (factura) {
          venta.nro_factura = factura.nro_factura;
        }
      }
    }

    // Construir tabla
    const body = [];
    const headerRow = [];
    headerRow.push({ text: "Nro", bold: true, fillColor: "#dff2e6" });
    headerRow.push({ text: "Nro Venta", bold: true, fillColor: "#dff2e6" });
    if (orden !== "usuario")
      headerRow.push({ text: "Usuario", bold: true, fillColor: "#dff2e6" });
    headerRow.push({ text: "Fecha", bold: true, fillColor: "#dff2e6" });
    if (orden !== "cliente")
      headerRow.push({ text: "Cliente", bold: true, fillColor: "#dff2e6" });
    if (orden !== "tipo_venta")
      headerRow.push({ text: "Tipo", bold: true, fillColor: "#dff2e6" });
    headerRow.push({
      text: "Monto",
      bold: true,
      alignment: "right",
      fillColor: "#dff2e6",
    });
    headerRow.push({
      text: "Desc",
      bold: true,
      alignment: "right",
      fillColor: "#dff2e6",
    });
    headerRow.push({
      text: "Total",
      bold: true,
      alignment: "right",
      fillColor: "#dff2e6",
    });
    headerRow.push({
      text: "Tipo Pago",
      bold: true,
      alignment: "center",
      fillColor: "#dff2e6",
    });
    headerRow.push({
      text: "Ganancia",
      bold: true,
      alignment: "right",
      fillColor: "#dff2e6",
    });
    headerRow.push({
      text: "Estado",
      bold: true,
      alignment: "center",
      fillColor: "#dff2e6",
    });
    body.push(headerRow);

    const numCols = headerRow.length;
    let counter = 1;

    // Si orden es null, solo listar sin agrupar
    if (orden === null || orden === undefined || orden === "") {
      for (const v of ventas) {
        body.push(buildVentaRowPdf(v, counter, orden));
        counter++;
      }
    } else if (orden === "cliente") {
      // Agrupar por cliente
      const byCliente = {};
      for (const v of ventas) {
        const cid = v.cliente?.id_cliente || "sin";
        if (!byCliente[cid]) byCliente[cid] = [];
        byCliente[cid].push(v);
      }

      for (const [cid, ventasCli] of Object.entries(byCliente)) {
        if (!ventasCli.length) continue;

        let nombreCliente = "Sin cliente";
        if (cid !== "sin") {
          const cli = ventasCli[0].cliente;
          nombreCliente = cli
            ? `${cli.nombre_completo || ""}`.trim() || `Cliente ${cid}`
            : `Cliente ${cid}`;
        }

        const groupHeader = [
          {
            text: nombreCliente,
            colSpan: numCols,
            bold: true,
            fillColor: "#eaf7ef",
          },
        ];
        for (let i = 1; i < numCols; i++) groupHeader.push({});
        body.push(groupHeader);

        for (const v of ventasCli) {
          body.push(buildVentaRowPdf(v, counter, orden));
          counter++;
        }

        const clienteTotal = ventasCli
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
        const clienteGanancia = ventasCli
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.ganancia_neta) || 0), 0);

        const totalRow = [];
        for (let i = 0; i < numCols; i++) {
          if (i === numCols - 6)
            totalRow.push({
              text: `Total ${nombreCliente}`,
              bold: true,
              fillColor: "#dff2e6",
            });
          else if (i === numCols - 4)
            totalRow.push({
              text: formatNumber(clienteTotal),
              alignment: "right",
              bold: true,
              fillColor: "#dff2e6",
            });
          else if (i === numCols - 2)
            totalRow.push({
              text: formatNumber(clienteGanancia),
              alignment: "right",
              bold: true,
              fillColor: "#d5f5e3",
              color: "#1a5276",
            });
          else
            totalRow.push({
              text: "",
              fillColor:
                i === numCols - 6 || i === numCols - 4 ? "#dff2e6"
                : i === numCols - 2 ? "#d5f5e3" : undefined,
            });
        }
        body.push(totalRow);
      }
    } else if (orden === "usuario") {
      // Agrupar por usuario
      const byUsuario = {};
      for (const v of ventas) {
        const uid = v.usuario?.id_usuario || "sin";
        if (!byUsuario[uid]) byUsuario[uid] = [];
        byUsuario[uid].push(v);
      }

      for (const [uid, ventasUsr] of Object.entries(byUsuario)) {
        if (!ventasUsr.length) continue;

        let nombreUsuario = "Sin usuario";
        if (uid !== "sin") {
          const usr = ventasUsr[0].usuario;
          nombreUsuario = usr?.empleado
            ? `${usr.empleado.nombre || ""} ${usr.empleado.ap_paterno || ""}`.trim()
            : usr?.usuario || `Usuario ${uid}`;
        }

        const groupHeader = [
          {
            text: nombreUsuario,
            colSpan: numCols,
            bold: true,
            fillColor: "#eaf7ef",
          },
        ];
        for (let i = 1; i < numCols; i++) groupHeader.push({});
        body.push(groupHeader);

        for (const v of ventasUsr) {
          body.push(buildVentaRowPdf(v, counter, orden));
          counter++;
        }

        const usuarioTotal = ventasUsr
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
        const usuarioGanancia = ventasUsr
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.ganancia_neta) || 0), 0);

        const totalRow = [];
        for (let i = 0; i < numCols; i++) {
          if (i === numCols - 6)
            totalRow.push({
              text: `Total ${nombreUsuario}`,
              bold: true,
              fillColor: "#dff2e6",
            });
          else if (i === numCols - 4)
            totalRow.push({
              text: formatNumber(usuarioTotal),
              alignment: "right",
              bold: true,
              fillColor: "#dff2e6",
            });
          else if (i === numCols - 2)
            totalRow.push({
              text: formatNumber(usuarioGanancia),
              alignment: "right",
              bold: true,
              fillColor: "#d5f5e3",
              color: "#1a5276",
            });
          else
            totalRow.push({
              text: "",
              fillColor:
                i === numCols - 6 || i === numCols - 4 ? "#dff2e6"
                : i === numCols - 2 ? "#d5f5e3" : undefined,
            });
        }
        body.push(totalRow);
      }
    } else if (orden === "tipo_venta") {
      // Agrupar por tipo de venta
      const byTipo = {};
      for (const v of ventas) {
        const tid = v.tipo_venta_valor || 1;
        if (!byTipo[tid]) byTipo[tid] = [];
        byTipo[tid].push(v);
      }

      for (const [tid, ventasTipo] of Object.entries(byTipo)) {
        if (!ventasTipo.length) continue;

        const nombreTipo =
          ventasTipo[0]?.tipo_venta || (tid == 2 ? "Facturado" : "Normal");

        const groupHeader = [
          {
            text: nombreTipo,
            colSpan: numCols,
            bold: true,
            fillColor: "#eaf7ef",
          },
        ];
        for (let i = 1; i < numCols; i++) groupHeader.push({});
        body.push(groupHeader);

        for (const v of ventasTipo) {
          body.push(buildVentaRowPdf(v, counter, orden));
          counter++;
        }

        const tipoTotal = ventasTipo
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
        const tipoGanancia = ventasTipo
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.ganancia_neta) || 0), 0);

        const totalRow = [];
        for (let i = 0; i < numCols; i++) {
          if (i === numCols - 6)
            totalRow.push({
              text: `Total ${nombreTipo}`,
              bold: true,
              fillColor: "#dff2e6",
            });
          else if (i === numCols - 4)
            totalRow.push({
              text: formatNumber(tipoTotal),
              alignment: "right",
              bold: true,
              fillColor: "#dff2e6",
            });
          else if (i === numCols - 2)
            totalRow.push({
              text: formatNumber(tipoGanancia),
              alignment: "right",
              bold: true,
              fillColor: "#d5f5e3",
              color: "#1a5276",
            });
          else
            totalRow.push({
              text: "",
              fillColor:
                i === numCols - 6 || i === numCols - 4 ? "#dff2e6"
                : i === numCols - 2 ? "#d5f5e3" : undefined,
            });
        }
        body.push(totalRow);
      }
    }

    // Resumen global
    const separatorRow = [];
    for (let i = 0; i < numCols; i++) {
      separatorRow.push({ text: "", border: [false, true, false, false] });
    }
    body.push(separatorRow);

    // Calcular totales por método de pago y ganancia (solo ventas incluidas en totales)
    let totalEfectivo = 0;
    let totalQR = 0;
    let totalGanancia = 0;
    for (const v of ventas) {
      if (!v.incluida_en_totales) continue;
      const totalVenta = parseFloat(v.total) || 0;
      totalGanancia += parseFloat(v.ganancia_neta) || 0;
      if (v.tipo_pago_valor === 2) {
        totalQR += totalVenta;
      } else {
        totalEfectivo += totalVenta;
      }
    }

    // Total por método de pago - Efectivo
    // Columnas: ..., Monto(n-6), Desc(n-5), Total(n-4), TipoPago(n-3), Ganancia(n-2), Estado(n-1)
    const totalEfectivoRow = [];
    for (let i = 0; i < numCols; i++) {
      if (i === numCols - 5)
        totalEfectivoRow.push({
          text: "Total Efectivo",
          bold: true,
          fillColor: "#e8f5e9",
          color: "#388e3c",
        });
      else if (i === numCols - 4)
        totalEfectivoRow.push({
          text: formatNumber(totalEfectivo),
          alignment: "right",
          bold: true,
          fillColor: "#e8f5e9",
          color: "#388e3c",
        });
      else
        totalEfectivoRow.push({
          text: "",
          fillColor:
            i === numCols - 5 || i === numCols - 4 ? "#e8f5e9" : undefined,
        });
    }
    body.push(totalEfectivoRow);

    // Total por método de pago - QR
    const totalQRRow = [];
    for (let i = 0; i < numCols; i++) {
      if (i === numCols - 5)
        totalQRRow.push({
          text: "Total QR",
          bold: true,
          fillColor: "#e8f5e9",
          color: "#1976d2",
        });
      else if (i === numCols - 4)
        totalQRRow.push({
          text: formatNumber(totalQR),
          alignment: "right",
          bold: true,
          fillColor: "#e8f5e9",
          color: "#1976d2",
        });
      else
        totalQRRow.push({
          text: "",
          fillColor:
            i === numCols - 5 || i === numCols - 4 ? "#e8f5e9" : undefined,
        });
    }
    body.push(totalQRRow);

    // Línea separadora antes del total general
    const separatorRow2 = [];
    for (let i = 0; i < numCols; i++) {
      separatorRow2.push({ text: "", border: [false, true, false, false] });
    }
    body.push(separatorRow2);

    // Total general + ganancia total
    const totalGlobalRow = [];
    for (let i = 0; i < numCols; i++) {
      if (i === numCols - 5)
        totalGlobalRow.push({
          text: "TOTAL GENERAL",
          bold: true,
          fillColor: "#aed6f1",
        });
      else if (i === numCols - 4)
        totalGlobalRow.push({
          text: formatNumber(totalVentas),
          alignment: "right",
          bold: true,
          fillColor: "#aed6f1",
          fontSize: 10,
        });
      else if (i === numCols - 2)
        totalGlobalRow.push({
          text: formatNumber(totalGanancia),
          alignment: "right",
          bold: true,
          fillColor: "#d5f5e3",
          color: "#1a5276",
          fontSize: 10,
        });
      else
        totalGlobalRow.push({
          text: "",
          fillColor:
            i === numCols - 5 || i === numCols - 4 ? "#aed6f1"
            : i === numCols - 2 ? "#d5f5e3" : undefined,
        });
    }
    body.push(totalGlobalRow);

    // Total de ventas anuladas (si hay)
    if (totalVentasAnuladas > 0) {
      const totalAnuladasRow = [];
      for (let i = 0; i < numCols; i++) {
        if (i === numCols - 5)
          totalAnuladasRow.push({
            text: "TOTAL ANULADAS",
            bold: true,
            fillColor: "#ffebee",
            color: "#c62828",
          });
        else if (i === numCols - 4)
          totalAnuladasRow.push({
            text: formatNumber(totalVentasAnuladas),
            alignment: "right",
            bold: true,
            fillColor: "#ffebee",
            color: "#c62828",
          });
        else
          totalAnuladasRow.push({
            text: "",
            fillColor:
              i === numCols - 5 || i === numCols - 4 ? "#ffebee" : undefined,
          });
      }
      body.push(totalAnuladasRow);
    }

    // Configurar anchos de columna para aprovechar todo el ancho de la hoja
    const colWidths = [];
    colWidths.push(25); // Nro
    colWidths.push(45); // Nro Venta
    if (orden !== "usuario") colWidths.push("*"); // Usuario
    colWidths.push(95); // Fecha
    if (orden !== "cliente") colWidths.push("*"); // Cliente
    if (orden !== "tipo_venta") colWidths.push(55); // Tipo
    colWidths.push(60); // Monto
    colWidths.push(45); // Desc
    colWidths.push(60); // Total
    colWidths.push(45); // Tipo Pago
    colWidths.push(60); // Ganancia
    colWidths.push(45); // Estado

    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64("../assets/logo2.jpeg");

    const filtroLines = [];
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    if (estado) filtroLines.push(`Estado: ${estado}`);
    if (tipo_venta) filtroLines.push(`Tipo venta: ${tipo_venta}`);
    if (tipo_pago) filtroLines.push(`Tipo pago: ${tipo_pago}`);
    if (id_cliente && nombreClienteFiltro)
      filtroLines.push(`Cliente: ${nombreClienteFiltro}`);
    if (id_usuario && nombreUsuarioFiltro)
      filtroLines.push(`Usuario registro: ${nombreUsuarioFiltro}`);
    if (busqueda) filtroLines.push(`Búsqueda: ${busqueda}`);
    if (!filtroLines.length) filtroLines.push("Sin filtros aplicados");

    const encabezadoCols = [
      { image: logo, width: 70 },
      {
        stack: [
          { text: "Reporte de ventas - RESUMIDO", style: "titulo" },
          ...filtroLines.map((l) => ({ text: l, style: "filtro" })),
        ],
        margin: [10, 0, 0, 0],
        width: "*",
      },
      {
        stack: [
          {
            text: `Generado por: ${usuario || "desconocido"}`,
            alignment: "right",
          },
          {
            text: `Sistema: ${nombreSistema || "Auto Accesorios Pinedo"}`,
            alignment: "right",
          },
          {
            text: `Fecha: ${new Date().toLocaleString("es-BO")}`,
            alignment: "right",
          },
        ],
        width: 160,
      },
    ];

    const docDefinition = {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [36, 110, 36, 54],
      header: { margin: [40, 40, 40, 40], columns: encabezadoCols },
      defaultStyle: { fontSize: 9 },
      content: [
        { text: "\n" },
        {
          table: { headerRows: 1, widths: colWidths, body: body },
          layout: {
            hLineWidth: function (i, node) {
              return i === 0 || i === node.table.body.length ? 0 : 0.5;
            },
            vLineWidth: function (i, node) {
              return 0;
            },
            hLineColor: function (i, node) {
              return "#CCCCCC";
            },
          },
          margin: [0, 20, 0, 0],
        },
      ],
      footer: (currentPage, pageCount) => ({
        columns: [
          {
            text: `Generado: ${new Date().toLocaleString("es-BO")} por: ${usuario || "desconocido"}`,
            alignment: "left",
            margin: [40, 0, 0, 0],
          },
          {
            text: `${nombreSistema || "Auto Accesorios Pinedo"} - Página ${currentPage} de ${pageCount}`,
            alignment: "right",
            margin: [0, 0, 40, 0],
          },
        ],
      }),
      styles: { titulo: { fontSize: 16, bold: true }, filtro: { fontSize: 8 } },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on("data", (c) => chunks.push(c));
    pdfDoc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "inline; filename=ventas_reporte_resumido.pdf",
      );
      res.send(pdfBuffer);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al generar PDF de ventas resumido");
  }
};

// Reporte de ventas DETALLADO con productos
const reporteVentasDetallado = async (req, res) => {
  try {
    const {
      filtros = {},
      lista = [],
      nombreSistema = "Auto Accesorios Pinedo",
      usuario = "",
    } = req.body || {};

    const {
      desde,
      hasta,
      tipo_venta,
      estado,
      tipo_pago,
      id_cliente,
      id_usuario,
      busqueda,
    } = filtros;

    console.log("Reporte de ventas detallado - parámetros:", req.body);

    // Buscar nombres de cliente y usuario para filtros
    let nombreClienteFiltro = null;
    let nombreUsuarioFiltro = null;

    if (id_cliente) {
      const clienteObj = await db.cliente
        .findByPk(id_cliente)
        .catch(() => null);
      if (clienteObj) {
        nombreClienteFiltro =
          `${clienteObj.nombre || ""} ${clienteObj.ap_paterno || ""} ${clienteObj.ap_materno || ""}`.trim();
      }
    }

    if (id_usuario) {
      const usuarioObj = await db.usuario
        .findByPk(id_usuario)
        .catch(() => null);
      if (usuarioObj) {
        nombreUsuarioFiltro = usuarioObj.usuario || `Usuario ${id_usuario}`;
      }
    }

    // Totales desde lista (solo ventas incluidas en totales)
    const totalVentas = lista
      .filter((v) => v.incluida_en_totales)
      .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

    // Total de ventas anuladas
    const totalVentasAnuladas = lista
      .filter((v) => v.estado_valor === 2)
      .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

    // La lista del frontend ya viene filtrada
    const ventas = lista;

    // Buscar usuarios anuladores para ventas anuladas
    for (const venta of ventas) {
      if (venta.estado_valor === 2) {
        const ventaDB = await db.venta
          .findOne({
            where: { id_venta: venta.id_venta },
            include: [{ model: db.usuario, as: "usuario_anulador" }],
          })
          .catch(() => null);
        if (ventaDB && ventaDB.usuario_anulador) {
          venta.usuario_anulador = ventaDB.usuario_anulador;
        }
      }
    }

    // Buscar facturas para ventas tipo "Facturado"
    for (const venta of ventas) {
      if (venta.tipo_venta === "Facturado" || venta.tipo_venta_valor === 2) {
        const factura = await db.factura
          .findOne({
            where: { id_venta: venta.id_venta },
          })
          .catch(() => null);
        if (factura) {
          venta.nro_factura = factura.nro_factura;
        }
      }
    }

    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64("../assets/logo2.jpeg");

    const filtroLines = [];
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    if (estado) filtroLines.push(`Estado: ${estado}`);
    if (tipo_venta) filtroLines.push(`Tipo venta: ${tipo_venta}`);
    if (tipo_pago) filtroLines.push(`Tipo pago: ${tipo_pago}`);
    if (id_cliente && nombreClienteFiltro)
      filtroLines.push(`Cliente: ${nombreClienteFiltro}`);
    if (id_usuario && nombreUsuarioFiltro)
      filtroLines.push(`Usuario registro: ${nombreUsuarioFiltro}`);
    if (busqueda) filtroLines.push(`Búsqueda: ${busqueda}`);
    if (!filtroLines.length) filtroLines.push("Sin filtros aplicados");

    const encabezadoCols = [
      { image: logo, width: 70 },
      {
        stack: [
          { text: "Reporte de ventas - DETALLADO", style: "titulo" },
          ...filtroLines.map((l) => ({ text: l, style: "filtro" })),
        ],
        margin: [10, 0, 0, 0],
        width: "*",
      },
      {
        stack: [
          {
            text: `Generado por: ${usuario || "desconocido"}`,
            alignment: "right",
          },
          {
            text: `Sistema: ${nombreSistema || "Auto Accesorios Pinedo"}`,
            alignment: "right",
          },
          {
            text: `Fecha: ${new Date().toLocaleString("es-BO")}`,
            alignment: "right",
          },
        ],
        width: 160,
      },
    ];

    // Construir contenido con detalles de cada venta
    const content = [];

    let counter = 1;
    let totalGananciaDetallado = 0;
    for (let index = 0; index < ventas.length; index++) {
      const venta = ventas[index];
      const detalles =
        (await db.det_venta.findAll({
          where: { id_venta: venta.id_venta },
          include: [{ model: db.producto }],
        })) || [];

      // Usuario y label ya vienen calculados del frontend
      const usr = venta.usuario;
      const nombreUsuario =
        usr?.nombre_usuario || usr?.usuario || "Sin usuario";
      const labelUsuario = venta.label_usuario || "Registrado por";

      const nombreCliente = venta.cliente
        ? `${venta.cliente.nombre_completo || ""}`.trim()
        : "Sin cliente";
      const fecha = formatFecha(venta.fecha_registro);
      let tipoText =
        venta.tipo_venta ||
        (venta.tipo_venta_valor === 2 ? "Facturado" : "Normal");
      if (
        (venta.tipo_venta === "Facturado" || venta.tipo_venta_valor === 2) &&
        venta.nro_factura
      ) {
        tipoText = `Facturado Nro. ${venta.nro_factura}`;
      }
      const tipoPagoText =
        venta.tipo_pago || (venta.tipo_pago_valor === 2 ? "QR" : "Efectivo");

      // Estado - si está anulada, mostrar quien anuló
      let estadoText = venta.estado
        ? venta.estado.toUpperCase()
        : venta.estado_valor === 1
          ? "VÁLIDA"
          : "ANULADA";
      if (venta.estado_valor === 2 && venta.usuario_anulador) {
        estadoText = `ANULADA POR ${(venta.usuario_anulador.usuario || "desconocido").toUpperCase()}`;
      }

      const estadoColor = venta.estado_valor === 1 ? "#2196F3" : "#f44336";
      const esAnulada = venta.estado_valor === 2;

      // Separador entre ventas
      if (index > 0) {
        content.push({
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 1,
              lineColor: "#cccccc",
            },
          ],
          margin: [0, 15, 0, 15],
        });
      }

      // Título de la venta
      content.push({
        text: `Venta #${venta.nro_venta || venta.id_venta} - ${estadoText}`,
        fontSize: 12,
        bold: true,
        color: estadoColor,
        margin: [0, 10, 0, 5],
      });

      // Información de la venta
      content.push({
        columns: [
          {
            width: "*",
            stack: [
              { text: `Cliente: ${nombreCliente}`, fontSize: 9, bold: true },
              {
                text: `CI/NIT: ${venta.cliente?.ci_nit || "N/A"}`,
                fontSize: 9,
              },
              {
                text: `${labelUsuario}: ${nombreUsuario}`,
                fontSize: 9,
                color: esAnulada ? "#f44336" : "#333333",
                bold: esAnulada,
              },
              ...(venta.descripcion
                ? [
                    {
                      text: `Descripción: ${venta.descripcion}`,
                      fontSize: 8,
                      color: "#666666",
                      italics: true,
                      margin: [0, 3, 0, 0],
                    },
                  ]
                : []),
            ],
          },
          {
            width: "*",
            stack: [
              { text: `Fecha: ${fecha}`, fontSize: 9, alignment: "right" },
              {
                text: `Tipo: ${tipoText}`,
                fontSize: 9,
                alignment: "right",
                fillColor: venta.nro_factura ? "#d4edda" : undefined,
              },
              {
                text: `Pago: ${tipoPagoText}`,
                fontSize: 9,
                alignment: "right",
                bold: true,
                color: venta.tipo_pago_valor === 2 ? "#1976d2" : "#388e3c",
              },
            ],
          },
        ],
        margin: [0, 0, 0, 10],
      });

      // Subtítulo de productos
      content.push({
        text: "Productos de la venta:",
        fontSize: 10,
        bold: true,
        margin: [0, 5, 0, 5],
        color: "#555555",
      });

      // Tabla de productos
      const productosBody = [
        [
          {
            text: "Producto",
            bold: true,
            fontSize: 9,
            fillColor: "#2196F3",
            color: "white",
          },
          {
            text: "Código",
            bold: true,
            fontSize: 9,
            fillColor: "#2196F3",
            color: "white",
          },
          {
            text: "Cant.",
            bold: true,
            fontSize: 9,
            alignment: "center",
            fillColor: "#2196F3",
            color: "white",
          },
          {
            text: "P. Unit.",
            bold: true,
            fontSize: 9,
            alignment: "right",
            fillColor: "#2196F3",
            color: "white",
          },
          {
            text: "Subtotal",
            bold: true,
            fontSize: 9,
            alignment: "right",
            fillColor: "#2196F3",
            color: "white",
          },
        ],
      ];

      detalles.forEach((det) => {
        const productoNombre = det.producto?.nombre || "N/A";
        const productoCodigo = det.producto?.codigo || "N/A";
        const cantidad = parseFloat(det.cantidad) || 0;
        const precioUnit = parseFloat(det.precio_unitario) || 0;
        const subtotal = parseFloat(det.sub_total) || cantidad * precioUnit;
        const colorDetalle = esAnulada ? "#999999" : "#333333";

        productosBody.push([
          { text: productoNombre, fontSize: 9, color: colorDetalle },
          { text: productoCodigo, fontSize: 9, color: colorDetalle },
          {
            text: cantidad.toString(),
            fontSize: 9,
            alignment: "center",
            color: colorDetalle,
          },
          {
            text: formatNumber(precioUnit),
            fontSize: 9,
            alignment: "right",
            color: colorDetalle,
          },
          {
            text: formatNumber(subtotal),
            fontSize: 9,
            alignment: "right",
            color: colorDetalle,
            bold: true,
          },
        ]);
      });

      // Fila de totales de la venta
      const monto = parseFloat(venta.monto_total) || 0;
      const descuento = parseFloat(venta.descuento) || 0;
      const total = monto - descuento;

      // Calcular ganancia neta de esta venta
      let gananciaVenta = 0;
      if (!esAnulada && monto > 0) {
        const factor = total / monto;
        gananciaVenta = detalles.reduce((acc, det) => {
          const subTotal = parseFloat(det.sub_total) || 0;
          const precioCompra = parseFloat(det.precio_compra) || 0;
          const cant = parseFloat(det.cantidad) || 0;
          return acc + (subTotal - precioCompra * cant) * factor;
        }, 0);
        if (venta.tipo_venta_valor === 2) {
          gananciaVenta -= total * 0.13;
        }
        totalGananciaDetallado += gananciaVenta;
      }

      // Fila de descuento
      if (descuento > 0) {
        productosBody.push([
          { text: "", colSpan: 2, border: [false, false, false, false] },
          {},
          {},
          {
            text: "Descuento:",
            fontSize: 9,
            alignment: "right",
            color: "#666666",
          },
          {
            text: formatNumber(descuento),
            fontSize: 9,
            alignment: "right",
            color: "#666666",
          },
        ]);
      }

      productosBody.push([
        { text: "", colSpan: 2, border: [false, false, false, false] },
        {},
        {},
        {
          text: "TOTAL:",
          bold: true,
          fontSize: 10,
          alignment: "right",
          fillColor: esAnulada ? "#ffebee" : "#e3f2fd",
          color: esAnulada ? "#999999" : "#1565C0",
          border: [true, true, false, true],
        },
        {
          text: `${formatNumber(total)}${esAnulada ? " (ANULADA)" : ""}`,
          bold: true,
          fontSize: 10,
          alignment: "right",
          fillColor: esAnulada ? "#ffebee" : "#e3f2fd",
          color: esAnulada ? "#999999" : "#1565C0",
          decoration: esAnulada ? "lineThrough" : undefined,
          border: [false, true, true, true],
        },
      ]);

      if (!esAnulada) {
        productosBody.push([
          { text: "", colSpan: 2, border: [false, false, false, false] },
          {},
          {},
          {
            text: venta.tipo_venta_valor === 2 ? "GANANCIA NETA (c/IVA 13%):" : "GANANCIA NETA:",
            bold: true,
            fontSize: 9,
            alignment: "right",
            fillColor: gananciaVenta >= 0 ? "#e8f5e9" : "#ffebee",
            color: gananciaVenta >= 0 ? "#2e7d32" : "#c62828",
            border: [true, false, false, true],
          },
          {
            text: formatNumber(gananciaVenta),
            bold: true,
            fontSize: 9,
            alignment: "right",
            fillColor: gananciaVenta >= 0 ? "#e8f5e9" : "#ffebee",
            color: gananciaVenta >= 0 ? "#2e7d32" : "#c62828",
            border: [false, false, true, true],
          },
        ]);
      }

      content.push({
        table: {
          headerRows: 1,
          widths: ["*", 70, 40, 60, 70],
          body: productosBody,
        },
        layout: {
          fillColor: function (rowIndex, node, columnIndex) {
            return rowIndex === 0
              ? "#2196F3"
              : rowIndex % 2 === 1 && rowIndex !== productosBody.length - 1
                ? "#f9f9f9"
                : null;
          },
          hLineWidth: function (i, node) {
            return 0.5;
          },
          vLineWidth: function (i, node) {
            return 0.5;
          },
          hLineColor: function (i, node) {
            return "#CCCCCC";
          },
          vLineColor: function (i, node) {
            return "#CCCCCC";
          },
        },
        margin: [0, 0, 0, 10],
      });

      counter++;
    }

    // Resumen general al final
    content.push({ text: "\n", pageBreak: "before" });
    content.push({
      text: "RESUMEN GENERAL",
      style: "titulo",
      alignment: "center",
      margin: [0, 20, 0, 20],
    });

    // Calcular totales por método de pago (solo ventas incluidas en totales)
    let totalEfectivo = 0;
    let totalQR = 0;
    let cantEfectivo = 0;
    let cantQR = 0;
    let totalVentasValidas = 0;

    for (const v of ventas) {
      if (!v.incluida_en_totales) continue;
      totalVentasValidas++;
      const totalVenta = parseFloat(v.total) || 0;
      if (v.tipo_pago_valor === 2) {
        totalQR += totalVenta;
        cantQR++;
      } else {
        totalEfectivo += totalVenta;
        cantEfectivo++;
      }
    }

    content.push({
      table: {
        widths: ["*", 120],
        body: [
          [
            { text: "Total de Ventas:", bold: true, fontSize: 11 },
            {
              text: totalVentasValidas.toString(),
              alignment: "right",
              fontSize: 11,
            },
          ],
          [
            { text: "Ventas en Efectivo:", fontSize: 10, color: "#388e3c" },
            {
              text: `${cantEfectivo} (${formatNumber(totalEfectivo)})`,
              alignment: "right",
              fontSize: 10,
              color: "#388e3c",
            },
          ],
          [
            { text: "Ventas con QR:", fontSize: 10, color: "#1976d2" },
            {
              text: `${cantQR} (${formatNumber(totalQR)})`,
              alignment: "right",
              fontSize: 10,
              color: "#1976d2",
            },
          ],
          [
            {
              text: "Monto Total:",
              bold: true,
              fontSize: 12,
              fillColor: "#e8f5e9",
            },
            {
              text: formatNumber(totalVentas),
              alignment: "right",
              fontSize: 12,
              bold: true,
              color: "blue",
              fillColor: "#e8f5e9",
            },
          ],
          [
            {
              text: "Ganancia Neta Total:",
              bold: true,
              fontSize: 12,
              fillColor: totalGananciaDetallado >= 0 ? "#d5f5e3" : "#ffebee",
              color: totalGananciaDetallado >= 0 ? "#1a5276" : "#c62828",
            },
            {
              text: formatNumber(totalGananciaDetallado),
              alignment: "right",
              fontSize: 12,
              bold: true,
              fillColor: totalGananciaDetallado >= 0 ? "#d5f5e3" : "#ffebee",
              color: totalGananciaDetallado >= 0 ? "#1a5276" : "#c62828",
            },
          ],
          ...(totalVentasAnuladas > 0
            ? [
                [
                  {
                    text: "Total Anuladas:",
                    bold: true,
                    fontSize: 10,
                    fillColor: "#ffebee",
                    color: "#c62828",
                  },
                  {
                    text: formatNumber(totalVentasAnuladas),
                    alignment: "right",
                    fontSize: 10,
                    bold: true,
                    color: "#c62828",
                    fillColor: "#ffebee",
                  },
                ],
              ]
            : []),
        ],
      },
      layout: {
        hLineWidth: function (i, node) {
          return 0.5;
        },
        vLineWidth: function (i, node) {
          return 0.5;
        },
      },
    });

    const docDefinition = {
      pageSize: "A4",
      pageOrientation: "portrait",
      pageMargins: [36, 110, 36, 54],
      header: { margin: [40, 40, 40, 40], columns: encabezadoCols },
      defaultStyle: { fontSize: 9 },
      content: content,
      footer: (currentPage, pageCount) => ({
        columns: [
          {
            text: `Generado: ${new Date().toLocaleString("es-BO")} por: ${usuario || "desconocido"}`,
            alignment: "left",
            margin: [40, 0, 0, 0],
          },
          {
            text: `${nombreSistema || "Auto Accesorios Pinedo"} - Página ${currentPage} de ${pageCount}`,
            alignment: "right",
            margin: [0, 0, 40, 0],
          },
        ],
      }),
      styles: {
        titulo: { fontSize: 16, bold: true },
        filtro: { fontSize: 8 },
        ventaTitle: { fontSize: 12, bold: true, color: "#1976d2" },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on("data", (c) => chunks.push(c));
    pdfDoc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "inline; filename=ventas_reporte_detallado.pdf",
      );
      res.send(pdfBuffer);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al generar PDF de ventas detallado");
  }
};

// Obtener datos de ventas resumido para vista previa (sin generar PDF)
const obtenerDatosVentasResumido = async (req, res) => {
  try {
    const {
      desde,
      hasta,
      id_usuario,
      estado,
      id_cliente,
      tipo_venta,
      orden = null,
    } = req.query;

    const whereClause = {};

    // Filtro por cliente
    if (id_cliente && String(id_cliente).trim() !== "") {
      whereClause.id_cliente = parseInt(id_cliente);
    }

    // Filtro por estado
    if (estado !== undefined && String(estado).trim() !== "") {
      whereClause.estado = parseInt(estado);
    }

    // Filtro por usuario
    if (id_usuario && String(id_usuario).trim() !== "") {
      whereClause.id_usuario = parseInt(id_usuario);
    }

    // Filtro por tipo de venta
    if (tipo_venta !== undefined && String(tipo_venta).trim() !== "") {
      whereClause.tipo_venta = parseInt(tipo_venta);
    }

    // Filtro por rango de fechas
    if (desde || hasta) {
      whereClause[Op.and] = whereClause[Op.and] || [];

      if (desde && String(desde).trim() !== "") {
        whereClause[Op.and].push(
          literal(`"venta"."fecha_registro" >= '${String(desde).trim()}'`),
        );
      }

      if (hasta && String(hasta).trim() !== "") {
        whereClause[Op.and].push(
          literal(`"venta"."fecha_registro" <= '${String(hasta).trim()}'`),
        );
      }
    }

    // Calcular totales (solo ventas válidas)
    let whereTotalVentas;
    if (estado !== undefined && String(estado).trim() !== "") {
      whereTotalVentas = { ...whereClause };
    } else {
      whereTotalVentas = { ...whereClause, estado: 1 };
    }

    const resultadoTotalVentas = await db.venta.findOne({
      where: whereTotalVentas,
      attributes: [
        [
          Sequelize.fn(
            "COALESCE",
            Sequelize.fn(
              "SUM",
              Sequelize.literal("monto_total - COALESCE(descuento, 0)"),
            ),
            0,
          ),
          "total",
        ],
      ],
      raw: true,
    });
    const totalVentas = parseFloat(resultadoTotalVentas?.total) || 0;

    // Obtener ventas
    const ventasRaw = await db.venta.findAll({
      where: whereClause,
      order: [["id_venta", "DESC"]],
      include: [
        {
          model: db.det_venta,
        },
        {
          model: db.usuario,
          attributes: ["id_usuario", "usuario"],
          as: "usuario_registro",
          include: [
            {
              model: db.empleado,
              attributes: ["nombre", "ap_paterno", "ap_materno"],
            },
          ],
        },
        {
          model: db.usuario,
          attributes: ["id_usuario", "usuario"],
          as: "usuario_anulador",
          include: [
            {
              model: db.empleado,
              attributes: ["nombre", "ap_paterno", "ap_materno"],
            },
          ],
        },
        {
          model: db.cliente,
          attributes: [
            "id_cliente",
            "nombre",
            "ap_paterno",
            "ap_materno",
            "ci_nit",
            "celular",
          ],
        },
      ],
    });

    const ventas = ventasRaw.map((v) => (v.get ? v.get({ plain: true }) : v));

    // Calcular totales por tipo de pago (solo ventas válidas)
    let totalEfectivo = 0;
    let totalQR = 0;
    let cantEfectivo = 0;
    let cantQR = 0;
    let ventasValidas = 0;
    let ventasAnuladas = 0;
    let totalGananciaNeta = 0;

    // Función para calcular ganancia neta de una venta a partir de sus det_venta
    const calcularGananciaNeta = (venta) => {
      const detalles = venta.det_venta || [];
      const monto = parseFloat(venta.monto_total) || 0;
      const descuento = parseFloat(venta.descuento) || 0;
      const totalVenta = monto - descuento;
      if (monto === 0) return 0;
      const factor = totalVenta / monto;

      let ganancia = detalles.reduce((acc, det) => {
        const subTotal = parseFloat(det.sub_total) || 0;
        const precioCompra = parseFloat(det.precio_compra) || 0;
        const cantidad = parseFloat(det.cantidad) || 0;
        return acc + (subTotal - precioCompra * cantidad) * factor;
      }, 0);

      // Ventas facturadas: descontar 13% de IVA sobre el total de venta
      if (venta.tipo_venta === 2) {
        ganancia -= totalVenta * 0.13;
      }
      return ganancia;
    };

    for (const v of ventas) {
      if (v.estado === 2) {
        ventasAnuladas++;
        continue;
      }

      ventasValidas++;
      const montoNum = parseFloat(v.monto_total) || 0;
      const descuentoNum = parseFloat(v.descuento) || 0;
      const totalVenta = montoNum - descuentoNum;

      totalGananciaNeta += calcularGananciaNeta(v);

      if (v.tipo_pago === 2) {
        totalQR += totalVenta;
        cantQR++;
      } else {
        totalEfectivo += totalVenta;
        cantEfectivo++;
      }
    }

    // Procesar ventas
    const ventasProcesadas = ventas.map((venta) => {
      // Determinar usuario según el estado
      let usuario = null;
      let labelUsuario = "";

      if (venta.estado === 2) {
        // Venta anulada - mostrar usuario anulador
        if (venta.usuario_anulador) {
          usuario = {
            id_usuario: venta.usuario_anulador.id_usuario,
            nombre_usuario: venta.usuario_anulador.usuario,
            nombre_completo: venta.usuario_anulador.empleado
              ? `${venta.usuario_anulador.empleado.nombre} ${venta.usuario_anulador.empleado.ap_paterno} ${venta.usuario_anulador.empleado.ap_materno}`.trim()
              : venta.usuario_anulador.usuario,
          };
        }
        labelUsuario = "Anulado por";
      } else {
        // Venta válida - mostrar usuario registro
        if (venta.usuario_registro) {
          usuario = {
            id_usuario: venta.usuario_registro.id_usuario,
            nombre_usuario: venta.usuario_registro.usuario,
            nombre_completo: venta.usuario_registro.empleado
              ? `${venta.usuario_registro.empleado.nombre} ${venta.usuario_registro.empleado.ap_paterno} ${venta.usuario_registro.empleado.ap_materno}`.trim()
              : venta.usuario_registro.usuario,
          };
        }
        labelUsuario = "Registrado por";
      }

      const cliente = venta.cliente
        ? {
            id_cliente: venta.cliente.id_cliente,
            nombre_completo:
              `${venta.cliente.nombre} ${venta.cliente.ap_paterno || ""} ${venta.cliente.ap_materno || ""}`.trim(),
            ci_nit: venta.cliente.ci_nit,
            celular: venta.cliente.celular,
          }
        : null;

      const monto = parseFloat(venta.monto_total) || 0;
      const descuento = parseFloat(venta.descuento) || 0;
      const total = monto - descuento;
      const ganancia_neta = venta.estado === 1 ? calcularGananciaNeta(venta) : 0;

      return {
        id_venta: venta.id_venta,
        nro_venta: venta.nro_venta,
        fecha_registro: venta.fecha_registro,
        usuario: usuario,
        label_usuario: labelUsuario,
        cliente: cliente,
        tipo_venta: venta.tipo_venta === 2 ? "Facturado" : "Normal",
        tipo_venta_valor: venta.tipo_venta,
        tipo_pago: venta.tipo_pago === 2 ? "QR" : "Efectivo",
        tipo_pago_valor: venta.tipo_pago,
        monto_total: parseFloat(monto.toFixed(2)),
        descuento: parseFloat(descuento.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        ganancia_neta: parseFloat(ganancia_neta.toFixed(2)),
        estado: venta.estado === 1 ? "Válida" : "Anulada",
        estado_valor: venta.estado,
        incluida_en_totales: venta.estado === 1,
      };
    });

    // Construir respuesta
    const respuesta = {
      fecha_generacion: new Date().toLocaleString("es-ES"),
      filtros: {
        desde: desde || null,
        hasta: hasta || null,
        id_usuario: id_usuario || null,
        id_cliente: id_cliente || null,
        estado: estado || null,
        tipo_venta: tipo_venta || null,
        orden: orden || null,
      },
      totales: {
        total_ventas: ventas.length,
        ventas_validas: ventasValidas,
        ventas_anuladas: ventasAnuladas,
        monto_total_general: parseFloat(totalVentas.toFixed(2)),
        total_efectivo: parseFloat(totalEfectivo.toFixed(2)),
        cantidad_efectivo: cantEfectivo,
        total_qr: parseFloat(totalQR.toFixed(2)),
        cantidad_qr: cantQR,
        ganancia_neta_total: parseFloat(totalGananciaNeta.toFixed(2)),
      },
      nota: "Los totales solo incluyen ventas con estado=1 (Válidas). Las ventas anuladas se muestran pero no se suman.",
      ventas: ventasProcesadas,
    };

    return res.status(200).json(respuesta);
  } catch (error) {
    console.error("Error en obtenerDatosVentasResumido:", error);
    return res.status(500).json({
      mensaje: "Error al obtener los datos de ventas",
      error: error.message,
    });
  }
};

// Obtener datos de ventas detallado para vista previa (sin generar PDF)
const obtenerDatosVentasDetallado = async (req, res) => {
  try {
    const { desde, hasta, id_usuario, estado, id_cliente, tipo_venta } =
      req.query;

    const whereClause = {};

    // Filtro por cliente
    if (id_cliente && String(id_cliente).trim() !== "") {
      whereClause.id_cliente = parseInt(id_cliente);
    }

    // Filtro por estado
    if (estado !== undefined && String(estado).trim() !== "") {
      whereClause.estado = parseInt(estado);
    }

    // Filtro por usuario
    if (id_usuario && String(id_usuario).trim() !== "") {
      whereClause.id_usuario = parseInt(id_usuario);
    }

    // Filtro por tipo de venta
    if (tipo_venta !== undefined && String(tipo_venta).trim() !== "") {
      whereClause.tipo_venta = parseInt(tipo_venta);
    }

    // Filtro por rango de fechas
    if (desde || hasta) {
      whereClause[Op.and] = whereClause[Op.and] || [];

      if (desde && String(desde).trim() !== "") {
        whereClause[Op.and].push(
          literal(`"venta"."fecha_registro" >= '${String(desde).trim()}'`),
        );
      }

      if (hasta && String(hasta).trim() !== "") {
        whereClause[Op.and].push(
          literal(`"venta"."fecha_registro" <= '${String(hasta).trim()}'`),
        );
      }
    }

    // Calcular totales (solo ventas válidas)
    let whereTotalVentas;
    if (estado !== undefined && String(estado).trim() !== "") {
      whereTotalVentas = { ...whereClause };
    } else {
      whereTotalVentas = { ...whereClause, estado: 1 };
    }

    const resultadoTotalVentas = await db.venta.findOne({
      where: whereTotalVentas,
      attributes: [
        [
          Sequelize.fn(
            "COALESCE",
            Sequelize.fn(
              "SUM",
              Sequelize.literal("monto_total - COALESCE(descuento, 0)"),
            ),
            0,
          ),
          "total",
        ],
      ],
      raw: true,
    });
    const totalVentas = parseFloat(resultadoTotalVentas?.total) || 0;

    // Obtener ventas con detalles
    const ventasRaw = await db.venta.findAll({
      where: whereClause,
      order: [["id_venta", "DESC"]],
      include: [
        {
          model: db.det_venta,
          include: [
            {
              model: db.producto,
              attributes: ["id_producto", "nombre", "codigo"],
            },
          ],
        },
        {
          model: db.usuario,
          as: "usuario_registro",
          attributes: ["id_usuario", "usuario"],
          include: [
            {
              model: db.empleado,
              attributes: ["nombre", "ap_paterno", "ap_materno"],
            },
          ],
        },
        {
          model: db.usuario,
          as: "usuario_anulador",
          attributes: ["id_usuario", "usuario"],
          include: [
            {
              model: db.empleado,
              attributes: ["nombre", "ap_paterno", "ap_materno"],
            },
          ],
        },
        {
          model: db.cliente,
          attributes: [
            "id_cliente",
            "nombre",
            "ap_paterno",
            "ap_materno",
            "ci_nit",
            "celular",
          ],
        },
      ],
    });

    const ventas = ventasRaw.map((v) => (v.get ? v.get({ plain: true }) : v));

    // Calcular totales por tipo de pago (solo ventas válidas)
    let totalEfectivo = 0;
    let totalQR = 0;
    let cantEfectivo = 0;
    let cantQR = 0;
    let ventasValidas = 0;
    let ventasAnuladas = 0;

    for (const v of ventas) {
      if (v.estado === 2) {
        ventasAnuladas++;
        continue;
      }

      ventasValidas++;
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

    // Procesar ventas con detalles
    const ventasProcesadas = ventas.map((venta) => {
      // Determinar usuario según el estado
      let usuario = null;
      let labelUsuario = "";

      if (venta.estado === 2) {
        // Venta anulada - mostrar usuario anulador
        if (venta.usuario_anulador) {
          usuario = {
            id_usuario: venta.usuario_anulador.id_usuario,
            nombre_usuario: venta.usuario_anulador.usuario,
            nombre_completo: venta.usuario_anulador.empleado
              ? `${venta.usuario_anulador.empleado.nombre} ${venta.usuario_anulador.empleado.ap_paterno || ""} ${venta.usuario_anulador.empleado.ap_materno || ""}`.trim()
              : venta.usuario_anulador.usuario,
          };
        }
        labelUsuario = "Anulado por";
      } else {
        // Venta válida - mostrar usuario registro
        if (venta.usuario_registro) {
          usuario = {
            id_usuario: venta.usuario_registro.id_usuario,
            nombre_usuario: venta.usuario_registro.usuario,
            nombre_completo: venta.usuario_registro.empleado
              ? `${venta.usuario_registro.empleado.nombre} ${venta.usuario_registro.empleado.ap_paterno || ""} ${
                  venta.usuario_registro.empleado.ap_materno || ""
                }`.trim()
              : venta.usuario_registro.usuario,
          };
        }
        labelUsuario = "Registrado por";
      }

      const cliente = venta.cliente
        ? {
            id_cliente: venta.cliente.id_cliente,
            nombre_completo:
              `${venta.cliente.nombre} ${venta.cliente.ap_paterno || ""} ${venta.cliente.ap_materno || ""}`.trim(),
            ci_nit: venta.cliente.ci_nit,
            celular: venta.cliente.celular,
          }
        : null;

      const detalles = (venta.det_ventas || venta.det_venta || []).map(
        (det) => ({
          id_detventa: det.id_detventa,
          producto: det.producto
            ? {
                id_producto: det.producto.id_producto,
                nombre: det.producto.nombre,
                codigo: det.producto.codigo,
              }
            : null,
          cantidad: parseFloat(det.cantidad) || 0,
          precio_unitario: parseFloat((det.precio_unitario || 0).toFixed(2)),
          sub_total: parseFloat((det.sub_total || 0).toFixed(2)),
        }),
      );

      const monto = parseFloat(venta.monto_total) || 0;
      const descuento = parseFloat(venta.descuento) || 0;
      const total = monto - descuento;

      return {
        id_venta: venta.id_venta,
        nro_venta: venta.nro_venta,
        fecha_registro: venta.fecha_registro,
        usuario: usuario,
        label_usuario: labelUsuario,
        cliente: cliente,
        tipo_venta: venta.tipo_venta === 2 ? "Facturado" : "Normal",
        tipo_venta_valor: venta.tipo_venta,
        tipo_pago: venta.tipo_pago === 2 ? "QR" : "Efectivo",
        tipo_pago_valor: venta.tipo_pago,
        monto_total: parseFloat(monto.toFixed(2)),
        descuento: parseFloat(descuento.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        estado:
          venta.estado === 1
            ? "Válida"
            : venta.estado === 2
              ? "Anulada"
              : String(venta.estado),
        estado_valor: venta.estado,
        detalles: detalles,
        incluida_en_totales: venta.estado === 1,
      };
    });

    // Construir respuesta
    const respuesta = {
      fecha_generacion: new Date().toLocaleString("es-ES"),
      filtros: {
        desde: desde || null,
        hasta: hasta || null,
        id_usuario: id_usuario || null,
        id_cliente: id_cliente || null,
        estado: estado || null,
        tipo_venta: tipo_venta || null,
      },
      totales: {
        total_ventas: ventas.length,
        ventas_validas: ventasValidas,
        ventas_anuladas: ventasAnuladas,
        monto_total_general: parseFloat(totalVentas.toFixed(2)),
        total_efectivo: parseFloat(totalEfectivo.toFixed(2)),
        cantidad_efectivo: cantEfectivo,
        total_qr: parseFloat(totalQR.toFixed(2)),
        cantidad_qr: cantQR,
      },
      nota: "Los totales solo incluyen ventas con estado=1 (Válidas). Las ventas anuladas se muestran pero no se suman.",
      ventas: ventasProcesadas,
    };

    return res.status(200).json(respuesta);
  } catch (error) {
    console.error("Error en obtenerDatosVentasDetallado:", error);
    return res.status(500).json({
      mensaje: "Error al obtener los datos de ventas detalladas",
      error: error.message,
    });
  }
};

// Reporte de ventas RESUMIDO en Excel
const reporteVentasResumidoXlsx = async (req, res) => {
  try {
    const {
      filtros = {},
      lista = [],
      nombreSistema = "Auto Accesorios Pinedo",
      orden = null,
      usuario = "",
    } = req.body || {};

    const {
      desde,
      hasta,
      tipo_venta,
      estado,
      tipo_pago,
      id_cliente,
      id_usuario,
      busqueda,
    } = filtros;

    console.log("Reporte de ventas resumido Excel - parámetros:", req.body);

    // Buscar nombres de cliente y usuario para filtros
    let nombreClienteFiltro = null;
    let nombreUsuarioFiltro = null;

    if (id_cliente) {
      const clienteObj = await db.cliente
        .findByPk(id_cliente)
        .catch(() => null);
      if (clienteObj) {
        nombreClienteFiltro =
          `${clienteObj.nombre || ""} ${clienteObj.ap_paterno || ""} ${clienteObj.ap_materno || ""}`.trim();
      }
    }

    if (id_usuario) {
      const usuarioObj = await db.usuario
        .findByPk(id_usuario)
        .catch(() => null);
      if (usuarioObj) {
        nombreUsuarioFiltro = usuarioObj.usuario || `Usuario ${id_usuario}`;
      }
    }

    // Totales desde la lista (solo ventas incluidas en totales)
    const totalVentas = lista
      .filter((v) => v.incluida_en_totales)
      .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

    // Total de ventas anuladas
    const totalVentasAnuladas = lista
      .filter((v) => v.estado_valor === 2)
      .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);

    const ventas = lista;

    // Buscar usuarios anuladores para ventas anuladas
    for (const venta of ventas) {
      if (venta.estado_valor === 2) {
        const ventaDB = await db.venta
          .findOne({
            where: { id_venta: venta.id_venta },
            include: [{ model: db.usuario, as: "usuario_anulador" }],
          })
          .catch(() => null);
        if (ventaDB && ventaDB.usuario_anulador) {
          venta.usuario_anulador = ventaDB.usuario_anulador;
        }
      }
    }

    // Buscar facturas para ventas tipo "Facturado"
    for (const venta of ventas) {
      if (venta.tipo_venta === "Facturado" || venta.tipo_venta_valor === 2) {
        const factura = await db.factura
          .findOne({
            where: { id_venta: venta.id_venta },
          })
          .catch(() => null);
        if (factura) {
          venta.nro_factura = factura.nro_factura;
        }
      }
    }

    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = nombreSistema || "Auto Accesorios Pinedo";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Ventas Resumido");

    // Líneas de filtros
    const filtroLines = [];
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    if (estado) filtroLines.push(`Estado: ${estado}`);
    if (tipo_venta) filtroLines.push(`Tipo venta: ${tipo_venta}`);
    if (tipo_pago) filtroLines.push(`Tipo pago: ${tipo_pago}`);
    if (id_cliente && nombreClienteFiltro)
      filtroLines.push(`Cliente: ${nombreClienteFiltro}`);
    if (id_usuario && nombreUsuarioFiltro)
      filtroLines.push(`Usuario registro: ${nombreUsuarioFiltro}`);
    if (!filtroLines.length) filtroLines.push("Sin filtros aplicados");

    // Encabezado (título y filtros)
    const firstRow = ["", "Reporte de ventas - RESUMIDO"];
    const titleRow = sheet.addRow(firstRow);
    titleRow.font = { bold: true, size: 14 };

    const secondRow = [""];
    secondRow.push(`Fecha generación: ${new Date().toLocaleString("es-BO")}`);
    for (const f of filtroLines) secondRow.push(f);
    sheet.addRow(secondRow);
    sheet.addRow([]);

    // Definir columnas según orden
    const headers = [];
    const colKeys = [];
    const colWidths = [];

    headers.push("Nro");
    colKeys.push("nro");
    colWidths.push(6);

    headers.push("Nro Venta");
    colKeys.push("nro_venta");
    colWidths.push(12);

    if (orden !== "usuario") {
      headers.push("Usuario");
      colKeys.push("usuario");
      colWidths.push(24);
    }

    headers.push("Fecha");
    colKeys.push("fecha");
    colWidths.push(24);

    if (orden !== "cliente") {
      headers.push("Cliente");
      colKeys.push("cliente");
      colWidths.push(24);
    }

    if (orden !== "tipo_venta") {
      headers.push("Tipo");
      colKeys.push("tipo");
      colWidths.push(12);
    }

    headers.push("Monto");
    colKeys.push("monto");
    colWidths.push(12);

    headers.push("Desc");
    colKeys.push("desc");
    colWidths.push(10);

    headers.push("Total");
    colKeys.push("total");
    colWidths.push(12);

    headers.push("Tipo Pago");
    colKeys.push("tipo_pago");
    colWidths.push(12);

    headers.push("Ganancia");
    colKeys.push("ganancia");
    colWidths.push(14);

    headers.push("Estado");
    colKeys.push("estado");
    colWidths.push(12);

    // Configurar columnas
    sheet.columns = colKeys.map((key, idx) => ({ key, width: colWidths[idx] }));

    // Insertar fila de encabezado
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, size: 11 };
    headerRow.alignment = { horizontal: "center" };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDFF2E6" },
      };
    });

    let counter = 1;
    const numCols = headers.length;

    // Función auxiliar para agregar fila de venta
    const addVentaRow = (v) => {
      const rowData = [];

      rowData.push(counter); // Nro
      rowData.push(v.nro_venta || ""); // Nro Venta

      if (orden !== "usuario") {
        const usr = v.usuario;
        const nombreUsuario = usr?.empleado
          ? `${usr.empleado.nombre || ""} ${usr.empleado.ap_paterno || ""}`.trim()
          : usr?.usuario || usr?.nombre_usuario || "Sin usuario";
        rowData.push(nombreUsuario);
      }

      rowData.push(formatFecha(v.fecha_registro)); // Fecha

      if (orden !== "cliente") {
        const cli = v.cliente;
        const nombreCliente = cli
          ? `${cli.nombre_completo || ""} `.trim() || "Sin cliente"
          : "Sin cliente";
        rowData.push(nombreCliente);
      }

      if (orden !== "tipo_venta") {
        let tipoVentaText = v.tipo_venta || "Normal";
        if (
          (v.tipo_venta === "Facturado" || v.tipo_venta_valor === 2) &&
          v.nro_factura
        ) {
          tipoVentaText = `Facturado Nro. ${v.nro_factura}`;
        }
        rowData.push(tipoVentaText);
      }

      const monto = parseFloat(v.monto_total) || 0;
      rowData.push(monto);

      const descuento = parseFloat(v.descuento) || 0;
      rowData.push(descuento);

      const total = parseFloat(v.total) ?? monto - descuento;
      rowData.push(total);

      rowData.push(v.tipo_pago || "Efectivo");

      const gananciaVal = parseFloat(v.ganancia_neta) || 0;
      rowData.push(v.estado_valor === 2 ? null : gananciaVal);

      // Estado - si está anulada, mostrar quien anuló
      let estadoTexto = v.estado || "N/A";
      if (v.estado_valor === 2 && v.usuario_anulador) {
        estadoTexto = `Anulada por ${v.usuario_anulador.usuario || "desconocido"}`;
      }
      rowData.push(estadoTexto);

      const row = sheet.addRow(rowData);
      row.getCell(colKeys.indexOf("monto") + 1).numFmt = "#,##0.00";
      row.getCell(colKeys.indexOf("desc") + 1).numFmt = "#,##0.00";
      row.getCell(colKeys.indexOf("total") + 1).numFmt = "#,##0.00";
      row.getCell(colKeys.indexOf("total") + 1).font = { bold: true };

      const gananciaColIdx = colKeys.indexOf("ganancia") + 1;
      if (v.estado_valor !== 2 && gananciaColIdx > 0) {
        row.getCell(gananciaColIdx).numFmt = "#,##0.00";
        row.getCell(gananciaColIdx).font = {
          bold: true,
          color: { argb: gananciaVal >= 0 ? "FF2E7D32" : "FFC62828" },
        };
        row.getCell(gananciaColIdx).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: gananciaVal >= 0 ? "FFE8F5E9" : "FFFFEBEE" },
        };
      }

      // Fondo verde para ventas facturadas
      if (v.nro_factura && orden !== "tipo_venta") {
        const tipoIdx = colKeys.indexOf("tipo");
        if (tipoIdx >= 0) {
          row.getCell(tipoIdx + 1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD4EDDA" },
          };
        }
      }

      counter++;
    };

    // Si orden es null, solo listar sin agrupar
    if (orden === null || orden === undefined || orden === "") {
      for (const v of ventas) {
        addVentaRow(v);
      }
    } else if (orden === "cliente") {
      // Agrupar por cliente
      const byCliente = {};
      for (const v of ventas) {
        const cid = v.cliente?.id_cliente || "sin";
        if (!byCliente[cid]) byCliente[cid] = [];
        byCliente[cid].push(v);
      }

      for (const [cid, ventasCli] of Object.entries(byCliente)) {
        if (!ventasCli.length) continue;

        let nombreCliente = "Sin cliente";
        if (cid !== "sin") {
          const cli = ventasCli[0].cliente;
          nombreCliente = cli
            ? `${cli.nombre_completo || ""}`.trim() || `Cliente ${cid}`
            : `Cliente ${cid}`;
        }

        // Fila de grupo
        const groupRow = sheet.addRow([nombreCliente]);
        sheet.mergeCells(groupRow.number, 1, groupRow.number, numCols);
        groupRow.font = { bold: true };
        groupRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEAF7EF" },
        };

        for (const v of ventasCli) {
          addVentaRow(v);
        }

        const clienteTotal = ventasCli
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
        const gananciaCliente = ventasCli
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.ganancia_neta) || 0), 0);

        const totalRow = sheet.addRow([]);
        totalRow.getCell(numCols - 3).value = `Total ${nombreCliente}`;
        totalRow.getCell(numCols - 3).font = { bold: true };
        totalRow.getCell(numCols - 1).value = gananciaCliente;
        totalRow.getCell(numCols - 1).font = { bold: true, color: { argb: gananciaCliente >= 0 ? "FF2E7D32" : "FFC62828" } };
        totalRow.getCell(numCols - 1).numFmt = "#,##0.00";
        totalRow.getCell(numCols).value = clienteTotal;
        totalRow.getCell(numCols).font = { bold: true };
        totalRow.getCell(numCols).numFmt = "#,##0.00";
        totalRow.getCell(numCols - 3).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDFF2E6" },
        };
        totalRow.getCell(numCols - 1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: gananciaCliente >= 0 ? "FFE8F5E9" : "FFFFEBEE" },
        };
        totalRow.getCell(numCols).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDFF2E6" },
        };
      }
    } else if (orden === "usuario") {
      // Agrupar por usuario
      const byUsuario = {};
      for (const v of ventas) {
        const uid = v.usuario?.id_usuario || "sin";
        if (!byUsuario[uid]) byUsuario[uid] = [];
        byUsuario[uid].push(v);
      }

      for (const [uid, ventasUsr] of Object.entries(byUsuario)) {
        if (!ventasUsr.length) continue;

        let nombreUsuario = "Sin usuario";
        if (uid !== "sin") {
          const usr = ventasUsr[0].usuario;
          nombreUsuario = usr?.empleado
            ? `${usr.empleado.nombre || ""} ${usr.empleado.ap_paterno || ""}`.trim()
            : usr?.usuario || `Usuario ${uid}`;
        }

        // Fila de grupo
        const groupRow = sheet.addRow([nombreUsuario]);
        sheet.mergeCells(groupRow.number, 1, groupRow.number, numCols);
        groupRow.font = { bold: true };
        groupRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEAF7EF" },
        };

        for (const v of ventasUsr) {
          addVentaRow(v);
        }

        const usuarioTotal = ventasUsr
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
        const gananciaUsuario = ventasUsr
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.ganancia_neta) || 0), 0);

        const totalRow = sheet.addRow([]);
        totalRow.getCell(numCols - 3).value = `Total ${nombreUsuario}`;
        totalRow.getCell(numCols - 3).font = { bold: true };
        totalRow.getCell(numCols - 1).value = gananciaUsuario;
        totalRow.getCell(numCols - 1).font = { bold: true, color: { argb: gananciaUsuario >= 0 ? "FF2E7D32" : "FFC62828" } };
        totalRow.getCell(numCols - 1).numFmt = "#,##0.00";
        totalRow.getCell(numCols).value = usuarioTotal;
        totalRow.getCell(numCols).font = { bold: true };
        totalRow.getCell(numCols).numFmt = "#,##0.00";
        totalRow.getCell(numCols - 3).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDFF2E6" },
        };
        totalRow.getCell(numCols - 1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: gananciaUsuario >= 0 ? "FFE8F5E9" : "FFFFEBEE" },
        };
        totalRow.getCell(numCols).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDFF2E6" },
        };
      }
    } else if (orden === "tipo_venta") {
      // Agrupar por tipo de venta
      const byTipo = {};
      for (const v of ventas) {
        const tid = v.tipo_venta_valor || 1;
        if (!byTipo[tid]) byTipo[tid] = [];
        byTipo[tid].push(v);
      }

      for (const [tid, ventasTipo] of Object.entries(byTipo)) {
        if (!ventasTipo.length) continue;

        const nombreTipo =
          ventasTipo[0]?.tipo_venta || (tid == 2 ? "Facturado" : "Normal");

        // Fila de grupo
        const groupRow = sheet.addRow([nombreTipo]);
        sheet.mergeCells(groupRow.number, 1, groupRow.number, numCols);
        groupRow.font = { bold: true };
        groupRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEAF7EF" },
        };

        for (const v of ventasTipo) {
          addVentaRow(v);
        }

        const tipoTotal = ventasTipo
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.total) || 0), 0);
        const gananciaTipo = ventasTipo
          .filter((v) => v.incluida_en_totales)
          .reduce((acc, v) => acc + (parseFloat(v.ganancia_neta) || 0), 0);

        const totalRow = sheet.addRow([]);
        totalRow.getCell(numCols - 3).value = `Total ${nombreTipo}`;
        totalRow.getCell(numCols - 3).font = { bold: true };
        totalRow.getCell(numCols - 1).value = gananciaTipo;
        totalRow.getCell(numCols - 1).font = { bold: true, color: { argb: gananciaTipo >= 0 ? "FF2E7D32" : "FFC62828" } };
        totalRow.getCell(numCols - 1).numFmt = "#,##0.00";
        totalRow.getCell(numCols).value = tipoTotal;
        totalRow.getCell(numCols).font = { bold: true };
        totalRow.getCell(numCols).numFmt = "#,##0.00";
        totalRow.getCell(numCols - 3).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDFF2E6" },
        };
        totalRow.getCell(numCols - 1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: gananciaTipo >= 0 ? "FFE8F5E9" : "FFFFEBEE" },
        };
        totalRow.getCell(numCols).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDFF2E6" },
        };
      }
    }

    // Línea vacía antes del resumen
    sheet.addRow([]);

    // Calcular totales por método de pago (solo ventas incluidas en totales)
    let totalEfectivo = 0;
    let totalQR = 0;
    for (const v of ventas) {
      if (!v.incluida_en_totales) continue;
      const totalVenta = parseFloat(v.total) || 0;
      if (v.tipo_pago_valor === 2) {
        totalQR += totalVenta;
      } else {
        totalEfectivo += totalVenta;
      }
    }

    // Total Efectivo
    const totalEfectivoRow = sheet.addRow([]);
    totalEfectivoRow.getCell(numCols - 2).value = "Total Efectivo";
    totalEfectivoRow.getCell(numCols).value = totalEfectivo;
    totalEfectivoRow.getCell(numCols - 2).font = {
      bold: true,
      color: { argb: "FF388E3C" },
    };
    totalEfectivoRow.getCell(numCols).font = {
      bold: true,
      color: { argb: "FF388E3C" },
    };
    totalEfectivoRow.getCell(numCols).numFmt = "#,##0.00";
    totalEfectivoRow.getCell(numCols - 2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5E9" },
    };
    totalEfectivoRow.getCell(numCols).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5E9" },
    };

    // Total QR
    const totalQRRow = sheet.addRow([]);
    totalQRRow.getCell(numCols - 2).value = "Total QR";
    totalQRRow.getCell(numCols).value = totalQR;
    totalQRRow.getCell(numCols - 2).font = {
      bold: true,
      color: { argb: "FF1976D2" },
    };
    totalQRRow.getCell(numCols).font = {
      bold: true,
      color: { argb: "FF1976D2" },
    };
    totalQRRow.getCell(numCols).numFmt = "#,##0.00";
    totalQRRow.getCell(numCols - 2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5E9" },
    };
    totalQRRow.getCell(numCols).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5E9" },
    };

    // Línea vacía antes del total general
    sheet.addRow([]);

    // Total General
    const totalGlobalRow = sheet.addRow([]);
    totalGlobalRow.getCell(numCols - 2).value = "TOTAL GENERAL";
    totalGlobalRow.getCell(numCols).value = totalVentas;
    totalGlobalRow.getCell(numCols - 2).font = { bold: true, size: 12 };
    totalGlobalRow.getCell(numCols).font = { bold: true, size: 12 };
    totalGlobalRow.getCell(numCols).numFmt = "#,##0.00";
    totalGlobalRow.getCell(numCols - 2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFAED6F1" },
    };
    totalGlobalRow.getCell(numCols).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFAED6F1" },
    };

    // Ganancia Neta Total
    const gananciaTotalRow = sheet.addRow([]);
    gananciaTotalRow.getCell(numCols - 2).value = "GANANCIA NETA TOTAL";
    gananciaTotalRow.getCell(numCols - 1).value = totalGananciaNeta;
    gananciaTotalRow.getCell(numCols - 2).font = { bold: true, size: 12, color: { argb: totalGananciaNeta >= 0 ? "FF1A5276" : "FFC62828" } };
    gananciaTotalRow.getCell(numCols - 1).font = { bold: true, size: 12, color: { argb: totalGananciaNeta >= 0 ? "FF1A5276" : "FFC62828" } };
    gananciaTotalRow.getCell(numCols - 1).numFmt = "#,##0.00";
    gananciaTotalRow.getCell(numCols - 2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: totalGananciaNeta >= 0 ? "FFD5F5E3" : "FFFFEBEE" },
    };
    gananciaTotalRow.getCell(numCols - 1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: totalGananciaNeta >= 0 ? "FFD5F5E3" : "FFFFEBEE" },
    };

    // Total de ventas anuladas (si hay)
    if (totalVentasAnuladas > 0) {
      const totalAnuladasRow = sheet.addRow([]);
      totalAnuladasRow.getCell(numCols - 2).value = "TOTAL ANULADAS";
      totalAnuladasRow.getCell(numCols).value = totalVentasAnuladas;
      totalAnuladasRow.getCell(numCols - 2).font = {
        bold: true,
        size: 10,
        color: { argb: "FFC62828" },
      };
      totalAnuladasRow.getCell(numCols).font = {
        bold: true,
        size: 10,
        color: { argb: "FFC62828" },
      };
      totalAnuladasRow.getCell(numCols).numFmt = "#,##0.00";
      totalAnuladasRow.getCell(numCols - 2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFEBEE" },
      };
      totalAnuladasRow.getCell(numCols).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFEBEE" },
      };
    }

    // Formato general
    sheet.eachRow((row) => {
      row.font = { size: 9 };
      row.alignment = { vertical: "middle", wrapText: true };
    });

    // Generar buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = `ventas_reporte_resumido_${new Date().getTime()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error al generar Excel de ventas resumido:", error);
    res.status(500).send("Error al generar reporte Excel de ventas resumido");
  }
};

module.exports = {
  ventaNota,
  reporteVentasResumido,
  reporteVentasResumidoXlsx,
  reporteVentasDetallado,
  obtenerDatosVentasResumido,
  obtenerDatosVentasDetallado,
};
