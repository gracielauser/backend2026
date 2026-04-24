const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('empleado', {
    id_empleado: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    // ci: {
    //   type: DataTypes.INTEGER,
    //   allowNull: true
    // },
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
    ci: {
      type: DataTypes.STRING(15),
      allowNull: true
    },
    celular: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // genero: {
    //   type: DataTypes.INTEGER,
    //   allowNull: true
    // },
    estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    salario: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    foto: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'empleado',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "empleado_pkey",
        unique: true,
        fields: [
          { name: "id_empleado" },
        ]
      },
    ]
  });
};
