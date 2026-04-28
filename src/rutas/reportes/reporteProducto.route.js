const express = require('express');
const router = express.Router();
const { reporteInventario, reporteCatalogoProductos, reporteGananciasProducto, obtenerDatosInventario, reporteInventarioXlsx } = require('../../controladores/reportes/reportesProducto');

// Ruta para obtener datos de inventario (vista previa JSON)
// Filtros: id_categoria, id_marca, estado, busqueda, id_unidad_medida, stock_minimo
router.post('/inventario/datos', obtenerDatosInventario);

// Ruta para generar reporte de inventario de productos (PDF)
// Filtros: id_categoria, id_marca, estado, busqueda, id_unidad_medida, stock_minimo
router.post('/inventario', reporteInventario);

// Ruta para generar reporte de inventario en Excel (XLSX)
// Filtros: id_categoria, id_marca, estado, busqueda, id_unidad_medida, stock_minimo
router.post('/inventario/xlsx', reporteInventarioXlsx);

// Ruta para generar catálogo de productos
router.post('/catalogo', reporteCatalogoProductos);

// Ruta para generar reporte de ganancias por producto
router.post('/ganancias', reporteGananciasProducto);

module.exports = router;
