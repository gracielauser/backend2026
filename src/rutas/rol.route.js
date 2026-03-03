const express = require('express'); //para hacer otro archivo del mismo tipo copiar tal cual esta linea
const router = express.Router();// esta tambien
const {agregar,listar,asignar, modificar} = require('../controladores/rol.controller')
//   /listar
router.get('/listar',listar)
router.post('/agregar',agregar)
router.post('/asignar',asignar)
router.put('/modificar',modificar)

module.exports = router