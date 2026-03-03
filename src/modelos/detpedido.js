const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detpedido', {
    id_detpedido: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_pedido: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'pedido',
        key: 'id_pedido'
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
    },
    direccion: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    ciudad: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    metodo_pago: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    }
  }, {
    sequelize,
    tableName: 'detpedido',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detpedido_pkey",
        unique: true,
        fields: [
          { name: "id_detpedido" },
        ]
      },
    ]
  });
};
