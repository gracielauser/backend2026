const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        console.log('LAMADA DE APPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP');
        
        const productos = await db.producto.findAll({
              order: [['id_producto','DESC']],
            include: [
            { model: db.categoria },
            { model: db.marca },
            { model: db.unidad_medida },
            { model: db.proveedor }

            ]
        })
        return res.status(200).json(productos)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar productos' });
    }
}
const agregar= async (req,res)=>{
    try {
         const newProducto=JSON.parse(req.body.producto)
        console.log('PRODUCTO solo body prod',JSON.parse(req.body.producto));
        
        const foto = req.files['foto']?.[0]
        
        if(foto){
            newProducto.foto=foto.filename
        }
        await db.producto.create(newProducto)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const productoModificado = JSON.parse(req.body.producto)
         const foto = req.files['foto']?.[0]
        if(foto){
            productoModificado.foto=foto.filename
        }
        await db.producto.update(productoModificado,{
            where: {id_producto: productoModificado.id_producto}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: productoModificado.nombre
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
