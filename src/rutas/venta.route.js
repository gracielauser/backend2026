const express = require('express');
const router = express.Router();
const {agregar,listar, modificar,anular} = require('../controladores/venta.controller')
//   /listar
router.get('/listar',listar)
router.post('/agregar',agregar)
router.put('/modificar',modificar)
router.put('/anular/:id_venta',anular)

module.exports = router