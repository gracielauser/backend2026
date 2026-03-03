const express = require('express');
const router = express.Router();
const {agregar,listar, modificar, anular, recibir} = require('../controladores/compra.controller')
//   /listar
router.get('/listar',listar)
router.post('/agregar',agregar)
router.put('/modificar',modificar)
router.put('/anular/:id_compra',anular)
router.put('/recibir',recibir)

module.exports = router