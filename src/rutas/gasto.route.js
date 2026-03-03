const express = require('express');
const router = express.Router();
const {agregar,listar, anular} = require('../controladores/gasto.controller')
//   /listar
router.get('/listar',listar)
router.post('/agregar',agregar)
router.put('/anular',anular)

module.exports = router