const { db } = require("../config/dataBase");
const { Sequelize } = require("sequelize");

const listar = async (req, res)=>{
    try {
        console.log('LAMADA DE APPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP');
        
        const productos = await db.producto.findAll({
              order: [['id_producto','DESC']],
            include: [
            { model: db.categoria },
            { model: db.marca },
            { model: db.unidad_medida },
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
const movimientos = async (req, res) => {
    try {
        const { id_producto } = req.params;
        const resultados = await db.det_venta.findAll({
      attributes: [
        'id_producto',
        [Sequelize.fn('SUM', Sequelize.col('det_venta.cantidad')), 'salidas'],
        [Sequelize.literal(`(
          SELECT COALESCE(SUM(dc.cantidad), 0)
          FROM det_compra dc
          INNER JOIN compra c ON dc.id_compra = c.id_compra
          WHERE dc.id_producto = det_venta.id_producto
          AND c.estado = 1
        )`), 'entradas'],
      [Sequelize.fn('SUM',
  Sequelize.literal(`
    CASE 
      WHEN "ventum"."tipo_venta" = 2 
      THEN (
        (("det_venta"."sub_total" - ("det_venta"."precio_compra" * "det_venta"."cantidad"))
          * ((("ventum"."monto_total" - "ventum"."descuento")::numeric / "ventum"."monto_total"))
        )
        - ((("ventum"."monto_total" - "ventum"."descuento") * 0.03) * ("det_venta"."sub_total" / "ventum"."monto_total"))
      )
      ELSE (
        ("det_venta"."sub_total" - ("det_venta"."precio_compra" * "det_venta"."cantidad"))
          * ((("ventum"."monto_total" - "ventum"."descuento")::numeric / "ventum"."monto_total"))
      )
    END
  `)
), 'ganancia_neta']
      ],
      include: [
        {
          model: db.venta,
          attributes: [],
          where: { estado: 1 },
          required: true
        },
        {
          model: db.producto,
          attributes: ['codigo', 'nombre', 'precio_compra', 'precio_venta', 'stock','estado'],
        //   where: { estado: 1 }, ya no por que vas ventas no importa si no esta activo el prodcuto el veneficio ya me dio
          required: true,
          include: [
            {
              model: db.categoria,
              attributes: ['nombre'],
              required: false
            },
            {
              model: db.marca,
              attributes: ['nombre'],
              required: false
            }
          ]
        }
      ],
      group: ['det_venta.id_producto', 'producto.id_producto', 'producto.codigo', 'producto.nombre','producto.estado', 
              'producto.precio_compra', 'producto.precio_venta', 'producto.stock', 
              'producto->categorium.id_categoria', 'producto->categorium.nombre',
              'producto->marca.id_marca', 'producto->marca.nombre'],
      order: [[Sequelize.literal('ganancia_neta'), 'DESC']],
      raw: true,
      nest: true
    });

    return res.status(200).json(resultados);

  } catch(error) {
    console.log(error);
    return res.status(500).json({ mensaje: 'Error al obtener movimientos del producto', error: error.message });
  }
};

module.exports = {
  agregar,
  listar,
  modificar,
  movimientos
};

