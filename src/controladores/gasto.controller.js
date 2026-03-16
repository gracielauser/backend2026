const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const gasto = await db.gasto.findAll({
              order: [['id_gasto','DESC']],
            where: {estado: 1},
            include:[
                {
                    model: db.usuario,
                    attributes: ['id_usuario', 'usuario'],
                    include: [
                        {
                            model: db.empleado,
                            attributes: ['nombre', 'ap_paterno','ap_materno']
                        }
                    ]
                }
            ]
        })
        return res.json(gasto)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar gastos' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newGasto=req.body
        await db.gasto.create(newGasto)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const anular=async(req,res)=>{
    try {
        const gastoAnulado = req.body
        await db.gasto.update(gastoAnulado,{
            where: {id_gasto: gastoAnulado.id_gasto}
        })
       return res.json({
           mensaje: 'anulacion exitosa',
           nombre: gastoAnulado.nombre
       })
    } catch (error) {
        console.log(error);
    }
}

module.exports = {
  agregar,
  listar,
  anular
};
