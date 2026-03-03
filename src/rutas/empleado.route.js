const express = require('express'); //para hacer otro archivo del mismo tipo copiar tal cual esta linea
const router = express.Router();// esta tambien
const {listar,obtenerPorId,agregar, modificar, calidarCi} = require('../controladores/empleados.controller')
//   /listar
router.get('/listar',listar)
router.post('/agregar',agregar)
router.get('/api/buscarUno/:xd',obtenerPorId)
router.put('/modificar',modificar)
router.get('/validar-ci/:ci', calidarCi)
module.exports = router//y esta
// 