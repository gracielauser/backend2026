const { db } = require("../config/dataBase");

const listar = async (req, res) => {
  try {
    const compra = await db.compra.findAll({
      order: [["id_compra", "DESC"]],
      include: [
        { model: db.proveedor },
        {
          model: db.usuario,
          as: "usuario_registro",
          include: [
            {
              model: db.empleado,
            },
          ],
        },
        {
          model: db.usuario,
          as: "usuario_anulador",
          include: [
            {
              model: db.empleado,
            },
          ],
        },
        { model: db.det_compra, include: [{ model: db.producto }] },
      ],
    });
    return res.json(compra);
  } catch (error) {
    console.log(error);
    return res.json({ mensaje: "Error al listar compras" });
  }
};
const agregar = async (req, res) => {
  try {
    const newCompra = req.body;
    console.log("nueva COMPRAAAAAAAAAAA", newCompra);
    console.log(
      "nueva COMPRAAAAAAAAAAA con producto",
      newCompra.detalle[0].producto,
    );
    const nCompra = await db.compra.create(newCompra);
    for (det of newCompra.detalle) {
      det.id_compra = nCompra.id_compra;
      if (det.producto && det.producto.id_producto[0] === "N") {
        //primer caracter del id_producto es N, es nuevo
        det.producto.stock = det.cantidad;
        det.producto.precio_compra = det.precio_unitario;
        det.producto.precio_venta = det.precio_venta;
        det.producto.id_categoria = Number(det.producto.id_categoria);
        det.producto.id_producto = null; // Asegura que se cree un nuevo producto
        det.producto.foto=null
        const nuevoProducto = await db.producto.create(det.producto);
        det.id_producto = nuevoProducto.id_producto;
      } else {
        det.id_producto = det.id_producto;
        const prod = await db.producto.findOne({ where: { id_producto: det.id_producto } });
        await db.producto.update(
          {
            stock: prod.stock + det.cantidad,
            precio_compra: det.precio_compra,
            precio_venta: det.precio_venta,
          },
          { where: { id_producto: det.id_producto } },
        );
      }
        await db.det_compra.create(det);

    }
    await db.compra.update({nro_compra: 'C00'+nCompra.id_compra},{where: {id_compra: nCompra.id_compra}})
    return res.json(nCompra);
  } catch (error) {
    console.log(error);
    return res.json(error);
  }
};
const modificar = async (req, res) => {
  try {
    const compraModificada = req.body;
    console.log("MODIFICANDO COMPRAAAAAAAAAAAAAAAAAAAAA: ", compraModificada);

    // Update compra header
    await db.compra.update(compraModificada, {
      where: { id_compra: compraModificada.id_compra },
    });

    // Get existing detalles from DB
    const detallesExistentes = await db.det_compra.findAll({
      where: { id_compra: compraModificada.id_compra },
    });

    // Get ids from incoming detalle list
    const detalleIdsEntrantes = compraModificada.detalle
      .filter((d) => d.id_detcompra !== null && d.id_detcompra !== undefined)
      .map((d) => d.id_detcompra);

    // Destroy detalles that were removed (exist in DB but not in incoming list)
    for (const detExistente of detallesExistentes) {
      if (!detalleIdsEntrantes.includes(detExistente.id_detcompra)) {
        //antes de destruir recuperaremos el stock para restar ya que esta entrada esta anulandose
        await db.producto.increment(
          { stock: -detExistente.cantidad },
          { where: { id_producto: detExistente.id_producto } },
        );
        await db.det_compra.destroy({
          where: { id_detcompra: detExistente.id_detcompra },
        });
      }
    }

    // Update or create detalles
    for (const det of compraModificada.detalle) {
      if(det.producto && det.producto.id_producto[0] === "N"){
        det.producto.stock = det.cantidad;
        det.producto.precio_compra = det.precio_unitario;
        det.producto.precio_venta = det.precio_venta;
        det.producto.id_categoria = Number(det.producto.id_categoria);
        det.producto.id_producto = null;
        det.producto.foto = null;
        const nuevoProducto = await db.producto.create(det.producto);
        det.id_producto = nuevoProducto.id_producto;
      }
      if (det.id_detcompra !== null && det.id_detcompra !== undefined) {
        // Update existing
        await db.det_compra.update(det, {
          where: { id_detcompra: det.id_detcompra },
        });
      } else {
        // Create new
        det.id_compra = compraModificada.id_compra;
        await db.det_compra.create(det);
      }
    }

    return res.json({
      mensaje: "modificacion exitosa",
      nombre: compraModificada.nombre,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ mensaje: "Error al modificar compra", error });
  }
};
const anular = async (req, res) => {
  try {
    const {id_compra, id_usuario} = req.query;
    await db.compra.update({ estado: 2, id_usuario_anula: id_usuario }, { where: { id_compra: id_compra } });
    const detalles = await db.det_compra.findAll({ where: { id_compra: id_compra } });
    for (const det of detalles) {
      await db.producto.increment(
        { stock: -det.cantidad },
        { where: { id_producto: det.id_producto } },
      );
    }
    return res.json("Anulado con exito");
  } catch (error) {
    console.log(error);
  }
};
const recibir = async (req, res) => {
  try {
    const datosM = req.body;
    console.log(req.body);

    await db.compra.update(
      { fecha_recepcion: datosM.fechaRecepcion, estado: 2 },
      { where: { id_compra: datosM.idCompra } },
    );
    for (det of datosM.detalles) {
      await db.det_compra.update(
        {
          cantidad_recibida: det.cantidad_recibida,
          defectuosos: det.defectuosos,
        },
        { where: { id_detcompra: det.id_detcompra } },
      );
      const productoActual = await db.producto.findOne({
        where: { id_producto: det.id_producto },
      });
      const stockNew =
        productoActual.stock + (det.cantidad_recibida - det.defectuosos);
      await db.producto.update(
        { stock: stockNew },
        { where: { id_producto: productoActual.id_producto } },
      );
    }
    return res.json("actualiza con exito");
  } catch (error) {
    console.log(error);
  }
};
module.exports = {
  agregar,
  listar,
  modificar,
  anular,
  recibir,
};
