const { or } = require("sequelize");
const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const proveedores = await db.proveedor.findAll({
              order: [['id_proveedor','DESC']]
        })
        return res.json(proveedores)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar proveedores' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newProveedor=req.body
        const nuevoProve = await db.proveedor.create(newProveedor)
        return res.json(nuevoProve)
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const proveedorModificado = req.body
        await db.proveedor.update(proveedorModificado,{
            where: {id_proveedor: proveedorModificado.id_proveedor}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: proveedorModificado.nombre
       })
    } catch (error) {
        console.log(error);
    }
}
module.exports = {
  agregar,
  listar,
  modificar
};
