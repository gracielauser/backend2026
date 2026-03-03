const express = require('express');
const router = express.Router();
const {listar,agregar,modificar,cambiarEstado} = require('../controladores/usuario.controller')
router.get('/listar',listar);
router.post('/agregar',agregar);
router.post('/modificar',modificar);
router.get('/cambioEstado',cambiarEstado);
module.exports = router
/*const express = require('express');
const router = express.Router();
const {crearUsuario, listar, cambiarEstado, modificar, eliminar,verificarUsuario ,verificarUsuarioM, listarRoles} = require('../controladores/usuarios')
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/listar',verifyToken,listar);
router.post('/crearUsuario',verifyToken,crearUsuario);
router.get('/verificarUsuario/:usuario',verifyToken,verificarUsuario)
router.post('/cambiarEstado',verifyToken,cambiarEstado)
router.post('/modificar/:usu',verifyToken,modificar)
router.get('/eliminar/:usuario',verifyToken,eliminar)
router.get('/listarRoles',verifyToken, listarRoles)
module.exports = router*/