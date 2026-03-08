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
                    include: [{
                        model: db.empleado,
                    }]
                },
                {
                    model: db.cliente
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
        console.log(req.body);
        const detalles = newVenta.detallesVenta//rescatar antes de mandar a crear pq sino va borrar lo que no coincida con la tabla
        console.log('LLEGA ESTA VEMNTA', newVenta)
        const venta = await db.venta.create(newVenta)//
        await db.venta.update(
            { nro_venta: venta.nro_venta + venta.id_venta },
            { where: 
                { id_venta: venta.id_venta } 
            })
        for (det of detalles) {
            det.id_venta = venta.id_venta
            const productoActual = await db.producto.findOne({where: {id_producto: det.id_producto}})
            console.log('antes de actualizar',productoActual);
            
            const stockNew = productoActual.stock-det.cantidad
            await db.det_venta.create(det)
            await db.producto.update({stock: stockNew},{where: {id_producto: det.id_producto}})
        }
        console.log('ventaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',venta);
        
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
