const express = require('express');
const router = express.Router();
const { reporteFacturas } = require('../controladores/reportes/reportesFactura');
const { reporteClientes, obtenerDatosClientes } = require('../controladores/reportes/reportesCliente');
const { reporteGastos, obtenerDatosGastos, reporteGastosXlsx } = require('../controladores/reportes/reportesGasto');
const { reporteInventario, reporteCatalogoProductos, reporteGananciasProducto } = require('../controladores/reportes/reportesProducto');
const { reporteResultados, obtenerDatosResultados } = require('../controladores/reportes/reportesResultados');

// Reporte de facturas (ventas facturadas)
router.post('/facturas', reporteFacturas);

// Obtener datos de clientes (vista previa JSON)
router.post('/clientes/datos', obtenerDatosClientes);

// Reporte de clientes con beneficio por ventas (PDF)
router.post('/clientes', reporteClientes);

// Obtener datos de gastos (vista previa JSON)
router.post('/gastos/datos', obtenerDatosGastos);

// Reporte de gastos agrupado por meses (PDF)
router.post('/gastos', reporteGastos);

// Reporte de gastos agrupado por meses (XLSX)
router.post('/gastos/xlsx', reporteGastosXlsx);

// Reporte de inventario de productos
router.get('/inventario', reporteInventario);

// Reporte de catálogo de productos con fotos
router.post('/catalogo', reporteCatalogoProductos);

// Reporte de ganancias por producto
router.post('/ganancias-productos', reporteGananciasProducto);

// Obtener datos del estado de resultados (vista previa JSON)
router.get('/resultados/datos', obtenerDatosResultados);

// Reporte de estado de resultados (PDF)
router.post('/resultados', reporteResultados);

module.exports = router