const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const inventario = await db.inventario.findAll()
        return res.json(inventario)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar inventario' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newInventario=req.body
        await db.inventario.create(newInventario)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const cantidadModificada = req.body
        await db.inventario.update(cantidadModificada,{
            where: {id_inventario: cantidadModificada.id_inventario}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: cantidadModificada.nombre
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
