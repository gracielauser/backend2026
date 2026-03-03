const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('proveedor', {
    id_proveedor: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    ciudad: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    direccion: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    celular: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    }
  }, {
    sequelize,
    tableName: 'proveedor',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "proveedor_pkey",
        unique: true,
        fields: [
          { name: "id_proveedor" },
        ]
      },
    ]
  });
};
