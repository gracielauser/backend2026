const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('carrito', {
    id_carrito: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    fecha_creacion: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    total_carrito: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    id_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'cliente',
        key: 'id_cliente'
      }
    }
  }, {
    sequelize,
    tableName: 'carrito',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "carrito_pkey",
        unique: true,
        fields: [
          { name: "id_carrito" },
        ]
      },
    ]
  });
};
