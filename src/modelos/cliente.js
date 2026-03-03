const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('cliente', {
    id_cliente: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    ap_paterno: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    ap_materno: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    celular: {
      type: DataTypes.STRING(15),
      allowNull: true
    },
    ci_nit: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    email: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    clave: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    direccion: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    ciudad: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    fecha_registro: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    tipo_registro: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    tipo_documento: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'cliente',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "cliente_pkey",
        unique: true,
        fields: [
          { name: "id_cliente" },
        ]
      },
    ]
  });
};
