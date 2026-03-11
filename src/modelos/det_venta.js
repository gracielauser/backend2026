const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('det_venta', {
    id_detventa: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sub_total: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    precio_unitario: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
     precio_compra: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    id_venta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'venta',
        key: 'id_venta'
      }
    },
    id_producto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'producto',
        key: 'id_producto'
      }
    }
  }, {
    sequelize,
    tableName: 'det_venta',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "det_venta_pkey",
        unique: true,
        fields: [
          { name: "id_detventa" },
        ]
      },
    ]
  });
};
