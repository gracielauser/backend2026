const express = require('express');
const router = express.Router();
const { reporteInventario, reporteCatalogoProductos, reporteGananciasProducto } = require('../../controladores/reportes/reportesProducto');

// Ruta para generar reporte de inventario de productos
router.post('/inventario', reporteInventario);

// Ruta para generar catálogo de productos
router.post('/catalogo', reporteCatalogoProductos);

// Ruta para generar reporte de ganancias por producto
router.post('/ganancias', reporteGananciasProducto);

module.exports = router;
