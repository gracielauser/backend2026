const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detalle_carrito', {
    id_detcarrito: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_carrito: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'carrito',
        key: 'id_carrito'
      }
    },
    id_producto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'producto',
        key: 'id_producto'
      }
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    precio_unitario: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    sub_total: {
      type: DataTypes.DOUBLE,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'detalle_carrito',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detalle_carrito_pkey",
        unique: true,
        fields: [
          { name: "id_detcarrito" },
        ]
      },
    ]
  });
};
