const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const marca = await db.marca.findAll({
              order: [['id_marca','DESC']]
        })
        return res.json(marca)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar marcas' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newMarca=req.body
        await db.marca.create(newMarca)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const marcaModificada = req.body
        await db.marca.update(marcaModificada,{
            where: {id_marca: marcaModificada.id_marca}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: marcaModificada.nombre
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
