const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const detCompra = await db.det_compra.findAll()
        return res.json(detCompra)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar detalles de compra' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newDetCompra=req.body
        console.log('CREANDO DETALLLLLLLLE DE COMPRA',newDetCompra);
        await db.det_compra.create(newDetCompra)
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