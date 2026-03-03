const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const detVenta = await db.det_venta.findAll()
        return res.json(detVenta)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar detalles de venta' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newDetVenta=req.body
        await db.det_venta.create(newDetVenta)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}

module.exports = {
  agregar,
  listar
};