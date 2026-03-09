const express = require('express');
const router = express.Router();
const { reporteInventario } = require('../../controladores/reportes/reportesProducto');

// Ruta para generar reporte de inventario de productos
router.post('/inventario', reporteInventario);

module.exports = router;
