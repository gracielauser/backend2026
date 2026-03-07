const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('producto', {
    id_producto: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    foto: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    precio_compra: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    precio_venta: {
      type: DataTypes.DOUBLE,
      allowNull: false
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
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    stock_minimo: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_categoria: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'categoria',
        key: 'id_categoria'
      }
    },
    id_marca: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'marca',
        key: 'id_marca'
      }
    },
    id_unidad_medida: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'unidad_medida',
        key: 'id_unidad_medida'
      }
    },
    fecha_registro: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'producto',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "producto_pkey",
        unique: true,
        fields: [
          { name: "id_producto" },
        ]
      },
    ]
  });
};
