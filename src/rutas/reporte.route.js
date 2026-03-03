const express = require('express');
const router = express.Router();
const {agregar,listar} = require('../controladores/reporte.controller')
//   /listar
router.get('/listar',listar)
router.post('/agregar',agregar)

module.exports = router