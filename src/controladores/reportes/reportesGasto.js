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

// Helper para obtener nombre del mes
const getNombreMes = (fecha) => {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const d = new Date(fecha);
  return `${meses[d.getMonth()]} ${d.getFullYear()}`;
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

// Helper para obtener clave de mes-año
const getMesAnioKey = (fecha) => {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Reporte de gastos ordenado por meses
const reporteGastos = async (req, res) => {
  try {
    const {
      id_usuario,
      id_categoria,
      estado,
      desde,
      hasta,
      usuario = '',
      nombreSistema = 'TarijaSport'
    } = req.body || {};
    
    console.log('Reporte de gastos - parámetros:', req.body);
    
    // Construir filtros para gastos
    const whereGasto = {};
    
    // Filtro por usuario específico
    if (id_usuario && String(id_usuario).trim() !== '') {
      whereGasto.id_usuario = parseInt(id_usuario);
    }
    
    // Filtro por categoría
    if (id_categoria !== undefined && String(id_categoria).trim() !== '') {
      whereGasto.categoria = parseInt(id_categoria);
    }
    
    // Filtro por estado
    if (estado !== undefined && String(estado).trim() !== '') {
      whereGasto.estado = parseInt(estado);
    }
    
    // Filtro por rango de fechas
    if (desde || hasta) {
      if (desde && String(desde).trim() !== '') {
        whereGasto.fecha = whereGasto.fecha || {};
        whereGasto.fecha[Op.gte] = String(desde).trim();
      }
      
      if (hasta && String(hasta).trim() !== '') {
        whereGasto.fecha = whereGasto.fecha || {};
        whereGasto.fecha[Op.lte] = String(hasta).trim();
      }
    }
    
    console.log('Where clause gastos:', whereGasto);
    
    // Obtener gastos con usuario
    const gastos = await db.gasto.findAll({
      where: whereGasto,
      order: [["fecha", "ASC"], ["id_gasto", "ASC"]],
      include: [
        {
          model: db.usuario,
          required: false,
          include: [{
            model: db.empleado,
            required: false
          }]
        }
      ]
    });
    
    // Agrupar gastos por mes
    const gastosPorMes = {};
    const gastosPorUsuario = {};
    
    // Contadores por estado
    let totalValidos = 0;
    let totalAnulados = 0;
    let cantidadValidos = 0;
    let cantidadAnulados = 0;
    
    gastos.forEach(gasto => {
      const mesKey = getMesAnioKey(gasto.fecha);
      const mesNombre = getNombreMes(gasto.fecha);
      
      if (!gastosPorMes[mesKey]) {
        gastosPorMes[mesKey] = {
          nombre: mesNombre,
          gastos: [],
          total: 0
        };
      }
      
      gastosPorMes[mesKey].gastos.push(gasto);
      gastosPorMes[mesKey].total += parseFloat(gasto.monto) || 0;
      
      // Contabilizar por estado
      const monto = parseFloat(gasto.monto) || 0;
      if (gasto.estado === 1) {
        totalValidos += monto;
        cantidadValidos++;
      } else {
        totalAnulados += monto;
        cantidadAnulados++;
      }
      
      // Agrupar por usuario también
      const usuarioId = gasto.id_usuario || 'sin_usuario';
      if (!gastosPorUsuario[usuarioId]) {
        const nombreUsuario = gasto.usuario?.empleado 
          ? `${gasto.usuario.empleado.nombre || ''} ${gasto.usuario.empleado.apellido_paterno || ''}`.trim()
          : (gasto.usuario?.usuario || 'Sin usuario');
        gastosPorUsuario[usuarioId] = {
          nombre: nombreUsuario,
          total: 0,
          cantidad: 0,
          totalValidos: 0,
          cantidadValidos: 0,
          totalAnulados: 0,
          cantidadAnulados: 0
        };
      }
      gastosPorUsuario[usuarioId].total += monto;
      gastosPorUsuario[usuarioId].cantidad++;
      
      if (gasto.estado === 1) {
        gastosPorUsuario[usuarioId].totalValidos += monto;
        gastosPorUsuario[usuarioId].cantidadValidos++;
      } else {
        gastosPorUsuario[usuarioId].totalAnulados += monto;
        gastosPorUsuario[usuarioId].cantidadAnulados++;
      }
    });
    
    // Construir tabla
    const body = [];
    const headerRow = [
      { text: 'Nro', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Fecha y Hora', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Usuario', bold: true, fillColor: '#dff2e6', fontSize: 9,width: '*' },
      { text: 'Categoría', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'center' },
      { text: 'Descripción', bold: true, fillColor: '#dff2e6', fontSize: 9 },
      { text: 'Estado', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'center' },
      { text: 'Monto', bold: true, fillColor: '#dff2e6', fontSize: 9, alignment: 'right' }
    ];
    body.push(headerRow);
    
    let totalGeneral = 0;
    let contador = 1;
    
    // Ordenar meses cronológicamente
    const mesesOrdenados = Object.keys(gastosPorMes).sort();
    
    // Agregar filas de datos agrupadas por mes
    mesesOrdenados.forEach(mesKey => {
      const datosMes = gastosPorMes[mesKey];
      
      // Encabezado del mes
      body.push([
        { text: datosMes.nombre, colSpan: 7, bold: true, fillColor: '#e8f5e9', fontSize: 10, margin: [0, 5, 0, 5] },
        {}, {}, {}, {}, {}, {}
      ]);
      
      // Gastos del mes
      datosMes.gastos.forEach(gasto => {
        const fechaHora = formatFechaHora(gasto.fecha);
        const nombreUsuario = gasto.usuario?.empleado 
          ? `${gasto.usuario.empleado.nombre || ''} ${gasto.usuario.empleado.apellido_paterno || ''}`.trim()
          : (gasto.usuario?.usuario || 'Sin usuario');
        
        const categoriaTexto = gasto.categoria || '';
        const descripcion = gasto.descripcion || '';
        const estadoText = gasto.estado === 1 ? 'Válido' : 'Anulado';
        const estadoColor = gasto.estado === 1 ? '#00aa00' : '#aa0000';
        const monto = parseFloat(gasto.monto) || 0;
        
        totalGeneral += monto;
        
        body.push([
          { text: String(contador), fontSize: 8 },
          { text: fechaHora, fontSize: 8 },
          { text: nombreUsuario, fontSize: 8 },
          { text: String(categoriaTexto), fontSize: 8, alignment: 'center' },
          { text: descripcion, fontSize: 8 },
          { text: estadoText, fontSize: 8, alignment: 'center', color: estadoColor },
          { text: formatNumber(monto), fontSize: 8, alignment: 'right', bold: true }
        ]);
        
        contador++;
      });
      
      // Total del mes
      body.push([
        { text: `Total ${datosMes.nombre}`, bold: true, colSpan: 6, fillColor: '#c8e6c9', fontSize: 8, alignment: 'right' },
        {}, {}, {}, {}, {},
        { text: formatNumber(datosMes.total), bold: true, fillColor: '#c8e6c9', fontSize: 8, alignment: 'right' }
      ]);
      
      // Línea separadora entre meses
      body.push([
        { text: '', colSpan: 7, border: [false, false, false, true], margin: [0, 5, 0, 5] },
        {}, {}, {}, {}, {}, {}
      ]);
    });
    
    // Total general
    body.push([
      { text: 'TOTAL GENERAL', bold: true, colSpan: 6, fillColor: '#aed6f1', fontSize: 10 },
      {}, {}, {}, {}, {},
      { text: formatNumber(totalGeneral), bold: true, fillColor: '#aed6f1', alignment: 'right', fontSize: 10 }
    ]);
    
    // Totales por estado
    body.push([
      { text: 'TOTALES POR ESTADO', bold: true, colSpan: 7, fillColor: '#f5f5f5', fontSize: 10, alignment: 'center', margin: [0, 10, 0, 5] },
      {}, {}, {}, {}, {}, {}
    ]);
    
    body.push([
      { text: 'Estado', bold: true, colSpan: 4, fillColor: '#e8e8e8', fontSize: 9 },
      {}, {}, {},
      { text: 'Cantidad', bold: true, fillColor: '#e8e8e8', fontSize: 9, alignment: 'center' },
      { text: 'Monto', bold: true, colSpan: 2, fillColor: '#e8e8e8', fontSize: 9, alignment: 'right' },
      {}
    ]);
    
    body.push([
      { text: 'Válido', colSpan: 4, fontSize: 8, color: '#00aa00' },
      {}, {}, {},
      { text: String(cantidadValidos), fontSize: 8, alignment: 'center' },
      { text: formatNumber(totalValidos), colSpan: 2, fontSize: 8, alignment: 'right', bold: true },
      {}
    ]);
    
    body.push([
      { text: 'Anulado', colSpan: 4, fontSize: 8, color: '#aa0000' },
      {}, {}, {},
      { text: String(cantidadAnulados), fontSize: 8, alignment: 'center' },
      { text: formatNumber(totalAnulados), colSpan: 2, fontSize: 8, alignment: 'right', bold: true },
      {}
    ]);
    
    // Resumen por usuario (si no se filtró por usuario específico)
    if (!id_usuario || String(id_usuario).trim() === '') {
      body.push([
        { text: '', colSpan: 7, border: [false, true, false, false], margin: [0, 10, 0, 5] },
        {}, {}, {}, {}, {}, {}
      ]);
      
      body.push([
        { text: 'RESUMEN POR USUARIO', bold: true, colSpan: 7, fillColor: '#f5f5f5', fontSize: 10, alignment: 'center' },
        {}, {}, {}, {}, {}, {}
      ]);
      
      body.push([
        { text: 'Usuario', bold: true, rowSpan: 2, fillColor: '#e8e8e8', fontSize: 9 },
        { text: 'Válidos', bold: true, colSpan: 2, fillColor: '#e8e8e8', fontSize: 9, alignment: 'center' },
        {},
        { text: 'Anulados', bold: true, colSpan: 2, fillColor: '#e8e8e8', fontSize: 9, alignment: 'center' },
        {},
        { text: 'Total', bold: true, colSpan: 2, rowSpan: 2, fillColor: '#e8e8e8', fontSize: 9, alignment: 'right' },
        {}
      ]);
      
      body.push([
        {},
        { text: 'Cant.', bold: true, fillColor: '#e8e8e8', fontSize: 8, alignment: 'center' },
        { text: 'Monto', bold: true, fillColor: '#e8e8e8', fontSize: 8, alignment: 'right' },
        { text: 'Cant.', bold: true, fillColor: '#e8e8e8', fontSize: 8, alignment: 'center' },
        { text: 'Monto', bold: true, fillColor: '#e8e8e8', fontSize: 8, alignment: 'right' },
        {},
        {}
      ]);
      
      Object.entries(gastosPorUsuario).forEach(([usuarioId, datos]) => {
        body.push([
          { text: datos.nombre, fontSize: 8 },
          { text: String(datos.cantidadValidos), fontSize: 8, alignment: 'center' },
          { text: formatNumber(datos.totalValidos), fontSize: 8, alignment: 'right' },
          { text: String(datos.cantidadAnulados), fontSize: 8, alignment: 'center' },
          { text: formatNumber(datos.totalAnulados), fontSize: 8, alignment: 'right' },
          { text: formatNumber(datos.total), colSpan: 2, fontSize: 8, alignment: 'right', bold: true },
          {}
        ]);
      });
    }
    
    // Configurar anchos de columna
    const colWidths = [30, 90, '*', 50, '*', 50, 70];
    
    const printer = new PdfPrinter(fonts);
    const logo = convertImageToBase64('../assets/logo2.jpeg');
    
    const filtroLines = [];
    if (id_usuario) {
      const usuarioFiltrado = gastos.find(g => g.id_usuario == id_usuario);
      if (usuarioFiltrado) {
        const nombreUsr = usuarioFiltrado.usuario?.empleado 
          ? `${usuarioFiltrado.usuario.empleado.nombre || ''} ${usuarioFiltrado.usuario.empleado.apellido_paterno || ''}`.trim()
          : usuarioFiltrado.usuario?.usuario;
        filtroLines.push(`Usuario: ${nombreUsr}`);
      }
    }
    if (id_categoria !== undefined && id_categoria !== null) {
      filtroLines.push(`Categoría: ${id_categoria}`);
    }
    if (estado !== undefined && estado !== null) {
      filtroLines.push(`Estado: ${estado == 1 ? 'Válido' : 'Anulado'}`);
    }
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    if (!filtroLines.length) filtroLines.push('Todos los gastos');
    
    const encabezadoCols = [
      { image: logo, width: 70 },
      {
        stack: [
          { text: 'Reporte de Gastos - Agrupado por Meses', style: 'titulo' },
          ...filtroLines.map(l => ({ text: l, style: 'filtro' }))
        ],
        margin: [10, 0, 0, 0],
        width: '*'
      },
      {
        stack: [
          { text: `Generado por: ${usuario || 'desconocido'}`, alignment: 'right', fontSize: 8 },
          { text: `Sistema: ${nombreSistema || 'TarijaSport'}`, alignment: 'right', fontSize: 8 },
          { text: `Fecha: ${new Date().toLocaleString('es-BO')}`, alignment: 'right', fontSize: 8 }
        ],
        width: 150
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
          { text: `Generado: ${new Date().toLocaleString('es-BO')} por: ${usuario || 'desconocido'}`, alignment: 'left', margin: [40, 0, 0, 0], fontSize: 8 },
          { text: `${nombreSistema || 'TarijaSport'} - Página ${currentPage} de ${pageCount}`, alignment: 'right', margin: [0, 0, 40, 0], fontSize: 8 }
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
      res.setHeader('Content-Disposition', 'inline; filename=reporte_gastos.pdf');
      res.send(pdfBuffer);
    });
    pdfDoc.end();
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al generar reporte de gastos');
  }
};

// Obtener datos de gastos para vista previa (sin generar PDF)
const obtenerDatosGastos = async (req, res) => {
  try {
    const {
      id_usuario,
      id_categoria,
      estado,
      desde,
      hasta
    } = req.query;
    
    console.log('Obtener datos de gastos - parámetros:', req.body);
    
    // Construir filtros para gastos
    const whereGasto = {};
    
    // Filtro por usuario específico
    if (id_usuario && String(id_usuario).trim() !== '') {
      whereGasto.id_usuario = parseInt(id_usuario);
    }
    
    // Filtro por categoría
    if (id_categoria !== undefined && String(id_categoria).trim() !== '') {
      whereGasto.categoria = parseInt(id_categoria);
    }
    
    // Filtro por estado
    if (estado !== undefined && String(estado).trim() !== '') {
      whereGasto.estado = parseInt(estado);
    }
    
    // Filtro por rango de fechas
    if (desde || hasta) {
      if (desde && String(desde).trim() !== '') {
        whereGasto.fecha = whereGasto.fecha || {};
        whereGasto.fecha[Op.gte] = String(desde).trim();
      }
      
      if (hasta && String(hasta).trim() !== '') {
        whereGasto.fecha = whereGasto.fecha || {};
        whereGasto.fecha[Op.lte] = String(hasta).trim();
      }
    }
    
    // Obtener gastos con usuario
    const gastosRaw = await db.gasto.findAll({
      where: whereGasto,
      order: [["fecha", "DESC"], ["id_gasto", "DESC"]],
      include: [
        {
          model: db.usuario,
          required: false,
          attributes: ['id_usuario', 'usuario'],
          include: [{
            model: db.empleado,
            required: false,
            attributes: ['nombre', 'ap_paterno', 'ap_materno']
          }]
        },
      ]
    });
    
    const gastos = gastosRaw.map(g => g.get ? g.get({ plain: true }) : g);
    
    // Agrupar gastos por mes
    const gastosPorMes = {};
    
    // Contadores por estado
    let totalValidos = 0;
    let totalAnulados = 0;
    let cantidadValidos = 0;
    let cantidadAnulados = 0;
    let totalGeneral = 0;
    
    // Resumen por usuario
    const gastosPorUsuario = {};
    
    gastos.forEach(gasto => {
      const mesKey = getMesAnioKey(gasto.fecha);
      const mesNombre = getNombreMes(gasto.fecha);
      const monto = parseFloat(gasto.monto) || 0;
      
      // Agrupar por mes
      if (!gastosPorMes[mesKey]) {
        gastosPorMes[mesKey] = {
          mes_anio: mesKey,
          nombre_mes: mesNombre,
          gastos: [],
          total: 0,
          cantidad: 0
        };
      }
      
      gastosPorMes[mesKey].gastos.push(gasto);
      gastosPorMes[mesKey].total += monto;
      gastosPorMes[mesKey].cantidad++;
      
      totalGeneral += monto;
      
      // Contabilizar por estado
      if (gasto.estado === 1) {
        totalValidos += monto;
        cantidadValidos++;
      } else {
        totalAnulados += monto;
        cantidadAnulados++;
      }
      
      // Agrupar por usuario
      const usuarioId = gasto.id_usuario || 'sin_usuario';
      if (!gastosPorUsuario[usuarioId]) {
        const nombreUsuario = gasto.usuario?.empleado 
          ? `${gasto.usuario.empleado.nombre || ''} ${gasto.usuario.empleado.ap_paterno || ''} ${gasto.usuario.empleado.ap_materno || ''}`.trim()
          : (gasto.usuario?.usuario || 'Sin usuario');
        gastosPorUsuario[usuarioId] = {
          id_usuario: usuarioId !== 'sin_usuario' ? gasto.id_usuario : null,
          nombre: nombreUsuario,
          total: 0,
          cantidad: 0,
          total_validos: 0,
          cantidad_validos: 0,
          total_anulados: 0,
          cantidad_anulados: 0
        };
      }
      gastosPorUsuario[usuarioId].total += monto;
      gastosPorUsuario[usuarioId].cantidad++;
      
      if (gasto.estado === 1) {
        gastosPorUsuario[usuarioId].total_validos += monto;
        gastosPorUsuario[usuarioId].cantidad_validos++;
      } else {
        gastosPorUsuario[usuarioId].total_anulados += monto;
        gastosPorUsuario[usuarioId].cantidad_anulados++;
      }
    });
    
    // Convertir gastos por mes a array y ordenar
    const mesesArray = Object.keys(gastosPorMes)
      .sort()
      .map(mesKey => {
        const datosMes = gastosPorMes[mesKey];
        
        // Procesar gastos del mes
        const gastosProcesados = datosMes.gastos.map(gasto => {
          const usuario = gasto.usuario ? {
            id_usuario: gasto.usuario.id_usuario,
            nombre_usuario: gasto.usuario.usuario,
            nombre_completo: gasto.usuario.empleado 
              ? `${gasto.usuario.empleado.nombre} ${gasto.usuario.empleado.ap_paterno} ${gasto.usuario.empleado.ap_materno}`.trim()
              : gasto.usuario.usuario
          } : null;
          
          return {
            id_gasto: gasto.id_gasto,
            fecha: gasto.fecha,
            usuario: usuario,
            categoria: gasto.categoria,
            descripcion: gasto.descripcion || '',
            monto: parseFloat((gasto.monto || 0).toFixed(2)),
            estado: gasto.estado === 1 ? 'Válido' : 'Anulado',
            estado_valor: gasto.estado,
            incluido_en_totales: gasto.estado === 1
          };
        });
        
        return {
          mes_anio: datosMes.mes_anio,
          nombre_mes: datosMes.nombre_mes,
          cantidad_gastos: datosMes.cantidad,
          total_mes: parseFloat(datosMes.total.toFixed(2)),
          gastos: gastosProcesados
        };
      });
    
    // Convertir resumen por usuario a array
    const usuariosArray = Object.values(gastosPorUsuario).map(usuario => ({
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      total: parseFloat(usuario.total.toFixed(2)),
      cantidad: usuario.cantidad,
      total_validos: parseFloat(usuario.total_validos.toFixed(2)),
      cantidad_validos: usuario.cantidad_validos,
      total_anulados: parseFloat(usuario.total_anulados.toFixed(2)),
      cantidad_anulados: usuario.cantidad_anulados
    }));
    
    // Construir respuesta
    const respuesta = {
      fecha_generacion: new Date().toLocaleString('es-ES'),
      filtros: {
        id_usuario: id_usuario || null,
        id_categoria: id_categoria || null,
        estado: estado || null,
        desde: desde || null,
        hasta: hasta || null
      },
      totales: {
        total_gastos: gastos.length,
        gastos_validos: cantidadValidos,
        gastos_anulados: cantidadAnulados,
        monto_total_general: parseFloat(totalGeneral.toFixed(2)),
        monto_total_validos: parseFloat(totalValidos.toFixed(2)),
        monto_total_anulados: parseFloat(totalAnulados.toFixed(2))
      },
      nota: "Los totales incluyen todos los gastos. Los gastos anulados están marcados con estado='Anulado'.",
      gastos_por_mes: mesesArray,
      resumen_por_usuario: usuariosArray
    };
    
    return res.status(200).json(respuesta);
    
  } catch (error) {
    console.error("Error en obtenerDatosGastos:", error);
    return res.status(500).json({ 
      mensaje: "Error al obtener los datos de gastos", 
      error: error.message 
    });
  }
};
const reporteGastosXlsx = async (req, res) => {
  try {
    const ExcelJS = require("exceljs");

    const {
      id_usuario,
      id_categoria,
      estado,
      desde,
      hasta,
      usuario = '',
      nombreSistema = 'TarijaSport'
    } = req.body || {};

    // Construir filtros
    const whereGasto = {};
    if (id_usuario && String(id_usuario).trim() !== '') {
      whereGasto.id_usuario = parseInt(id_usuario);
    }
    if (id_categoria !== undefined && id_categoria !== null && String(id_categoria).trim() !== '') {
      whereGasto.categoria = parseInt(id_categoria);
    }
    if (estado !== undefined && estado !== null && String(estado).trim() !== '') {
      whereGasto.estado = parseInt(estado);
    }
    if (desde && String(desde).trim() !== '') {
      whereGasto.fecha = whereGasto.fecha || {};
      whereGasto.fecha[Op.gte] = String(desde).trim();
    }
    if (hasta && String(hasta).trim() !== '') {
      whereGasto.fecha = whereGasto.fecha || {};
      whereGasto.fecha[Op.lte] = String(hasta).trim();
    }

    const gastosRaw = await db.gasto.findAll({
      where: whereGasto,
      order: [["fecha", "ASC"], ["id_gasto", "ASC"]],
      include: [
        {
          model: db.usuario,
          required: false,
          include: [{ model: db.empleado, required: false }]
        }
      ]
    });

    const gastos = gastosRaw.map(g => g.get ? g.get({ plain: true }) : g);

    // Agrupar por mes y calcular totales
    const gastosPorMes = {};
    const gastosPorUsuario = {};
    let totalValidos = 0, totalAnulados = 0, cantidadValidos = 0, cantidadAnulados = 0, totalGeneral = 0;

    gastos.forEach(gasto => {
      const mesKey = getMesAnioKey(gasto.fecha);
      const mesNombre = getNombreMes(gasto.fecha);
      const monto = parseFloat(gasto.monto) || 0;

      if (!gastosPorMes[mesKey]) {
        gastosPorMes[mesKey] = { nombre: mesNombre, gastos: [], total: 0 };
      }
      gastosPorMes[mesKey].gastos.push(gasto);
      gastosPorMes[mesKey].total += monto;
      totalGeneral += monto;

      if (gasto.estado === 1) { totalValidos += monto; cantidadValidos++; }
      else { totalAnulados += monto; cantidadAnulados++; }

      const uid = gasto.id_usuario || 'sin_usuario';
      if (!gastosPorUsuario[uid]) {
        const nombreUsr = gasto.usuario?.empleado
          ? `${gasto.usuario.empleado.nombre || ''} ${gasto.usuario.empleado.ap_paterno || ''}`.trim()
          : (gasto.usuario?.usuario || 'Sin usuario');
        gastosPorUsuario[uid] = { nombre: nombreUsr, total: 0, cantidad: 0, totalValidos: 0, cantidadValidos: 0, totalAnulados: 0, cantidadAnulados: 0 };
      }
      gastosPorUsuario[uid].total += monto;
      gastosPorUsuario[uid].cantidad++;
      if (gasto.estado === 1) { gastosPorUsuario[uid].totalValidos += monto; gastosPorUsuario[uid].cantidadValidos++; }
      else { gastosPorUsuario[uid].totalAnulados += monto; gastosPorUsuario[uid].cantidadAnulados++; }
    });

    // Armar líneas de filtro para cabecera
    const filtroLines = [];
    if (id_usuario) {
      const gFiltrado = gastos.find(g => g.id_usuario == id_usuario);
      if (gFiltrado) {
        const nUsr = gFiltrado.usuario?.empleado
          ? `${gFiltrado.usuario.empleado.nombre || ''} ${gFiltrado.usuario.empleado.ap_paterno || ''}`.trim()
          : gFiltrado.usuario?.usuario;
        filtroLines.push(`Usuario: ${nUsr}`);
      }
    }
    if (id_categoria !== undefined && id_categoria !== null && String(id_categoria).trim() !== '') {
      filtroLines.push(`Categoría: ${id_categoria}`);
    }
    if (estado !== undefined && estado !== null && String(estado).trim() !== '') {
      filtroLines.push(`Estado: ${parseInt(estado) === 1 ? 'Válido' : 'Anulado'}`);
    }
    if (desde) filtroLines.push(`Desde: ${desde}`);
    if (hasta) filtroLines.push(`Hasta: ${hasta}`);
    if (!filtroLines.length) filtroLines.push('Todos los gastos');

    // Colores ARGB
    const COLOR = {
      headerBg:     'FF2E7D32', // verde oscuro para título
      headerFg:     'FFFFFFFF',
      colHeader:    'FF1B5E20', // verde muy oscuro para cabecera de columnas
      colHeaderFg:  'FFFFFFFF',
      mesBg:        'FFE8F5E9', // verde pálido para cabecera de mes
      mesFg:        'FF1B5E20',
      mesTotalBg:   'FF81C784', // verde medio para total mes
      generalBg:    'FF1565C0', // azul oscuro para total general
      generalFg:    'FFFFFFFF',
      validoBg:     'FFD5F5E3', // verde suave
      anuladoBg:    'FFFDEDEC', // rojo suave
      estadoHdrBg:  'FF0D47A1', // azul marino para cabecera sección estado
      estadoHdrFg:  'FFFFFFFF',
      usuarioHdrBg: 'FF4A148C', // violeta para cabecera sección usuario
      usuarioHdrFg: 'FFFFFFFF',
      usuarioRowBg: 'FFEDE7F6', // violeta pálido para filas usuario
      usuarioColHdrBg: 'FF7B1FA2',
      usuarioColHdrFg: 'FFFFFFFF',
      altRow:       'FFF1F8E9', // verde muy pálido filas alternadas
      filterBg:     'FFFFF9C4', // amarillo pálido para filtros
      subtitleBg:   'FFE3F2FD', // azul muy pálido
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = nombreSistema;
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Gastos');
    const NUM_COLS = 7;

    const applyCellStyle = (cell, bgArgb, fgArgb, bold = false, size = 10, hAlign = 'left') => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
      cell.font = { bold, size, color: { argb: fgArgb || 'FF000000' } };
      cell.alignment = { horizontal: hAlign, vertical: 'middle', wrapText: true };
    };

    const mergeAndStyle = (rowNum, colStart, colEnd, value, bgArgb, fgArgb, bold, size, hAlign) => {
      if (colStart < colEnd) sheet.mergeCells(rowNum, colStart, rowNum, colEnd);
      const cell = sheet.getCell(rowNum, colStart);
      cell.value = value;
      applyCellStyle(cell, bgArgb, fgArgb, bold, size, hAlign);
      return cell;
    };

    // Anchos de columna
    sheet.columns = [
      { key: 'nro',        width: 6  },
      { key: 'fecha',      width: 20 },
      { key: 'usuario',    width: 26 },
      { key: 'categoria',  width: 14 },
      { key: 'descripcion',width: 34 },
      { key: 'estado',     width: 10 },
      { key: 'monto',      width: 16 }
    ];

    // ── FILA 1: Título ──────────────────────────────────────────────────────
    const tRow = sheet.addRow([]);
    mergeAndStyle(tRow.number, 1, NUM_COLS, 'Reporte de Gastos - Agrupado por Meses', COLOR.headerBg, COLOR.headerFg, true, 14, 'center');
    tRow.height = 30;

    // ── FILA 2: Subtítulo con sistema y usuario ──────────────────────────────
    const sRow = sheet.addRow([]);
    mergeAndStyle(sRow.number, 1, NUM_COLS,
      `${nombreSistema}   |   Generado por: ${usuario || 'desconocido'}   |   Fecha: ${new Date().toLocaleString('es-BO')}`,
      COLOR.subtitleBg, 'FF1565C0', false, 9, 'center');
    sRow.height = 16;

    // ── FILA 3: Filtros ──────────────────────────────────────────────────────
    const fRow = sheet.addRow([]);
    mergeAndStyle(fRow.number, 1, NUM_COLS, `Filtros: ${filtroLines.join('   |   ')}`, COLOR.filterBg, 'FF795548', false, 9, 'left');
    fRow.height = 16;

    // ── FILA 4: Vacía ────────────────────────────────────────────────────────
    sheet.addRow([]);

    // ── FILA 5: Cabecera de columnas ─────────────────────────────────────────
    const hRow = sheet.addRow(['Nro', 'Fecha y Hora', 'Usuario', 'Categoría', 'Descripción', 'Estado', 'Monto']);
    hRow.height = 18;
    hRow.eachCell((cell, colNum) => {
      applyCellStyle(cell, COLOR.colHeader, COLOR.colHeaderFg, true, 10,
        colNum === 7 ? 'right' : colNum === 4 || colNum === 6 ? 'center' : 'left');
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF1B5E20' } } };
    });

    // ── DATOS agrupados por mes ──────────────────────────────────────────────
    let contador = 1;
    const mesesOrdenados = Object.keys(gastosPorMes).sort();

    mesesOrdenados.forEach(mesKey => {
      const datosMes = gastosPorMes[mesKey];

      // Cabecera mes
      const mHRow = sheet.addRow([]);
      mHRow.height = 20;
      mergeAndStyle(mHRow.number, 1, NUM_COLS, `  ${datosMes.nombre}`, COLOR.mesBg, COLOR.mesFg, true, 11, 'left');
      mHRow.getCell(1).border = { top: { style: 'thin', color: { argb: 'FF81C784' } }, bottom: { style: 'thin', color: { argb: 'FF81C784' } } };

      let isOdd = true;
      datosMes.gastos.forEach(gasto => {
        const nombreUsr = gasto.usuario?.empleado
          ? `${gasto.usuario.empleado.nombre || ''} ${gasto.usuario.empleado.ap_paterno || ''}`.trim()
          : (gasto.usuario?.usuario || 'Sin usuario');
        const estadoText = gasto.estado === 1 ? 'Válido' : 'Anulado';
        const monto = parseFloat(gasto.monto) || 0;
        const rowBg = isOdd ? 'FFFFFFFF' : COLOR.altRow;
        const estadoBg = gasto.estado === 1 ? COLOR.validoBg : COLOR.anuladoBg;
        const estadoFg = gasto.estado === 1 ? 'FF2E7D32' : 'FFC62828';

        const dr = sheet.addRow([
          contador,
          formatFechaHora(gasto.fecha),
          nombreUsr,
          String(gasto.categoria || ''),
          gasto.descripcion || '',
          estadoText,
          monto
        ]);
        dr.height = 15;

        dr.eachCell((cell, col) => {
          applyCellStyle(cell, rowBg, 'FF212121', false, 9,
            col === 1 ? 'center' : col === 4 || col === 6 ? 'center' : col === 7 ? 'right' : 'left');
        });
        // Colorear celda de estado
        applyCellStyle(dr.getCell(6), estadoBg, estadoFg, true, 9, 'center');
        dr.getCell(7).numFmt = '#,##0.00';

        isOdd = !isOdd;
        contador++;
      });

      // Total del mes
      const tMesRow = sheet.addRow([]);
      tMesRow.height = 16;
      mergeAndStyle(tMesRow.number, 1, 6, `Total ${datosMes.nombre}`, COLOR.mesTotalBg, 'FF1B5E20', true, 9, 'right');
      const tMesCell = tMesRow.getCell(7);
      tMesCell.value = datosMes.total;
      tMesCell.numFmt = '#,##0.00';
      applyCellStyle(tMesCell, COLOR.mesTotalBg, 'FF1B5E20', true, 9, 'right');
      tMesRow.getCell(1).border = { top: { style: 'thin', color: { argb: 'FF4CAF50' } } };
    });

    // ── TOTAL GENERAL ────────────────────────────────────────────────────────
    sheet.addRow([]);
    const tgRow = sheet.addRow([]);
    tgRow.height = 22;
    mergeAndStyle(tgRow.number, 1, 6, 'TOTAL GENERAL', COLOR.generalBg, COLOR.generalFg, true, 12, 'center');
    const tgCell = tgRow.getCell(7);
    tgCell.value = totalGeneral;
    tgCell.numFmt = '#,##0.00';
    applyCellStyle(tgCell, COLOR.generalBg, COLOR.generalFg, true, 12, 'right');

    // ── SECCIÓN: TOTALES POR ESTADO ──────────────────────────────────────────
    sheet.addRow([]);
    const estTitleRow = sheet.addRow([]);
    estTitleRow.height = 20;
    mergeAndStyle(estTitleRow.number, 1, NUM_COLS, 'TOTALES POR ESTADO', COLOR.estadoHdrBg, COLOR.estadoHdrFg, true, 11, 'center');

    // Sub-cabecera
    const estHdr = sheet.addRow(['Estado', '', '', '', 'Cantidad', 'Monto', '']);
    estHdr.height = 16;
    [1,5,6].forEach(c => {
      const cell = estHdr.getCell(c);
      applyCellStyle(cell, 'FF0D47A1', 'FFFFFFFF', true, 9,
        c === 5 ? 'center' : c === 6 ? 'right' : 'left');
    });
    sheet.mergeCells(estHdr.number, 1, estHdr.number, 4);
    sheet.mergeCells(estHdr.number, 6, estHdr.number, 7);

    // Válidos
    const vRow = sheet.addRow(['Válido', '', '', '', cantidadValidos, totalValidos, '']);
    vRow.height = 15;
    mergeAndStyle(vRow.number, 1, 4, 'Válido', COLOR.validoBg, 'FF2E7D32', true, 9, 'left');
    vRow.getCell(5).value = cantidadValidos;
    applyCellStyle(vRow.getCell(5), COLOR.validoBg, 'FF2E7D32', false, 9, 'center');
    vRow.getCell(6).value = totalValidos;
    vRow.getCell(6).numFmt = '#,##0.00';
    applyCellStyle(vRow.getCell(6), COLOR.validoBg, 'FF2E7D32', true, 9, 'right');
    sheet.mergeCells(vRow.number, 6, vRow.number, 7);

    // Anulados
    const anRow = sheet.addRow(['Anulado', '', '', '', cantidadAnulados, totalAnulados, '']);
    anRow.height = 15;
    mergeAndStyle(anRow.number, 1, 4, 'Anulado', COLOR.anuladoBg, 'FFC62828', true, 9, 'left');
    anRow.getCell(5).value = cantidadAnulados;
    applyCellStyle(anRow.getCell(5), COLOR.anuladoBg, 'FFC62828', false, 9, 'center');
    anRow.getCell(6).value = totalAnulados;
    anRow.getCell(6).numFmt = '#,##0.00';
    applyCellStyle(anRow.getCell(6), COLOR.anuladoBg, 'FFC62828', true, 9, 'right');
    sheet.mergeCells(anRow.number, 6, anRow.number, 7);

    // ── SECCIÓN: RESUMEN POR USUARIO ─────────────────────────────────────────
    if (!id_usuario || String(id_usuario).trim() === '') {
      sheet.addRow([]);
      const usrTitleRow = sheet.addRow([]);
      usrTitleRow.height = 20;
      mergeAndStyle(usrTitleRow.number, 1, NUM_COLS, 'RESUMEN POR USUARIO', COLOR.usuarioHdrBg, COLOR.usuarioHdrFg, true, 11, 'center');

      // Cabecera de columnas usuario
      const usrHdr = sheet.addRow(['Usuario', 'Válidos (Cant.)', 'Válidos (Monto)', 'Anulados (Cant.)', 'Anulados (Monto)', 'Total Cant.', 'Total Monto']);
      usrHdr.height = 16;
      usrHdr.eachCell(cell => {
        applyCellStyle(cell, COLOR.usuarioColHdrBg, COLOR.usuarioColHdrFg, true, 9, 'center');
      });
      usrHdr.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

      let usrOdd = true;
      Object.values(gastosPorUsuario).forEach(datos => {
        const bg = usrOdd ? COLOR.usuarioRowBg : 'FFFCE4EC';
        const ur = sheet.addRow([
          datos.nombre,
          datos.cantidadValidos,
          datos.totalValidos,
          datos.cantidadAnulados,
          datos.totalAnulados,
          datos.cantidad,
          datos.total
        ]);
        ur.height = 15;
        ur.eachCell((cell, col) => {
          applyCellStyle(cell, bg, 'FF4A148C', false, 9,
            col === 1 ? 'left' : col === 3 || col === 5 || col === 7 ? 'right' : 'center');
          if (col === 3 || col === 5 || col === 7) cell.numFmt = '#,##0.00';
          if (col === 6 || col === 7) cell.font = { bold: true, size: 9, color: { argb: 'FF4A148C' } };
        });
        usrOdd = !usrOdd;
      });
    }

    // Respuesta
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `reporte_gastos_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error("Error en reporteGastosXlsx:", error);
    return res.status(500).json({ 
      mensaje: "Error al generar el reporte de gastos en Excel", 
      error: error.message 
    });
  }
}
module.exports = { reporteGastos, obtenerDatosGastos, reporteGastosXlsx };
