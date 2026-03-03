const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detalle_devolucion', {
    id_detven: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    subtotal: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    id_deven: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'devolucion_venta',
        key: 'id_deven'
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
    tableName: 'detalle_devolucion',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detalle_devolucion_pkey",
        unique: true,
        fields: [
          { name: "id_detven" },
        ]
      },
    ]
  });
};
