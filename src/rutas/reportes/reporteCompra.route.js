const express = require('express');
const router = express.Router();
const { reporteComprasResumido, reporteComprasDetallado, obtenerDatosComprasResumido, obtenerDatosComprasDetallado } = require('../../controladores/reportes/reportesCompra');

// Obtener datos de compras resumido (vista previa JSON)
// Puede recibir filtros opcionales: ?fecha_inicio=2026-01-01&fecha_fin=2026-03-13&id_proveedor=1
router.get('/compras-resumido/datos', obtenerDatosComprasResumido);

// Ruta para generar reporte de compras resumido (PDF)
// Puede recibir filtros opcionales: fecha_inicio, fecha_fin, id_proveedor
router.post('/compras-resumido', reporteComprasResumido);

// Obtener datos de compras detallado (vista previa JSON)
// Puede recibir filtros opcionales: ?fecha_inicio=2026-01-01&fecha_fin=2026-03-13&id_proveedor=1
router.get('/compras-detallado/datos', obtenerDatosComprasDetallado);

// Ruta para generar reporte de compras detallado con productos (PDF)
// Puede recibir filtros opcionales: fecha_inicio, fecha_fin, id_proveedor
router.post('/compras-detallado', reporteComprasDetallado);

module.exports = router;
