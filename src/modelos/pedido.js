const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('pedido', {
    id_pedido: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    fecha_registro: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    monto_total: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    metodo_pago: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    direccion: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    ciudad: {
      type: DataTypes.STRING(100),
      allowNull: false
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
    tableName: 'pedido',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "pedido_pkey",
        unique: true,
        fields: [
          { name: "id_pedido" },
        ]
      },
    ]
  });
};
