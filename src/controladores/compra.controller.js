const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const compra = await db.compra.findAll({
              order: [['id_compra','DESC']],
                include:[
                { model: db.proveedor },
                { model: db.usuario },
                { model: db.det_compra,
                    include:[
                        {model: db.producto}
                    ]
                }
            ]
        })
        return res.json(compra)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar compras' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newCompra=req.body
        console.log('COMPRAAAAAAAAAAA',newCompra);
        console.log(newCompra);
        
        const nCompra = await db.compra.create(newCompra)
        await db.compra.update({nro_compra: 'C00'+nCompra.id_compra},{where: {id_compra: nCompra.id_compra}})
        return res.json(nCompra)
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const compraModificada = req.body
        await db.compra.update(compraModificada,{
            where: {id_compra: compraModificada.id_compra}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: compraModificada.nombre
       })
    } catch (error) {
        console.log(error);
    }
}
const anular = async (req, res) =>{
    try {
        const idCompra = req.params.id_compra
        await db.compra.update({estado : 3}, {where: {id_compra: idCompra}})
        return res.json('Anulado con exito')
    } catch (error) {
        console.log(
            error
        );
      
    }
}
const recibir = async (req,res)=>{
    try {
        const datosM = req.body
        console.log(req.body);
        
        await db.compra.update({fecha_recepcion: datosM.fechaRecepcion, estado: 2}, {where: {id_compra: datosM.idCompra}})
        for(det of datosM.detalles){
            await db.det_compra.update({cantidad_recibida: det.cantidad_recibida, defectuosos: det.defectuosos},{where: {id_detcompra: det.id_detcompra}})
            const productoActual = await db.producto.findOne({where: {id_producto: det.id_producto}})
            const stockNew = productoActual.stock+(det.cantidad_recibida-det.defectuosos)
            await db.producto.update({stock: stockNew},{where: {id_producto: productoActual.id_producto}})
        }
        return res.json('actualiza con exito')
    } catch (error) {
        console.log(error);
        
    }
}
module.exports = {
  agregar,
  listar,
  modificar,
  anular,
  recibir
};
