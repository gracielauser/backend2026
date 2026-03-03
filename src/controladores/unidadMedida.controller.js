const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const unidadMedida = await db.unidad_medida.findAll({
              order: [['id_unidad_medida','DESC']]
        })
        return res.json(unidadMedida)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar unidades' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newUnidadMedida=req.body
        await db.unidad_medida.create(newUnidadMedida)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const unidadModificada = req.body
        await db.unidad_medida.update(unidadModificada,{
            where: {id_unidad_medida: unidadModificada.id_unidad_medida}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: unidadModificada.nombre
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
