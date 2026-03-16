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

// Helper para obtener fecha y hora formateada
const formatFechaHora = (fecha) => {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  const horas = String(d.getHours()).padStart(2, '0');
  const minutos = String(d.getMinutes()).padStart(2, '0');
  const segundos = String(d.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`;
};

// Helper para obtener fecha formateada corta
const formatFecha = (fecha) => {
  if (!fecha) return '';
  const d = new Date(fecha);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
};

// Reporte de Estado de Resultados
const reporteResultados = async (req, res) => {
  try {
    const {
      desde,
      hasta,
      tasa_impuesto = 13, // Tasa de impuesto por defecto 13% (Bolivia)
      nombreSistema = 'Auto Accesorios Pinedo'
    } = req.body || {};
    
    console.log('Reporte de Estado de Resultados - parámetros:', req.body);
    
    // Construir filtros para ventas
    const whereVenta = {
      estado: 1 // Solo ventas válidas
    };
    
    // Aplicar filtro de fechas si se proporcionan
    if (desde || hasta) {
      whereVenta.fecha_registro = {};
      if (desde && String(desde).trim() !== '') {
        whereVenta.fecha_registro[Op.gte] = String(desde).trim();
      }
      if (hasta && String(hasta).trim() !== '') {
        whereVenta.fecha_registro[Op.lte] = String(hasta).trim();
      }
    }
    
    // Construir filtros para gastos
    const whereGasto = {
      estado: 1 // Solo gastos válidos
    };
    
    // Aplicar filtro de fechas si se proporcionan
    if (desde || hasta) {
      whereGasto.fecha = {};
      if (desde && String(desde).trim() !== '') {
        whereGasto.fecha[Op.gte] = String(desde).trim();
      }
      if (hasta && String(hasta).trim() !== '') {
        whereGasto.fecha[Op.lte] = String(hasta).trim();
      }
    };
    
    // Obtener ventas con detalles
    const ventas = await db.venta.findAll({
      where: whereVenta,
      include: [
        {
          model: db.det_venta,
          required: false
        }
      ]
    });
    
    // Obtener gastos
    const gastos = await db.gasto.findAll({
      where: whereGasto
    });
    
    // ============= CÁLCULOS DEL ESTADO DE RESULTADOS =============
    
    // 1. INGRESOS POR VENTAS
    let ingresos = 0;
    ventas.forEach(venta => {
      const montoTotal = parseFloat(venta.monto_total) || 0;
      const descuento = parseFloat(venta.descuento) || 0;
      ingresos += (montoTotal - descuento);
    });
    
    // 2. COSTO DE VENTAS (COGS)
    let costoVentas = 0;
    ventas.forEach(venta => {
      if (venta.det_ventas && venta.det_ventas.length > 0) {
        venta.det_ventas.forEach(detalle => {
          const cantidad = parseFloat(detalle.cantidad) || 0;
          const precioCompra = parseFloat(detalle.precio_compra) || 0;
          costoVentas += (cantidad * precioCompra);
        });
      }
    });
    
    // 3. GANANCIA BRUTA
    const gananciaBruta = ingresos - costoVentas;
    
    // 4. GASTOS OPERATIVOS
    let gastosOperativos = 0;
    gastos.forEach(gasto => {
      gastosOperativos += parseFloat(gasto.monto) || 0;
    });
    
    // 5. GANANCIA OPERATIVA
    const gananciaOperativa = gananciaBruta - gastosOperativos;
    
    // 6. IMPUESTOS
    const tasaImpuesto = parseFloat(tasa_impuesto) || 0;
    const impuestos = gananciaOperativa > 0 ? (gananciaOperativa * tasaImpuesto / 100) : 0;
    
    // 7. GANANCIA NETA
    const gananciaNeta = gananciaOperativa - impuestos;
    
    // ============= GENERACIÓN DEL PDF =============
    
    // Logo
    const logo = await convertImageToBase64('../assets/logo2.jpeg');
    
    // Definir documento
    const docDefinition = {
      pageSize: 'LETTER',
      pageMargins: [40, 60, 40, 60],
      header: {
        margin: [40, 20, 40, 0],
        columns: [
          {
            image: logo,
            width: 60,
            height: 60
          },
          {
            stack: [
              { text: nombreSistema, style: 'header', alignment: 'center' },
              { text: 'ESTADO DE RESULTADOS', style: 'subheader', alignment: 'center' }
            ],
            width: '*'
          },
          {
            text: '',
            width: 60
          }
        ]
      },
      content: [
        // Información del período
        {
          margin: [0, 10, 0, 15],
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    { 
                      text: desde && hasta 
                        ? `Período: ${formatFecha(desde)} al ${formatFecha(hasta)}` 
                        : desde 
                          ? `Período: Desde ${formatFecha(desde)}` 
                          : hasta 
                            ? `Período: Hasta ${formatFecha(hasta)}` 
                            : 'Período: Todos los períodos', 
                      style: 'periodText' 
                    },
                    { text: `Fecha de generación: ${formatFechaHora(new Date())}`, style: 'dateText' }
                  ],
                  border: [true, true, true, true]
                }
              ]
            ]
          }
        },
        
        // Línea separadora
        {
          canvas: [
            {
              type: 'line',
              x1: 0, y1: 0,
              x2: 535, y2: 0,
              lineWidth: 2,
              lineColor: '#0066cc'
            }
          ],
          margin: [0, 0, 0, 15]
        },
        
        // Estado de Resultados - Tabla Principal
        {
          style: 'tableMain',
          table: {
            widths: ['*', 120],
            body: [
              // INGRESOS
              [
                { text: 'INGRESOS POR VENTAS', style: 'sectionTitle', colSpan: 2 },
                {}
              ],
              [
                { text: `   Ventas netas (${ventas.length} ventas)`, style: 'itemText' },
                { text: `Bs. ${formatNumber(ingresos)}`, style: 'amountPositive', alignment: 'right' }
              ],
              
              // COSTO DE VENTAS
              [
                { text: 'COSTO DE VENTAS', style: 'sectionTitle', colSpan: 2, margin: [0, 10, 0, 0] },
                {}
              ],
              [
                { text: '   Costo de productos vendidos', style: 'itemText' },
                { text: `Bs. ${formatNumber(costoVentas)}`, style: 'amountNegative', alignment: 'right' }
              ],
              
              // GANANCIA BRUTA
              [
                { text: 'GANANCIA BRUTA', style: 'subtotalTitle' },
                { text: `Bs. ${formatNumber(gananciaBruta)}`, style: gananciaBruta >= 0 ? 'subtotalPositive' : 'subtotalNegative', alignment: 'right' }
              ],
              
              // GASTOS OPERATIVOS
              [
                { text: 'GASTOS OPERATIVOS', style: 'sectionTitle', colSpan: 2, margin: [0, 10, 0, 0] },
                {}
              ],
              [
                { text: `   Gastos generales (${gastos.length} gastos)`, style: 'itemText' },
                { text: `Bs. ${formatNumber(gastosOperativos)}`, style: 'amountNegative', alignment: 'right' }
              ],
              
              // GANANCIA OPERATIVA
              [
                { text: 'GANANCIA OPERATIVA', style: 'subtotalTitle' },
                { text: `Bs. ${formatNumber(gananciaOperativa)}`, style: gananciaOperativa >= 0 ? 'subtotalPositive' : 'subtotalNegative', alignment: 'right' }
              ],
              
              // IMPUESTOS
              [
                { text: 'IMPUESTOS', style: 'sectionTitle', colSpan: 2, margin: [0, 10, 0, 0] },
                {}
              ],
              [
                { text: `   Impuesto a las ganancias (${tasaImpuesto}%)`, style: 'itemText' },
                { text: `Bs. ${formatNumber(impuestos)}`, style: 'amountNegative', alignment: 'right' }
              ],
              
              // Línea separadora antes del total
              [
                { 
                  canvas: [
                    {
                      type: 'line',
                      x1: 0, y1: 5,
                      x2: 440, y2: 5,
                      lineWidth: 2,
                      lineColor: '#000000'
                    }
                  ],
                  colSpan: 2,
                  border: [false, false, false, false]
                },
                {}
              ],
              
              // GANANCIA NETA
              [
                { text: 'GANANCIA NETA', style: 'totalTitle' },
                { text: `Bs. ${formatNumber(gananciaNeta)}`, style: gananciaNeta >= 0 ? 'totalPositive' : 'totalNegative', alignment: 'right' }
              ]
            ]
          },
          layout: {
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
            },
            fillColor: function (i, node) {
              // Alternar colores de fondo
              if (i === 0) return '#e8f4f8'; // INGRESOS header
              if (i === 4) return '#e8f4f8'; // COSTO header
              if (i === 6) return '#d4edda'; // GANANCIA BRUTA
              if (i === 7) return '#e8f4f8'; // GASTOS header
              if (i === 9) return '#d4edda'; // GANANCIA OPERATIVA
              if (i === 10) return '#e8f4f8'; // IMPUESTOS header
              if (i === 13) return gananciaNeta >= 0 ? '#28a745' : '#dc3545'; // GANANCIA NETA
              return null;
            }
          }
        },
        
        // Indicadores adicionales
        {
          margin: [0, 20, 0, 0],
          table: {
            widths: ['*', '*', '*'],
            body: [
              [
                { text: 'INDICADORES FINANCIEROS', style: 'indicatorHeader', colSpan: 3, alignment: 'center' },
                {},
                {}
              ],
              [
                {
                  stack: [
                    { text: 'Margen Bruto', style: 'indicatorLabel' },
                    { 
                      text: ingresos > 0 ? `${formatNumber((gananciaBruta / ingresos) * 100)}%` : '0.00%', 
                      style: 'indicatorValue' 
                    }
                  ],
                  alignment: 'center'
                },
                {
                  stack: [
                    { text: 'Margen Operativo', style: 'indicatorLabel' },
                    { 
                      text: ingresos > 0 ? `${formatNumber((gananciaOperativa / ingresos) * 100)}%` : '0.00%', 
                      style: 'indicatorValue' 
                    }
                  ],
                  alignment: 'center'
                },
                {
                  stack: [
                    { text: 'Margen Neto', style: 'indicatorLabel' },
                    { 
                      text: ingresos > 0 ? `${formatNumber((gananciaNeta / ingresos) * 100)}%` : '0.00%', 
                      style: 'indicatorValue' 
                    }
                  ],
                  alignment: 'center'
                }
              ]
            ]
          },
          layout: {
            fillColor: function (i) {
              return i === 0 ? '#0066cc' : '#f8f9fa';
            }
          }
        },
        
        // Nota al pie
        {
          margin: [0, 20, 0, 0],
          text: [
            { text: 'Nota: ', bold: true, fontSize: 8 },
            { 
              text: 'Este reporte incluye únicamente ventas y gastos con estado válido (estado = 1). Puede filtrar por período o mostrar todos los registros. Los valores se expresan en bolivianos (Bs.).', 
              fontSize: 8, 
              color: '#666666' 
            }
          ]
        }
      ],
      
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          color: '#0066cc',
          margin: [0, 0, 0, 5]
        },
        subheader: {
          fontSize: 14,
          bold: true,
          color: '#333333'
        },
        periodText: {
          fontSize: 11,
          bold: true,
          color: '#0066cc',
          alignment: 'center',
          margin: [5, 5, 5, 2]
        },
        dateText: {
          fontSize: 9,
          color: '#666666',
          alignment: 'center',
          margin: [5, 2, 5, 5]
        },
        tableMain: {
          margin: [0, 0, 0, 0],
          fontSize: 10
        },
        sectionTitle: {
          fontSize: 11,
          bold: true,
          color: '#0066cc',
          fillColor: '#e8f4f8',
          margin: [5, 5, 5, 5]
        },
        itemText: {
          fontSize: 10,
          color: '#333333',
          margin: [5, 5, 5, 5]
        },
        amountPositive: {
          fontSize: 10,
          color: '#28a745',
          bold: true,
          margin: [5, 5, 5, 5]
        },
        amountNegative: {
          fontSize: 10,
          color: '#dc3545',
          margin: [5, 5, 5, 5]
        },
        subtotalTitle: {
          fontSize: 11,
          bold: true,
          color: '#000000',
          margin: [5, 8, 5, 8]
        },
        subtotalPositive: {
          fontSize: 11,
          bold: true,
          color: '#28a745',
          margin: [5, 8, 5, 8]
        },
        subtotalNegative: {
          fontSize: 11,
          bold: true,
          color: '#dc3545',
          margin: [5, 8, 5, 8]
        },
        totalTitle: {
          fontSize: 13,
          bold: true,
          color: '#ffffff',
          margin: [5, 10, 5, 10]
        },
        totalPositive: {
          fontSize: 13,
          bold: true,
          color: '#ffffff',
          margin: [5, 10, 5, 10]
        },
        totalNegative: {
          fontSize: 13,
          bold: true,
          color: '#ffffff',
          margin: [5, 10, 5, 10]
        },
        indicatorHeader: {
          fontSize: 11,
          bold: true,
          color: '#ffffff',
          margin: [5, 8, 5, 8]
        },
        indicatorLabel: {
          fontSize: 9,
          color: '#666666',
          margin: [5, 5, 5, 2]
        },
        indicatorValue: {
          fontSize: 12,
          bold: true,
          color: '#0066cc',
          margin: [5, 2, 5, 5]
        }
      },
      
      defaultStyle: {
        font: 'Roboto'
      }
    };
    
    // Generar PDF
    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=estado_resultados_${desde}_${hasta}.pdf`);
    
    pdfDoc.pipe(res);
    pdfDoc.end();
    
  } catch (error) {
    console.error('Error en reporteResultados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar el reporte de estado de resultados',
      error: error.message
    });
  }
};

