const express = require('express'); //para hacer otro archivo del mismo tipo copiar tal cual esta linea
const router = express.Router();// esta tambien
const { ventaNota, reporteVentas } = require('../controladores/reportesVenta')
//   /listar
router.get('/notaVenta/:idVenta', ventaNota)
router.post('/reporteVentas', reporteVentas)


module.exports = router