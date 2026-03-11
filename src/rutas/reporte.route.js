const express = require('express');
const router = express.Router();
const { reporteFacturas } = require('../controladores/reportes/reportesFactura');
const { reporteClientes } = require('../controladores/reportes/reportesCliente');
const { reporteGastos } = require('../controladores/reportes/reportesGasto');
const { reporteInventario, reporteCatalogoProductos, reporteGananciasProducto } = require('../controladores/reportes/reportesProducto');

// Reporte de facturas (ventas facturadas)
router.post('/facturas', reporteFacturas);

// Reporte de clientes con beneficio por ventas
router.post('/clientes', reporteClientes);

// Reporte de gastos agrupado por meses
router.post('/gastos', reporteGastos);

// Reporte de inventario de productos
router.get('/inventario', reporteInventario);

// Reporte de catálogo de productos con fotos
router.post('/catalogo', reporteCatalogoProductos);

// Reporte de ganancias por producto
router.post('/ganancias-productos', reporteGananciasProducto);

module.exports = router