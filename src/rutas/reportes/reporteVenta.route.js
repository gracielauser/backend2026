const express = require('express'); //para hacer otro archivo del mismo tipo copiar tal cual esta linea
const router = express.Router();// esta tambien
const { ventaNota, reporteVentasResumido, reporteVentasDetallado } = require('../../controladores/reportes/reportesVenta')

// Nota de venta individual
router.post('/notaVenta/:idVenta', ventaNota)

// Reporte de ventas resumido (tabla con totales)
router.post('/reporteVentas-resumido', reporteVentasResumido)

// Reporte de ventas detallado (con productos de cada venta)
router.post('/reporteVentas-detallado', reporteVentasDetallado)

module.exports = router