// Obtener datos del estado de resultados para mostrar en el frontend
const obtenerDatosResultados = async (req, res) => {
  try {
    const {
      desde,
      hasta,
      tasa_impuesto = 13
    } = req.query;
    
    console.log('Obtener datos de Estado de Resultados - parámetros:', req.query);
    console.log('Valores recibidos - desde:', desde, 'hasta:', hasta);
    
    // Construir filtros para ventas
    const whereVenta = {
      estado: 1 // Solo ventas válidas
    };
    
    // Aplicar filtro de fechas si se proporcionan
    if (desde || hasta) {
      whereVenta.fecha_registro = {};
      if (desde && String(desde).trim() !== '') {
        whereVenta.fecha_registro[Op.gte] = String(desde).trim();
      }
      if (hasta && String(hasta).trim() !== '') {
        whereVenta.fecha_registro[Op.lte] = String(hasta).trim();
      }
    }
    
    // Construir filtros para gastos
    const whereGasto = {
      estado: 1 // Solo gastos válidos
    };
    
    // Aplicar filtro de fechas si se proporcionan
    if (desde || hasta) {
      whereGasto.fecha = {};
      if (desde && String(desde).trim() !== '') {
        whereGasto.fecha[Op.gte] = String(desde).trim();
      }
      if (hasta && String(hasta).trim() !== '') {
        whereGasto.fecha[Op.lte] = String(hasta).trim();
      }
    };
    
    // Obtener ventas con detalles y productos
    const ventas = await db.venta.findAll({
      where: whereVenta,
      include: [
        {
          model: db.det_venta,
          required: false,
          include: [
            {
              model: db.producto,
              required: false
            }
          ]
        },
        {
          model: db.usuario,
          required: false,
          as: 'usuario_registro',
          include: [
            {
              model: db.empleado,
              required: false
            }
          ]
        },
        {
          model: db.cliente,
          required: false
        }
      ]
    });
    
    // Obtener gastos con información del usuario
    const gastos = await db.gasto.findAll({
      where: whereGasto,
      include: [
        {
          model: db.usuario,
          required: false,
          include: [
            {
              model: db.empleado,
              required: false
            }
          ]
        }
      ]
    });
    
    // ============= CÁLCULOS =============
    
    // 1. INGRESOS
    let ingresos = 0;
    let detalleVentas = [];
    
    ventas.forEach(venta => {
      const montoTotal = parseFloat(venta.monto_total) || 0;
      const descuento = parseFloat(venta.descuento) || 0;
      const ingresoVenta = montoTotal - descuento;
      ingresos += ingresoVenta;
      
      detalleVentas.push({
        id_venta: venta.id_venta,
        nro_venta: venta.nro_venta,
        fecha_registro: venta.fecha_registro,
        monto_total: montoTotal,
        descuento: descuento,
        monto_neto: ingresoVenta,
        tipo_pago: venta.tipo_pago,
        cliente: venta.cliente ? {
          nombre: venta.cliente.nombre,
          apellido: venta.cliente.apellido
        } : null,
        usuario: venta.usuario_registro ? {
          nombre_usuario: venta.usuario_registro.nombre_usuario,
          empleado: venta.usuario_registro.empleado ? {
            nombre: venta.usuario_registro.empleado.nombre,
            apellido: venta.usuario_registro.empleado.apellido
          } : null
        } : null
      });
    });
    
    // 2. COSTO DE VENTAS
    let costoVentas = 0;
    let detallesCostos = [];
    
    ventas.forEach(venta => {
      if (venta.det_ventas && venta.det_ventas.length > 0) {
        venta.det_ventas.forEach(detalle => {
          const cantidad = parseFloat(detalle.cantidad) || 0;
          const precioCompra = parseFloat(detalle.precio_compra) || 0;
          const precioVenta = parseFloat(detalle.precio_unitario) || 0;
          const costoItem = cantidad * precioCompra;
          const ingresoItem = cantidad * precioVenta;
          const margenItem = ingresoItem - costoItem;
          
          costoVentas += costoItem;
          
          detallesCostos.push({
            id_venta: venta.id_venta,
            nro_venta: venta.nro_venta,
            producto: detalle.producto ? {
              id_producto: detalle.producto.id_producto,
              codigo: detalle.producto.codigo,
              nombre: detalle.producto.nombre
            } : null,
            cantidad: cantidad,
            precio_compra: precioCompra,
            precio_venta: precioVenta,
            costo_total: costoItem,
            ingreso_total: ingresoItem,
            margen: margenItem,
            margen_porcentaje: precioCompra > 0 ? ((margenItem / costoItem) * 100) : 0
          });
        });
      }
    });
    
    // 3. GANANCIA BRUTA
    const gananciaBruta = ingresos - costoVentas;
    
    // 4. GASTOS OPERATIVOS
    let gastosOperativos = 0;
    let detalleGastos = [];
    
    gastos.forEach(gasto => {
      const montoGasto = parseFloat(gasto.monto) || 0;
      gastosOperativos += montoGasto;
      
      detalleGastos.push({
        id_gasto: gasto.id_gasto,
        monto: montoGasto,
        fecha: gasto.fecha,
        categoria: gasto.categoria,
        descripcion: gasto.descripcion,
        usuario: gasto.usuario_registro ? {
          nombre_usuario: gasto.usuario_registro.nombre_usuario,
          empleado: gasto.usuario_registro.empleado ? {
            nombre: gasto.usuario_registro.empleado.nombre,
            apellido: gasto.usuario_registro.empleado.apellido
          } : null
        } : null
      });
    });
    
    // 5. GANANCIA OPERATIVA
    const gananciaOperativa = gananciaBruta - gastosOperativos;
    
    // 6. IMPUESTOS
    const tasaImpuesto = parseFloat(tasa_impuesto) || 0;
    const impuestos = gananciaOperativa > 0 ? (gananciaOperativa * tasaImpuesto / 100) : 0;
    
    // 7. GANANCIA NETA
    const gananciaNeta = gananciaOperativa - impuestos;
    
    // 8. INDICADORES
    const margenBruto = ingresos > 0 ? (gananciaBruta / ingresos) * 100 : 0;
    const margenOperativo = ingresos > 0 ? (gananciaOperativa / ingresos) * 100 : 0;
    const margenNeto = ingresos > 0 ? (gananciaNeta / ingresos) * 100 : 0;
    
    // Respuesta JSON
    const response = {
      success: true,
      fecha_generacion: new Date().toISOString(),
      filtros: {
        desde: desde || null,
        hasta: hasta || null,
        tasa_impuesto: tasaImpuesto,
        periodo_texto: desde && hasta 
          ? `${desde} al ${hasta}` 
          : desde 
            ? `Desde ${desde}` 
            : hasta 
              ? `Hasta ${hasta}` 
              : 'Todos los períodos'
      },
      estado_resultados: {
        ingresos: {
          total: parseFloat(ingresos.toFixed(2)),
          cantidad_ventas: ventas.length,
          detalle: detalleVentas
        },
        costo_ventas: {
          total: parseFloat(costoVentas.toFixed(2)),
          cantidad_items: detallesCostos.length,
          detalle: detallesCostos
        },
        ganancia_bruta: {
          total: parseFloat(gananciaBruta.toFixed(2)),
          porcentaje: parseFloat(margenBruto.toFixed(2))
        },
        gastos_operativos: {
          total: parseFloat(gastosOperativos.toFixed(2)),
          cantidad_gastos: gastos.length,
          detalle: detalleGastos
        },
        ganancia_operativa: {
          total: parseFloat(gananciaOperativa.toFixed(2)),
          porcentaje: parseFloat(margenOperativo.toFixed(2))
        },
        impuestos: {
          total: parseFloat(impuestos.toFixed(2)),
          tasa: tasaImpuesto
        },
        ganancia_neta: {
          total: parseFloat(gananciaNeta.toFixed(2)),
          porcentaje: parseFloat(margenNeto.toFixed(2))
        }
      },
      indicadores: {
        margen_bruto_porcentaje: parseFloat(margenBruto.toFixed(2)),
        margen_operativo_porcentaje: parseFloat(margenOperativo.toFixed(2)),
        margen_neto_porcentaje: parseFloat(margenNeto.toFixed(2)),
        ratio_gastos_ingresos: ingresos > 0 ? parseFloat(((gastosOperativos / ingresos) * 100).toFixed(2)) : 0,
        ratio_costo_ingresos: ingresos > 0 ? parseFloat(((costoVentas / ingresos) * 100).toFixed(2)) : 0
      },
      nota: 'Este reporte incluye únicamente ventas y gastos con estado válido (estado = 1). Puede filtrar por período o mostrar todos los registros.'
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error en obtenerDatosResultados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos del estado de resultados',
      error: error.message
    });
  }
};

module.exports = {
  reporteResultados,
  obtenerDatosResultados
};
