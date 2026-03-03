const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const reporte = await db.reporte.findAll()
        return res.json(reporte)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar reportes' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newReporte=req.body
        await db.reporte.create(newReporte)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}

module.exports = {
  agregar,
  listar,

};
