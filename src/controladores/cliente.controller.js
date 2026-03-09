const { db } = require("../config/dataBase");
const cliente = require("../modelos/cliente");

const listar = async (req, res)=>{
    try {
        const clientes = await db.cliente.findAll({
              order: [['id_cliente','DESC']]
        })
        return res.json(clientes)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar clientes' });
    }
}
const agregar= async (req,res)=>{
    try {
        const newCliente=req.body
        console.log(newCliente);
        
        const clienteCreado = await db.cliente.create(newCliente)
        return res.json(clienteCreado)
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const clienteModificado = req.body
        const modCliente = await db.cliente.update(clienteModificado,{
            where: {id_cliente: clienteModificado.id_cliente}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: clienteModificado.nombre,
           cliente: modCliente

       })
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
module.exports = {
  agregar,
  listar,
  modificar
};
