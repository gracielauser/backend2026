const express = require('express');
const router = express.Router();
const { reporteFacturas } = require('../controladores/reportes/reportesFactura');
const { reporteClientes } = require('../controladores/reportes/reportesCliente');

// Reporte de facturas (ventas facturadas)
router.post('/facturas', reporteFacturas);

// Reporte de clientes con beneficio por ventas
router.post('/clientes', reporteClientes);

module.exports = router