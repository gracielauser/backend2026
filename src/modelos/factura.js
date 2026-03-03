const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('factura', {
    nro_factura: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    fecha_emision: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    impuesto: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    total: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    id_venta: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'venta',
        key: 'id_venta'
      }
    }
  }, {
    sequelize,
    tableName: 'factura',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "factura_pkey",
        unique: true,
        fields: [
          { name: "nro_factura" },
        ]
      },
    ]
  });
};
