const { db } = require("../config/dataBase");
const { literal,col,fn,Op } = require("sequelize");

const listar = async (req, res)=>{
    try {
        const unidadMedida = await db.unidad_medida.findAll({
              attributes: ['id_unidad_medida', 'nombre', 'abreviatura', 'estado'],
              order: [['id_unidad_medida','DESC']]
        });
        // Get ids
        const ids = unidadMedida.map(u => u.id_unidad_medida);
        // Query counts
        const counts = await db.producto.findAll({
            attributes: [
                'id_unidad_medida',
                [fn('COUNT', col('id_unidad_medida')), 'nroProductos']
            ],
            where: {
                id_unidad_medida: { [Op.in]: ids },
                estado: 1
            },
            group: ['id_unidad_medida']
        });
        // Map
        const countMap = {};
        counts.forEach(c => {
            countMap[c.id_unidad_medida] = parseInt(c.dataValues.nroProductos, 10);
        });
        // Add
        unidadMedida.forEach(u => {
            u.dataValues.nroProductos = countMap[u.id_unidad_medida] || 0;
        });
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
        if (unidadModificada.estado == 2) {
            const productosEnUso = await db.producto.findAll({
                where: {
                    id_unidad_medida: unidadModificada.id_unidad_medida,
                    estado: 1
                }
            });
            if (productosEnUso.length > 0) {
                return res.status(402).json({ mensaje: 'La unidad esta actualmente en uso no se puede desactivar' });
            }
        }
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
