const express = require('express');
const router = express.Router();
const { reporteComprasResumido, reporteComprasDetallado } = require('../../controladores/reportes/reportesCompra');

// Ruta para generar reporte de compras resumido
// Puede recibir filtros opcionales: fecha_inicio, fecha_fin, id_proveedor
router.post('/compras-resumido', reporteComprasResumido);

// Ruta para generar reporte de compras detallado con productos
// Puede recibir filtros opcionales: fecha_inicio, fecha_fin, id_proveedor
router.post('/compras-detallado', reporteComprasDetallado);

module.exports = router;
