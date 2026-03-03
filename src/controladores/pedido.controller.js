const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const pedido = await db.pedido.findAll({
            include:[
                { model:db.detpedido,
                    include:[
                        {model:db.producto}
                    ]
                 }
            ]
        })
        return res.json(pedido)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar pedidos' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newPedido=req.body
        console.log('recibiendo pedido', newPedido);
        
        await db.pedido.create(newPedido)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}

module.exports = {
  agregar,
  listar
};
