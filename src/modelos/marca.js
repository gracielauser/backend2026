const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('marca', {
    id_marca: {
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
    descripcion: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'marca',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "marca_pkey",
        unique: true,
        fields: [
          { name: "id_marca" },
        ]
      },
    ]
  });
};
