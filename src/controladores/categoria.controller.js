const { or } = require("sequelize");
const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const categorias = await db.categoria.findAll({
              where: {
                  id_categoria_padre: null
              },
              include: [{
                  model: db.categoria,
                  as: 'subCategoria'
              }],
              order: [['id_categoria','DESC']]
        })
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
        await db.categoria.update(categoriaModificada,{
            where: {id_categoria: categoriaModificada.id_categoria}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
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
