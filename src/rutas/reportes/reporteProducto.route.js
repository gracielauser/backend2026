const express = require('express');
const router = express.Router();
const { reporteInventario, reporteCatalogoProductos, reporteGananciasProducto, obtenerDatosInventario } = require('../../controladores/reportes/reportesProducto');

// Ruta para obtener datos de inventario (vista previa JSON)
router.get('/inventario/datos', obtenerDatosInventario);

// Ruta para generar reporte de inventario de productos (PDF)
router.post('/inventario', reporteInventario);

// Ruta para generar catálogo de productos
router.post('/catalogo', reporteCatalogoProductos);

// Ruta para generar reporte de ganancias por producto
router.post('/ganancias', reporteGananciasProducto);

module.exports = router;
