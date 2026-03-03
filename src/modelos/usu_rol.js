const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('usu_rol', {
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'usuario',
        key: 'id_usuario'
      }
    },
    id_rol: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'rol',
        key: 'id_rol'
      }
    }
  }, {
    sequelize,
    tableName: 'usu_rol',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "usu_rol_pkey",
        unique: true,
        fields: [
          { name: "id_usuario" },
          { name: "id_rol" },
        ]
      },
    ]
  });
};
