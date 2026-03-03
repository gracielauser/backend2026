const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('rol', {
    id_rol: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    descripcion: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    permisos: {
      type: DataTypes.STRING(50),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'rol',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "rol_pkey",
        unique: true,
        fields: [
          { name: "id_rol" },
        ]
      },
    ]
  });
};
