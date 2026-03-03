const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('gasto', {
    id_gasto: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    monto: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuario',
        key: 'id_usuario'
      }
    },
    categoria: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    descripcion: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    }
  }, {
    sequelize,
    tableName: 'gasto',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "gasto_pkey",
        unique: true,
        fields: [
          { name: "id_gasto" },
        ]
      },
    ]
  });
};
