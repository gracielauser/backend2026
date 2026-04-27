const express = require('express');
const router = express.Router();
const { reporteComprasResumido, reporteComprasDetallado, reporteComprasResumidoXlsx, obtenerDatosComprasResumido, obtenerDatosComprasDetallado } = require('../../controladores/reportes/reportesCompra');

// Obtener datos de compras resumido (vista previa JSON)
// Puede recibir filtros opcionales: ?fecha_inicio=2026-01-01&fecha_fin=2026-03-13&id_proveedor=1
router.get('/compras-resumido/datos', obtenerDatosComprasResumido);

// Ruta para generar reporte de compras resumido (PDF)
// Puede recibir filtros opcionales: desde, hasta, id_proveedor, busqueda, estado, id_usuario
router.post('/compras-resumido', reporteComprasResumido);

// Ruta para generar reporte de compras resumido (Excel)
// Puede recibir filtros opcionales: desde, hasta, id_proveedor, busqueda, estado, id_usuario
router.post('/compras-resumido/xlsx', reporteComprasResumidoXlsx);

// Obtener datos de compras detallado (vista previa JSON)
// Puede recibir filtros opcionales: ?fecha_inicio=2026-01-01&fecha_fin=2026-03-13&id_proveedor=1
router.get('/compras-detallado/datos', obtenerDatosComprasDetallado);

// Ruta para generar reporte de compras detallado con productos (PDF)
// Puede recibir filtros opcionales: desde, hasta, id_proveedor, busqueda, estado, id_usuario
router.post('/compras-detallado', reporteComprasDetallado);

module.exports = router;
