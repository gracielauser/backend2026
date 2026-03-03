const { Sequelize, DataTypes } = require('sequelize')
const initModels = require('../modelos/init-models')

const sequelize = new Sequelize('taller3', 'postgres', 'postgres', {//base de datos, usuario, contraseña
    host: 'localhost',
    dialect: 'postgres',//es la -e del compando que genera los modelos
    pool: {
        max: 5,//El número máximo de conexiones en el pool.
        min: 0,//El número mínimo de conexiones en el pool.
        acquire: 30000,//El tiempo máximo, en milisegundos, que el pool intentará obtener una conexión antes de lanzar un error.
        idle: 10000//El tiempo máximo, en milisegundos, que una conexión puede estar inactiva antes de ser liberada.
    }
});
sequelize.authenticate().then(() => {
    console.log('Conectado a la base de datos!');
}).catch((err) => {
        console.log(err);
});

const db = initModels(sequelize); 
module.exports = { sequelize, db };
