const express = require('express'); //para hacer otro archivo del mismo tipo copiar tal cual esta linea
const router = express.Router();// esta tambien
const { ventaNota, reporteVentasResumido, reporteVentasResumidoXlsx, reporteVentasDetallado, obtenerDatosVentasResumido, obtenerDatosVentasDetallado } = require('../../controladores/reportes/reportesVenta')

// Nota de venta individual o factura internamente detecta
router.post('/notaVenta/:idVenta', ventaNota)

// Obtener datos de ventas resumido (JSON para vista previa)
router.get('/reporteVentas-resumido/datos', obtenerDatosVentasResumido)

// Reporte de ventas resumido (PDF - tabla con totales)
router.post('/reporteVentas-resumido', reporteVentasResumido)

// Reporte de ventas resumido (Excel - tabla con totales)
router.post('/reporteVentas-resumido/xlsx', reporteVentasResumidoXlsx)

// Obtener datos de ventas detallado (JSON para vista previa)
router.get('/reporteVentas-detallado/datos', obtenerDatosVentasDetallado)

// Reporte de ventas detallado (PDF - con productos de cada venta)
router.post('/reporteVentas-detallado', reporteVentasDetallado)

module.exports = router