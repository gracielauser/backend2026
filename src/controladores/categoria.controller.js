const { Op, literal, fn,col } = require("sequelize");
const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const categorias = await db.categoria.findAll({
              attributes: ['id_categoria', 'nombre', 'estado'],
              where: {
                  id_categoria_padre: null
              },
              include: [{
                  model: db.categoria,
                  as: 'subCategoria',
                  attributes: ['id_categoria', 'nombre', 'estado']
              }],
              order: [['id_categoria','DESC']]
        });
        // Collect all category ids
        const ids = [];
        categorias.forEach(cat => {
            ids.push(cat.id_categoria);
            if (cat.subCategoria && cat.subCategoria.length > 0) {
                cat.subCategoria.forEach(sub => ids.push(sub.id_categoria));
            }
        });
        // Query counts
        const counts = await db.producto.findAll({
            attributes: [
                'id_categoria',
                [fn('COUNT', col('id_categoria')), 'nroProductos']
            ],
            where: {
                id_categoria: { [Op.in]: ids },
                estado: 1
            },
            group: ['id_categoria']
        });
        // Create map
        const countMap = {};
        counts.forEach(c => {
            countMap[c.id_categoria] = parseInt(c.dataValues.nroProductos, 10);
        });
        // Add nroProductos
        categorias.forEach(cat => {
            cat.dataValues.nroProductos = countMap[cat.id_categoria] || 0;
            if (cat.subCategoria && cat.subCategoria.length > 0) {
                cat.subCategoria.forEach(sub => {
                    sub.dataValues.nroProductos = countMap[sub.id_categoria] || 0;
                });
            }
        });
        // Sum subcategory counts into parent categories
        categorias.forEach(cat => {
            if (cat.subCategoria && cat.subCategoria.length > 0) {
                const total = cat.dataValues.nroProductos + cat.subCategoria.reduce((sum, sub) => sum + (sub.dataValues.nroProductos || 0), 0);
                cat.dataValues.nroProductos = total;
            }
        });
        return res.json(categorias)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar categorias' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newCategoria=req.body
        await db.categoria.create(newCategoria)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const categoriaModificada = req.body
        if (categoriaModificada.estado == 2) {
            const productosEnUso = await db.producto.findAll({
                where: {
                    id_categoria: categoriaModificada.id_categoria,
                    estado: 1
                }
            });
            if (productosEnUso.length > 0) {
                return res.status(402).json({ mensaje: 'La categoria esta actualmente en uso no se puede desactivar' });
            }
        }
        await db.categoria.update(categoriaModificada,{
            where: {id_categoria: categoriaModificada.id_categoria}
        })
       return res.json({
           mensaje: 'modificacion exitosa xd',
           nombre: categoriaModificada.nombre
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
