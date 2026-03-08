const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('venta', {
    id_venta: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    fecha_registro: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    monto_total: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    tipo_pago: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo_venta: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    descripcion: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    descuento: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuario',
        key: 'id_usuario'
      }
    },
    id_cliente: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'cliente',
        key: 'id_cliente'
      }
    },

    nro_venta: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: "venta_nro_venta_key"
    }
  }, {
    sequelize,
    tableName: 'venta',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "venta_nro_venta_key",
        unique: true,
        fields: [
          { name: "nro_venta" },
        ]
      },
      {
        name: "venta_pkey",
        unique: true,
        fields: [
          { name: "id_venta" },
        ]
      },
    ]
  });
};
