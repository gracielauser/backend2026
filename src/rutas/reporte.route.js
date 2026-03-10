const express = require('express');
const router = express.Router();
const { reporteFacturas } = require('../controladores/reportes/reportesFactura');

// Reporte de facturas (ventas facturadas)
router.post('/facturas', reporteFacturas);

module.exports = router