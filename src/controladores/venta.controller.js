const { db } = require("../config/dataBase");

const listar = async (req, res) => {
    try {
        const ventas = await db.venta.findAll({
            order: [['id_venta', 'DESC']],
            include: [
                {
                    model: db.det_venta,
                    include: [
                        {
                            model: db.producto,
                        }
                    ]
                }, {
                    model: db.usuario,
                    as: 'usuario_registro',
                    include: [{
                        model: db.empleado,
                    }]
                },
                {
                    model: db.usuario,
                    as: 'usuario_anulador',
                    include: [{
                        model: db.empleado,
                    }]
                },
                {
                    model: db.cliente
                },{
                    model: db.factura
                }
            ]
        });
        return res.json(ventas)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar ventas' });
    }
}
const agregar = async (req, res) => {
    try {
        const newVenta = req.body
        const detalles = newVenta.detallesVenta//rescatar antes de mandar a crear pq sino va borrar lo que no coincida con la tabla
        const venta = await db.venta.create(newVenta)//
        await db.venta.update(
            { nro_venta: venta.nro_venta + venta.id_venta },
            { where: 
                { id_venta: venta.id_venta } 
            })
        for (det of detalles) {
            det.id_venta = venta.id_venta
            const productoActual = await db.producto.findOne({where: {id_producto: det.id_producto}})
            
            const stockNew = productoActual.stock-det.cantidad
            await db.det_venta.create(det)
            await db.producto.update({stock: stockNew},{where: {id_producto: det.id_producto}})
        }
        if(venta.tipo_venta==2){
            await db.factura.create({
                id_venta: venta.id_venta,
                impuesto: ((venta.monto_total-venta.descuento)*0.16).toFixed(3),
                total: venta.monto_total-venta.descuento
            })
        }
        
        return res.json(venta)
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar = async (req, res) => {
    try {
        const ventaModificada = req.body
        await db.venta.update(ventaModificada, {
            where: { id_venta: ventaModificada.id_venta }
        })
        return res.json({
            mensaje: 'modificacion exitosa',
            nombre: ventaModificada.nombre
        })
    } catch (error) {
        console.log(error);
    }
}
const anular = async (req, res) =>{
    try {
        const idVenta = req.params.id_venta
        await db.venta.update({estado : 2}, {where: {id_venta: idVenta}})
        //buscar la venta actualizada y de cada detalle de venta actualizar el stock del producto
        const ventaAnulada = await db.venta.findByPk(idVenta, {
            include: [
                {
                    model: db.det_venta,
                    include: [
                        {
                            model: db.producto,
                        }
                    ]
                }
            ]
        });
        for (const det of ventaAnulada.det_venta) {
            const productoActual = det.producto;
            const stockNew = productoActual.stock + det.cantidad;
            await db.producto.update({ stock: stockNew }, { where: { id_producto: productoActual.id_producto } });
        }
        return res.json('Anulado con exito')
    } catch (error) {
        console.log(
            error
        );
      
    }
}

module.exports = {
    agregar,
    listar,
    modificar,
    anular
};
