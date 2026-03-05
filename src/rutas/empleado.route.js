const express = require('express'); //para hacer otro archivo del mismo tipo copiar tal cual esta linea
const router = express.Router();// esta tambien
const multer = require('multer')
const {listar,obtenerPorId,agregar, modificar, calidarCi} = require('../controladores/empleados.controller')
//   /listar
// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname
    cb(null, uniqueName)
  }
})
const upload = multer({ storage })

router.get('/listar',listar)
router.post('/agregar',upload.fields([
    { name: 'foto', maxCount: 1 }
  ]),agregar)
router.get('/api/buscarUno/:xd',obtenerPorId)
router.put('/modificar',modificar)
router.get('/validar-ci/:ci', calidarCi)
module.exports = router//y esta
// 