const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('det_compra', {
    id_detcompra: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    precio_unitario: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sub_total: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    id_compra: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'compra',
        key: 'id_compra'
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
    defectuosos: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cantidad_recibida: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'det_compra',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "det_compra_pkey",
        unique: true,
        fields: [
          { name: "id_detcompra" },
        ]
      },
    ]
  });
};
