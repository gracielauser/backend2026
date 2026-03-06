var DataTypes = require("sequelize").DataTypes;
var _carrito = require("./carrito");
var _categoria = require("./categoria");
var _cliente = require("./cliente");
var _compra = require("./compra");
var _det_compra = require("./det_compra");
var _det_venta = require("./det_venta");
var _detalle_carrito = require("./detalle_carrito");
var _detalle_devolucion = require("./detalle_devolucion");
var _detpedido = require("./detpedido");
var _devolucion_venta = require("./devolucion_venta");
var _empleado = require("./empleado");
var _factura = require("./factura");
var _gasto = require("./gasto");
var _inventario = require("./inventario");
var _marca = require("./marca");
var _pedido = require("./pedido");
var _producto = require("./producto");
var _proveedor = require("./proveedor");
var _rol = require("./rol");
var _unidad_medida = require("./unidad_medida");
var _usu_rol = require("./usu_rol");
var _usuario = require("./usuario");
var _venta = require("./venta");

function initModels(sequelize) {
  var carrito = _carrito(sequelize, DataTypes);
  var categoria = _categoria(sequelize, DataTypes);
  var cliente = _cliente(sequelize, DataTypes);
  var compra = _compra(sequelize, DataTypes);
  var det_compra = _det_compra(sequelize, DataTypes);
  var det_venta = _det_venta(sequelize, DataTypes);
  var detalle_carrito = _detalle_carrito(sequelize, DataTypes);
  var detalle_devolucion = _detalle_devolucion(sequelize, DataTypes);
  var detpedido = _detpedido(sequelize, DataTypes);
  var devolucion_venta = _devolucion_venta(sequelize, DataTypes);
  var empleado = _empleado(sequelize, DataTypes);
  var factura = _factura(sequelize, DataTypes);
  var gasto = _gasto(sequelize, DataTypes);
  var inventario = _inventario(sequelize, DataTypes);
  var marca = _marca(sequelize, DataTypes);
  var pedido = _pedido(sequelize, DataTypes);
  var producto = _producto(sequelize, DataTypes);
  var proveedor = _proveedor(sequelize, DataTypes);
  var rol = _rol(sequelize, DataTypes);
  var unidad_medida = _unidad_medida(sequelize, DataTypes);
  var usu_rol = _usu_rol(sequelize, DataTypes);
  var usuario = _usuario(sequelize, DataTypes);
  var venta = _venta(sequelize, DataTypes);

  rol.belongsToMany(usuario, { through: usu_rol, foreignKey: "id_rol", otherKey: "id_usuario" });
  usuario.belongsToMany(rol, {through: usu_rol, foreignKey: "id_usuario", otherKey: "id_rol" });
  detalle_carrito.belongsTo(carrito, {foreignKey: "id_carrito"});
  carrito.hasMany(detalle_carrito, {foreignKey: "id_carrito"});
  categoria.belongsTo(categoria, {foreignKey: "id_categoria_padre"});
  categoria.hasMany(categoria, { as: "subCategoria", foreignKey: "id_categoria_padre"});
  producto.belongsTo(categoria, { foreignKey: "id_categoria"});
  categoria.hasMany(producto, { foreignKey: "id_categoria"});
  carrito.belongsTo(cliente, { foreignKey: "id_cliente"});
  cliente.hasMany(carrito, { foreignKey: "id_cliente"});
  pedido.belongsTo(cliente, { foreignKey: "id_cliente"});
  cliente.hasMany(pedido, { foreignKey: "id_cliente"});
  venta.belongsTo(cliente, { foreignKey: "id_cliente"});
  cliente.hasMany(venta, { foreignKey: "id_cliente"});
  det_compra.belongsTo(compra, { foreignKey: "id_compra"});
  compra.hasMany(det_compra, { foreignKey: "id_compra"});
  detalle_devolucion.belongsTo(devolucion_venta, { foreignKey: "id_deven"});
  devolucion_venta.hasMany(detalle_devolucion, { foreignKey: "id_deven"});
  usuario.belongsTo(empleado, { foreignKey: "id_empleado"});
  empleado.hasMany(usuario, { foreignKey: "id_empleado"});
  producto.belongsTo(marca, { foreignKey: "id_marca"});
  marca.hasMany(producto, { foreignKey: "id_marca"});
  detpedido.belongsTo(pedido, { foreignKey: "id_pedido"});
  pedido.hasMany(detpedido, { foreignKey: "id_pedido"});
  venta.belongsTo(pedido, { foreignKey: "id_pedido"});
  pedido.hasMany(venta, { foreignKey: "id_pedido"});
  det_compra.belongsTo(producto, { foreignKey: "id_producto"});
  producto.hasMany(det_compra, { foreignKey: "id_producto"});
  det_venta.belongsTo(producto, { foreignKey: "id_producto"});
  producto.hasMany(det_venta, { foreignKey: "id_producto"});
  detalle_carrito.belongsTo(producto, { foreignKey: "id_producto"});
  producto.hasMany(detalle_carrito, { foreignKey: "id_producto"});
  detalle_devolucion.belongsTo(producto, { foreignKey: "id_producto"});
  producto.hasMany(detalle_devolucion, { foreignKey: "id_producto"});
  detpedido.belongsTo(producto, { foreignKey: "id_producto"});
  producto.hasMany(detpedido, { foreignKey: "id_producto"});
  inventario.belongsTo(producto, { foreignKey: "id_producto"});
  producto.hasMany(inventario, { foreignKey: "id_producto"});
  compra.belongsTo(proveedor, { foreignKey: "id_proveedor"});
  proveedor.hasMany(compra, { foreignKey: "id_proveedor"});
  usu_rol.belongsTo(rol, { foreignKey: "id_rol"});
  rol.hasMany(usu_rol, { foreignKey: "id_rol"});
  producto.belongsTo(unidad_medida, { foreignKey: "id_unidad_medida"});
  unidad_medida.hasMany(producto, { foreignKey: "id_unidad_medida"});
  compra.belongsTo(usuario, { foreignKey: "id_usuario"});
  usuario.hasMany(compra, { foreignKey: "id_usuario"});
  gasto.belongsTo(usuario, { foreignKey: "id_usuario"});
  usuario.hasMany(gasto, { foreignKey: "id_usuario"});
  usu_rol.belongsTo(usuario, { foreignKey: "id_usuario"});
  usuario.hasMany(usu_rol, { foreignKey: "id_usuario"});
  venta.belongsTo(usuario, { foreignKey: "id_usuario"});
  usuario.hasMany(venta, { foreignKey: "id_usuario"});
  det_venta.belongsTo(venta, { foreignKey: "id_venta"});
  venta.hasMany(det_venta, { foreignKey: "id_venta"});
  devolucion_venta.belongsTo(venta, { foreignKey: "id_venta"});
  venta.hasMany(devolucion_venta, { foreignKey: "id_venta"});
  factura.belongsTo(venta, { foreignKey: "id_venta"});
  venta.hasMany(factura, { foreignKey: "id_venta"});

  return {
    carrito,
    categoria,
    cliente,
    compra,
    det_compra,
    det_venta,
    detalle_carrito,
    detalle_devolucion,
    detpedido,
    devolucion_venta,
    empleado,
    factura,
    gasto,
    inventario,
    marca,
    pedido,
    producto,
    proveedor,
    rol,
    unidad_medida,
    usu_rol,
    usuario,
    venta,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
