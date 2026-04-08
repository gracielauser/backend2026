const { db } = require("../config/dataBase");
const login = async (req, res) => {
    try {
        const data={}
        const usuarioLlega = req.body
        if(usuarioLlega.email){
            const cliente = await db.cliente.findOne({where: {email:usuarioLlega.email}})
            if(cliente && cliente.clave==usuarioLlega.clave){
                return res.json(cliente)
            }else{
                return res.status(400).json({mensaje: 'Contraseña incorrecta'})
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
console.log('devolviendo: ',usuarioEncontrado);

        if (usuarioEncontrado) {
            data.token='XD'

            data.user=usuarioEncontrado
            if (usuarioEncontrado.clave == usuarioLlega.clave) {
                return res.json(data)
            } else return res.status(400).json({mensaje: 'Contraseña incorrecta'})
        } else return res.status(400).json({mensaje: 'Usuario no encontrado'})
    } catch (error) {
        console.log('error al buscar usuario', error);
        return res.status(500).json({ mensaje: 'Error al buscar usuario' });
    }
}
module.exports = {
    login
};
