const { db } = require("../config/dataBase");
const { literal, Sequelize,fn,col, Op } = require("sequelize");
const listar = async (req, res)=>{
    try {
        const marca = await db.marca.findAll({
              attributes: ['id_marca', 'nombre', 'estado'],
              order: [['id_marca','DESC']]
        });
        // Get ids
        const ids = marca.map(m => m.id_marca);
        // Query counts
        const counts = await db.producto.findAll({
            attributes: [
                'id_marca',
                [fn('COUNT', col('id_marca')), 'nroProductos']
            ],
            where: {
                id_marca: { [Op.in]: ids },
                estado: 1
            },
            group: ['id_marca']
        });
        // Map
        const countMap = {};
        counts.forEach(c => {
            countMap[c.id_marca] = parseInt(c.dataValues.nroProductos, 10);
        });
        // Add
        marca.forEach(m => {
            m.dataValues.nroProductos = countMap[m.id_marca] || 0;
        });
        return res.json(marca)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar marcas' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newMarca=req.body
        const nuevaMarca = await db.marca.create(newMarca)
        return res.json(nuevaMarca)
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const marcaModificada = req.body
        if (marcaModificada.estado == 2) {
            const productosEnUso = await db.producto.findAll({
                where: {
                    id_marca: marcaModificada.id_marca,
                    estado: 1
                }
            });
            if (productosEnUso.length > 0) {
                return res.status(402).json({ mensaje: 'La marca esta actualmente en uso no se puede desactivar' });
            }
        }
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
