const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const inventario = await db.inventario.findAll()
        return res.json(inventario)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar inventario' });
    }
}
const agregar= async (req,res)=>{// antes pensado asi: 1 compra, 2 venta, 3 reduccion y 4 aumento por ajuste pero ahora es tipo_mivimiento 1 es reduccion y 2 aumento, en ambos casos se registra la cantidad y el producto, y si es por compra o venta se registra el id_compra o id_venta respectivamente
    try {
        const newInventario=req.body
        if(newInventario && newInventario.tipo_movimiento === 1){//reduccion
            const producto = await db.producto.findByPk(newInventario.id_producto)
            await db.producto.update({stock: producto.stock - newInventario.cantidad},{where: {id_producto: newInventario.id_producto}})
        }else {//ajuste / aumento
            const producto = await db.producto.findByPk(newInventario.id_producto)
            await db.producto.update({stock: producto.stock + newInventario.cantidad},{where: {id_producto: newInventario.id_producto}})
        }
        await db.inventario.create(newInventario)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const cantidadModificada = req.body
        await db.inventario.update(cantidadModificada,{
            where: {id_inventario: cantidadModificada.id_inventario}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: cantidadModificada.nombre
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
