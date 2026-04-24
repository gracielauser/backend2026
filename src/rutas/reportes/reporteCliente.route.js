const express = require('express');
const router = express.Router();
const { reporteClientes, obtenerDatosClientes, reporteClientesXlsx } = require('../../controladores/reportes/reportesCliente');

// Obtener datos de clientes (JSON para vista previa)
router.post('/obtener-datos', obtenerDatosClientes);

// Reporte de clientes (PDF)
router.post('/', reporteClientes);

// Reporte de clientes (Excel)
router.post('/xlsx', reporteClientesXlsx);

module.exports = router;
