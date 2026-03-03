const { db } = require("../config/dataBase");

const listar = async (req, res) => {
  try {
    const usuarios = await db.usuario.findAll({
        order: [['id_usuario','DESC']],
      include: [
        { model: db.empleado }, // Trae el empleado relacionado
        {
          model: db.rol,        // Trae los roles relacionados
          through: { attributes: [] } // Oculta datos de la tabla pivote
        }
      ]
    })
    return res.json(usuarios)
  } catch (error) {
    console.log(error);
    return res.json([])
  }
}
const agregar = async (req, res) => {// si tiene tu api asi en tu router: '/api/usuarios/buscar/:id' con el metodo que respondas cdel controller vas a recivir ese id asi: req.params.id
  try {
    const nuevoUsuario = req.body//req es lo que llega del front req.body usuario creado con formulario
    nuevoUsuario.id_empleado=nuevoUsuario.persona.id_empleado
    const usuarioCreado = await db.usuario.create(nuevoUsuario)
    return res.json(usuarioCreado)//res es para responder al front .json para asegurarse de que coincidan los formatos
  } catch (error) {
    console.log(error);
    return res.status(500).json({ mensaje: 'el usuario no se puedo crear inten' })
  }
}
const modificar = async (req, res) => {
  try {
    const nuevoUsuario = req.body
    const usuarioCreado = await db.usuario.update(nuevoUsuario)
    console.log('nombre', usuarioCreado.id_usuario);
    return res.status(200).json({ mensaje: 'usuario modficado exitosamente' })
  } catch (error) {
    console.log(error);
    return res.status(500).json({ mensaje: 'el usuario no se puedo modifciar inten' })
  }
}
const cambiarEstado = async (req, res) => {
  try {
    const id = req.params.idUsuario
    const usuario = await db.usuario.findOne(
      {
        where: { id_usuario: id }
      }
    )
    const nuevo_estado = 0
    if (usuario.estado == 1) nuevo_estado = 2
    else nuevo_estado = 1

    const usuarioActualizado = await db.usuario.update(
      {
        estado: nuevo_estado
      },
      {
        where: { id_usuario: id }
      }
    )
    return res.status(200).json({ mensaje: 'cambio exitoso' })
  } catch (error) {
    console.log(error);
    return res.status(500).json({ mensaje: 'nose puedo cambiar estado' })
  }
}
module.exports = { listar, agregar, modificar, cambiarEstado }
/*const bcrypt = require("bcryptjs");
const { db } = require("../config/database");
const { Sequelize, Op } = require("sequelize");

const listar = async (req, res) => {
  try {
    const idsToExclude = [6, 16];
    let lista = [];
    lista = await db.usuario.findAll({
      where: { estado: true },
      attributes: { exclude: ["clave"] },
      include: [
        {
          model: db.persona,
        },
        {
          model: db.rol,
          through: { attributes: [] },
        },
      ],
      // where: {
      //   id: {
      //     // [Op.notIn]: idsToExclude,
      //   },
      // },
    });
    return res.json(lista);
  } catch (error) {
    console.log("error al listar", error);
  }
};
const crearUsuario = (req, res) => {
  const nuevo = req.body;
  console.log('-----------------nuevo usuario', nuevo);
  
  if (!nuevo.usuario || !nuevo.clave)
    return res.status(400).json({ mensaje: "al menos usuario y clave" });

  bcrypt.hash(nuevo.clave, 10, async (err, claveEncriptada) => {
    if (err) {
      return res
        .status(500)
        .json({ mensaje: "Error en la encriptación de la contraseña" });
    }

    try {
      nuevo.clave = claveEncriptada;
      const usuario = await db.usuario.create(nuevo);
      usuario.clave = "";
      return res.status(201).json({ mensaje: "Creado exitosamente" });
    } catch (error) {
      console.log(error.message);
      console.log(error);
      return res.status(401).json({ mensaje: "no se puedo crear el usuario" });
    }
  });
};
const cambiarEstado = async (req, res) => {
  try {
    const u = await db.usuario.update(
      { estado: req.body.estado },
      {
        where: { usuario: req.body.usuario },
      }
    );
    if (u)
      return res.status(200).json({ mensaje: "Estado cambiado exitosamente" });
  } catch (error) {
    console.log(error);
    res.json("falla al cambiar");
  }
};
const modificar = async (req, res) => {
  try {
    const usu = req.body;
    const xuser = req.params.usu;

    if (usu.clave == "#") {
      await db.usuario.update(
        {
          usuario: usu.usuario,
          id_persona: usu.id_persona,
        },
        {
          where: { usuario: xuser },
        }
      );
      return res.json({
        status: 200,
        mensaje: "Actualizado correctamente",
      });
    } else {
      bcrypt.hash(usu.clave, 10, async (err, claveEncriptada) => {
        if (err) {
          return res
            .status(500)
            .json({ error: "Error en la encriptación de la contraseña" });
        }
        try {
          await db.usuario.update(
            {
              usuario: usu.usuario,
              clave: claveEncriptada,
              id_persona: usu.id_persona,
            },
            {
              where: { usuario: xuser },
            }
          );
          return res.json({
            status: 200,
            mensaje: "Actualizado correctamente con clave nueva",
          });
        } catch (error) {
          console.log(error);
        }
      });
    }
  } catch (error) {
    console.log(error);
    return res.json({ status: 500, mensaje: "No se pudo actualizarar" });
  }
};
const eliminar = async (req, res) => {
  try {
    console.log("---------------------------------eliminando");
    await db.usuario.update(
      { estado: false },
      {
        where: { usuario: req.params.usuario },
      }
    );
    return res.status(200).json({ mensaje: "Eliminado correctamente" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ mensaje: "No se pudo eliminar" });
  }
};
const verificarUsuario = async (req, res) => {
  try {
    const usuario = req.params.usuario;
    const user = await db.usuario.findOne({
      where: { usuario: usuario },
    });
    if (user) {
      return res.status(200).json({ existe: true });
    } else {
      return res.json({ existe: false });
    }
    return res.json(user);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Error al verificar el usuario" });
  }
};
const verificarUsuarioM = async (req, res) => {
  try {
    const { usuario, id } = req.body;
    const user = await db.usuario.findOne({
      where: {
        usuario: usuario,
        // id: { [Op.ne]: id } // Excluye el registro con este ID
      },
    });

    if (user) {
      if (user.id == id) return res.json({ existe: false });
      else return res.json({ existe: true });
    } else return res.json({ existe: false });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Error al verificar el usuario" });
  }
};
const listarRoles = async (req, res) => {
  try {
    const roles = await db.rol.findAll({});
    return res.json(roles);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Error al listar los roles" });
  }
};
module.exports = {
  listarRoles,
  crearUsuario,
  listar,
  cambiarEstado,
  modificar,
  eliminar,
  verificarUsuario,
  verificarUsuarioM,
};
*/