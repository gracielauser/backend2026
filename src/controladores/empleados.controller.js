
const { or } = require("sequelize");
const { db } = require("../config/dataBase");

const listar = async (req, res)=>{
    try {
        const empleados = await db.empleado.findAll({
            order: [['id_empleado','DESC']]
        })//preguntar al chat todos los metodos de sequelize con nodejs
        return res.json(empleados)
    } catch (error) {
        console.log(error);
    }
}
const obtenerPorId = async(req,res)=>{
    try {
        const id = req.params.xd
        const empleado = await db.empleado.findOne(
            {
                where: {id_empleado: id}//TE AMO AMORCHI <3
            }
        ) 
        return res.json(empleado)
    } catch (error) {
        console.log(error);
    }
}
const agregar=async(req,res)=>{
    try {
        const nuevoPersonal = JSON.parse(req.body.empleado)
        const foto = req.files["foto"]?.[0];

    if (foto) {
      nuevoPersonal.foto= foto.filename;
    }
        await db.empleado.create(nuevoPersonal)
        return res.json({
            mensaje: 'creacion exitosa',
            nombre: 'joungkook'
        })
    } catch (error) {
        console.log(error);
        
    }
}
const modificar=async(req,res)=>{
    try {
        const empleadoModificado = JSON.parse(req.body.empleado)
        const foto = req.files["foto"]?.[0];

    if (foto) {
      empleadoModificado.foto= foto.filename;
    }
        await db.empleado.update(empleadoModificado,{
            where: {id_empleado: empleadoModificado.id_empleado}
        })
       return res.json({
           mensaje: empleadoModificado.nombre+' modificacion exitosa',
           nombre: empleadoModificado.nombre
       })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ mensaje: 'Error al modificar el empleado', error: error.message });
    }
}
const calidarCi = async(req,res) =>{
    try {
        const ciLlega = req.params.ci
        console.log('ci que llega: ',ciLlega);
        const empleado = await db.empleado.findOne({where: {ci: ciLlega}})
        if(empleado){
           return res.json({existe: true})
        }else return res.json({existe: false})
    } catch (error) {
        console.log(error);
        
    }
}
module.exports = {
  listar,
  obtenerPorId,
  agregar,
  modificar,
  calidarCi
};
