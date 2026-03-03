const express = require('express'); //para hacer otro archivo del mismo tipo copiar tal cual esta linea
const router = express.Router();// esta tambien
const {login} = require('../controladores/auth')
//   /listar
router.post('/login',login)

module.exports = router//y esta