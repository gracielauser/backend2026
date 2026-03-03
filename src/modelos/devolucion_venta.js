const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('devolucion_venta', {
    id_deven: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    fecha_devolucion: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    motivo: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    total_devuelto: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    id_venta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'venta',
        key: 'id_venta'
      }
    }
  }, {
    sequelize,
    tableName: 'devolucion_venta',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "devolucion_venta_pkey",
        unique: true,
        fields: [
          { name: "id_deven" },
        ]
      },
    ]
  });
};
