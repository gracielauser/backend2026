const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('inventario', {
    id_inventario: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    fecha_registro: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    tipo_movimiento: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    motivo: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    id_producto: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'producto',
        key: 'id_producto'
      }
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'inventario',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "inventario_pkey",
        unique: true,
        fields: [
          { name: "id_inventario" },
        ]
      },
    ]
  });
};
