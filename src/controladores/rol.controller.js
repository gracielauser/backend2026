const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const roles = await db.rol.findAll({
              order: [['id_rol','DESC']]
        })//preguntar al chat todos los metodos de sequelize con nodejs
        return res.json(roles)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar roles' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newRol=req.body
        await db.rol.create(newRol)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const asignar = async (req,res)=>{
    try {
        const nuevoUsuRol = req.body;
        await db.usu_rol.create(nuevoUsuRol);
        return res.json('asignado exitosamente');
    } catch (error) {
        console.log(error);
        return res.status(500).json({ mensaje: 'Error al asignar rol' });
    }
}
const modificar=async(req,res)=>{
    try {
        const rolModificado = req.body
        await db.rol.update(rolModificado,{
            where: {id_rol: rolModificado.id_rol}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: rolModificado.nombre
       })
    } catch (error) {
        console.log(error);
    }
}
module.exports = {
  agregar,
  listar,
  asignar,
  modificar
};
