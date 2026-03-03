const express = require('express'); //para hacer otro archivo del mismo tipo copiar tal cual esta linea
const router = express.Router();// esta tambien
const {ventaNota} = require('../controladores/reportesVenta')
//   /listar
router.get('/notaVenta/:idVenta',ventaNota)


module.exports = router