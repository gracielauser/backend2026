const express = require('express');
const router = express.Router();
const multer = require('multer')
const {agregar,listar, modificar, movimientos, kardex} = require('../controladores/producto.controller')
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
router.put('/modificar', upload.fields([
    { name: 'foto', maxCount: 1 }
  ]),modificar)
router.get('/movimientos',movimientos)
router.get('/kardex/:id_producto',kardex)
module.exports = router