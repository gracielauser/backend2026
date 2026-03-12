const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('compra', {
    id_compra: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
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
    fecha_registro: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    id_proveedor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'proveedor',
        key: 'id_proveedor'
      }
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuario',
        key: 'id_usuario'
      }
    },
    nro_compra: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: "compra_nro_compra_key"
    },

  }, {
    sequelize,
    tableName: 'compra',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "compra_nro_compra_key",
        unique: true,
        fields: [
          { name: "nro_compra" },
        ]
      },
      {
        name: "compra_pkey",
        unique: true,
        fields: [
          { name: "id_compra" },
        ]
      },
    ]
  });
};
