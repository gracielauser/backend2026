const express = require('express');
const router = express.Router();
const { obtenerDatosTendencia, tendenciaPDF,tendenciaXlsx } = require('../../controladores/reportes/reporteTendencia');

// Obtener datos de tendencia de productos (JSON para visualización)
router.post('/datos-tendencia', obtenerDatosTendencia);

// Generar reporte PDF de tendencia de productos
router.post('/tendenciaPDF', tendenciaPDF);

router.post('/xlsx',tendenciaXlsx)

module.exports = router;
