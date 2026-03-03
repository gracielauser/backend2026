const { db } = require("../config/dataBase");
const login = async (req, res) => {
    try {
        const data={}
        const usuarioLlega = req.body
        console.log('USUARIO LLEGA------------------',usuarioLlega);
        if(usuarioLlega.email){
            const cliente = await db.cliente.findOne({where: {email:usuarioLlega.email}})
            if(cliente && cliente.clave==usuarioLlega.clave){
                return res.json(cliente)
            }else{
                
            }
        }
        
        const usuarioEncontrado = await db.usuario.findOne({
            where: { usuario: usuarioLlega.usuario },
            include: [
                { model: db.empleado }, // Trae el empleado relacionado
                {
                    model: db.rol,        // Trae los roles relacionados
                    through: { attributes: [] } // Oculta datos de la tabla pivote
                }
            ]
        });

        if (usuarioEncontrado) {
            data.token='XD'

            data.user=usuarioEncontrado
            if (usuarioEncontrado.clave == usuarioLlega.clave) {
                return res.json(data)
            } else return res.json(null)
        } else return res.json(null)
    } catch (error) {
        console.log('error al buscar usuario', error);
    }
}
module.exports = {
    login
};
