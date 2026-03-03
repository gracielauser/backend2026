const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('unidad_medida', {
    id_unidad_medida: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    abreviatura: {
      type: DataTypes.STRING(5),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'unidad_medida',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "unidad_medida_pkey",
        unique: true,
        fields: [
          { name: "id_unidad_medida" },
        ]
      },
    ]
  });
};
