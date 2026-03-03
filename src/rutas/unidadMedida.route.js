const express = require('express');
const router = express.Router();
const {agregar,listar, modificar} = require('../controladores/unidadMedida.controller')
//   /listar
router.get('/listar',listar)
router.post('/agregar',agregar)
router.put('/modificar',modificar)

module.exports = router