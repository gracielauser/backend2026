const { db } = require("../config/dataBase");
const { Sequelize, Op } = require("sequelize");

const listar = async (req, res)=>{
    try {
        console.log('LAMADA DE APPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP');
        
        const productos = await db.producto.findAll({
              order: [['id_producto','DESC']],
            include: [
            { model: db.categoria },
            { model: db.marca },
            { model: db.unidad_medida },
            ]
        })
        return res.status(200).json(productos)
    } catch (error) {
        console.log(error);
        return res.json({ mensaje: 'Error al listar productos' });
    }
}
const agregar= async (req,res)=>{
    try {
         const newProducto=JSON.parse(req.body.producto)
        console.log('PRODUCTO solo body prod',JSON.parse(req.body.producto));
        
        const foto = req.files['foto']?.[0]
        
        if(foto){
            newProducto.foto=foto.filename
        }
        await db.producto.create(newProducto)
        return res.json('creado exitosamente')
    } catch (error) {
        console.log(error);
        return res.json(error)
    }
}
const modificar=async(req,res)=>{
    try {
        const productoModificado = JSON.parse(req.body.producto)
         const foto = req.files['foto']?.[0]
        if(foto){
            productoModificado.foto=foto.filename
        }
        await db.producto.update(productoModificado,{
            where: {id_producto: productoModificado.id_producto}
        })
       return res.json({
           mensaje: 'modificacion exitosa',
           nombre: productoModificado.nombre
       })
    } catch (error) {
        console.log(error);
    }
}
const movimientos = async (req, res) => {
    try {
        const { id_producto } = req.params;
        const { nombre_codigo, id_categoria, id_marca, desde, hasta } = req.body || {};
        console.log('body de movimientosssss:', req.body);
        
        // Construir filtros para producto
        const whereProducto = {};
        
        if (id_categoria && String(id_categoria).trim() !== '') {
          whereProducto.id_categoria = parseInt(id_categoria);
        }
        
        if (id_marca && String(id_marca).trim() !== '') {
          whereProducto.id_marca = parseInt(id_marca);
        }
        
        if (nombre_codigo && String(nombre_codigo).trim() !== '') {
          const busqueda = String(nombre_codigo).trim();
          whereProducto[Op.or] = [
            { nombre: { [Op.iLike]: `%${busqueda}%` } },
            { codigo: { [Op.iLike]: `%${busqueda}%` } }
          ];
        }
        
        // Construir filtros para venta (fecha_registro)
        const whereVenta = { estado: 1 };
        
        if (desde && String(desde).trim() !== '') {
          whereVenta.fecha_registro = whereVenta.fecha_registro || {};
          whereVenta.fecha_registro[Op.gte] = String(desde).trim();
        }
        
        if (hasta && String(hasta).trim() !== '') {
          whereVenta.fecha_registro = whereVenta.fecha_registro || {};
          whereVenta.fecha_registro[Op.lte] = String(hasta).trim() + ' 23:59:59';
        }
        
        // Construir condiciones SQL para subconsultas
        let fechaCondicionVenta = '';
        if (desde && hasta) {
          fechaCondicionVenta = `AND v.fecha_registro >= '${desde}' AND v.fecha_registro <= '${hasta} 23:59:59'`;
        } else if (desde) {
          fechaCondicionVenta = `AND v.fecha_registro >= '${desde}'`;
        } else if (hasta) {
          fechaCondicionVenta = `AND v.fecha_registro <= '${hasta} 23:59:59'`;
        }
        
        let fechaCondicionCompra = '';
        if (desde && hasta) {
          fechaCondicionCompra = `AND c.fecha_registro >= '${desde}' AND c.fecha_registro <= '${hasta} 23:59:59'`;
        } else if (desde) {
          fechaCondicionCompra = `AND c.fecha_registro >= '${desde}'`;
        } else if (hasta) {
          fechaCondicionCompra = `AND c.fecha_registro <= '${hasta} 23:59:59'`;
        }
        
        let fechaCondicionInventario = '';
        if (desde && hasta) {
          fechaCondicionInventario = `AND inv.fecha_registro >= '${desde}' AND inv.fecha_registro <= '${hasta} 23:59:59'`;
        } else if (desde) {
          fechaCondicionInventario = `AND inv.fecha_registro >= '${desde}'`;
        } else if (hasta) {
          fechaCondicionInventario = `AND inv.fecha_registro <= '${hasta} 23:59:59'`;
        }
        
        const resultados = await db.det_venta.findAll({
      attributes: [
        'id_producto',
        [Sequelize.literal(`(
          COALESCE(SUM(CASE WHEN "ventum"."estado" = 1 THEN "det_venta"."cantidad" ELSE 0 END), 0) + 
          COALESCE((
            SELECT SUM(inv.cantidad)
            FROM inventario inv
            WHERE inv.id_producto = det_venta.id_producto
            AND inv.estado = 1
            AND inv.tipo_movimiento = 1
            ${fechaCondicionInventario}
          ), 0)
        )`), 'salidas'],
        [Sequelize.literal(`(
          COALESCE((
            SELECT SUM(dc.cantidad)
            FROM det_compra dc
            INNER JOIN compra c ON dc.id_compra = c.id_compra
            WHERE dc.id_producto = det_venta.id_producto
            AND c.estado = 1
            ${fechaCondicionCompra}
          ), 0) +
          COALESCE((
            SELECT SUM(inv.cantidad)
            FROM inventario inv
            WHERE inv.id_producto = det_venta.id_producto
            AND inv.estado = 1
            AND inv.tipo_movimiento = 2
            ${fechaCondicionInventario}
          ), 0)
        )`), 'entradas'],
      [Sequelize.fn('SUM',
  Sequelize.literal(`
    CASE 
      WHEN "ventum"."tipo_venta" = 2 
      THEN (
        (("det_venta"."sub_total" - ("det_venta"."precio_compra" * "det_venta"."cantidad"))
          * ((("ventum"."monto_total" - "ventum"."descuento")::numeric / "ventum"."monto_total"))
        )
        - ((("ventum"."monto_total" - "ventum"."descuento") * 0.13) * ("det_venta"."sub_total" / "ventum"."monto_total"))
      )
      ELSE (
        ("det_venta"."sub_total" - ("det_venta"."precio_compra" * "det_venta"."cantidad"))
          * ((("ventum"."monto_total" - "ventum"."descuento")::numeric / "ventum"."monto_total"))
      )
    END
  `)
), 'ganancia_neta']
      ],
      include: [
        {
          model: db.venta,
          attributes: [],
          where: whereVenta,
          required: true
        },
        {
          model: db.producto,
          attributes: ['codigo', 'nombre', 'precio_compra', 'precio_venta', 'stock','estado'],
          where: whereProducto,
          required: true,
          include: [
            {
              model: db.categoria,
              attributes: ['nombre'],
              required: false
            },
            {
              model: db.marca,
              attributes: ['nombre'],
              required: false
            }
          ]
        }
      ],
      group: ['det_venta.id_producto', 'producto.id_producto', 'producto.codigo', 'producto.nombre','producto.estado', 
              'producto.precio_compra', 'producto.precio_venta', 'producto.stock', 
              'producto->categorium.id_categoria', 'producto->categorium.nombre',
              'producto->marca.id_marca', 'producto->marca.nombre'],
      order: [[Sequelize.literal('ganancia_neta'), 'DESC']],
      raw: true,
      nest: true
    });

    return res.status(200).json(resultados);

  } catch(error) {
    console.log(error);
    return res.status(500).json({ mensaje: 'Error al obtener movimientos del producto', error: error.message });
  }
};

const kardex = async (req, res) => {
  try {
    const { id_producto } = req.params;

    if (!id_producto) {
      return res.status(400).json({ mensaje: 'id_producto es requerido' });
    }

    // 0. Obtener información del producto (para el stock actual)
    const producto = await db.producto.findByPk(id_producto, {
      attributes: ['id_producto', 'stock','fecha_registro']
    });

    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    // 1. Obtener movimientos de COMPRAS
    const compras = await db.det_compra.findAll({
      where: { id_producto },
      attributes: ['cantidad', 'id_producto'],
      include: [
        {
          model: db.compra,
          attributes: ['estado', 'nro_compra', 'fecha_registro'],
          required: true,
          include: [
            {
              model: db.usuario,
              as: 'usuario_registro',
              attributes: ['id_usuario', 'usuario'],
              required: false,
              include: [
                {
                  model: db.empleado,
                  attributes: ['nombre', 'ap_paterno', 'ap_materno'],
                  required: false
                }
              ]
            }
          ]
        }
      ],
      raw: true,
      nest: true
    });

    // 2. Obtener movimientos de VENTAS
    const ventas = await db.det_venta.findAll({
      where: { id_producto },
      attributes: ['cantidad', 'id_producto'],
      include: [
        {
          model: db.venta,
          attributes: ['estado', 'nro_venta', 'fecha_registro'],
          required: true,
          include: [
            {
              model: db.usuario,
              as: 'usuario_registro',
              attributes: ['id_usuario', 'usuario'],
              required: false,
              include: [
                {
                  model: db.empleado,
                  attributes: ['nombre', 'ap_paterno', 'ap_materno'],
                  required: false
                }
              ]
            }
          ]
        }
      ],
      raw: true,
      nest: true
    });

    // 3. Obtener movimientos de INVENTARIO (Ajustes)
    const ajustes = await db.inventario.findAll({
      where: { id_producto },
      attributes: ['tipo_movimiento', 'estado', 'cantidad', 'fecha_registro'],
      include: [
        {
          model: db.usuario,
          attributes: ['id_usuario', 'usuario'],
          required: false,
          include: [
            {
              model: db.empleado,
              attributes: ['nombre', 'ap_paterno', 'ap_materno'],
              required: false
            }
          ]
        }
      ],
      raw: true,
      nest: true
    });

    // Procesar y unificar resultados
    const movimientos = [];

    // Variables para calcular stock de apertura
    let totalSalidasValidas = 0;
    let totalEntradasValidas = 0;

    // Procesar compras
    compras.forEach(item => {
      const esValido = item.compra?.estado === 1;
      
      // Sumar a entradas válidas
      if (esValido) {
        totalEntradasValidas += parseFloat(item.cantidad) || 0;
      }

      movimientos.push({
        tipo: 'Compra',
        estado: esValido ? 'valido' : 'invalido',
        movimiento: `+${item.cantidad}`,
        referencia: item.compra?.nro_compra || null,
        fecha: item.compra?.fecha_registro || null,
        responsable: item.compra?.usuario_registro?.id_usuario ? {
          id_usuario: item.compra.usuario_registro.id_usuario,
          nombre_usuario: item.compra.usuario_registro.usuario,
          nombre_completo: item.compra.usuario_registro.empleado?.nombre 
            ? `${item.compra.usuario_registro.empleado.nombre} ${item.compra.usuario_registro.empleado.ap_paterno} ${item.compra.usuario_registro.empleado.ap_materno}`
            : item.compra.usuario_registro.usuario
        } : null
      });
    });

    // Procesar ventas
    ventas.forEach(item => {
      const esValido = item.ventum?.estado === 1;
      
      // Sumar a salidas válidas
      if (esValido) {
        totalSalidasValidas += parseFloat(item.cantidad) || 0;
      }

      movimientos.push({
        tipo: 'Venta',
        estado: esValido ? 'valido' : 'invalido',
        movimiento: `-${item.cantidad}`,
        referencia: item.ventum?.nro_venta || null,
        fecha: item.ventum?.fecha_registro || null,
        responsable: item.ventum?.usuario_registro?.id_usuario ? {
          id_usuario: item.ventum.usuario_registro.id_usuario,
          nombre_usuario: item.ventum.usuario_registro.usuario,
          nombre_completo: item.ventum.usuario_registro.empleado?.nombre 
            ? `${item.ventum.usuario_registro.empleado.nombre} ${item.ventum.usuario_registro.empleado.ap_paterno} ${item.ventum.usuario_registro.empleado.ap_materno}`
            : item.ventum.usuario_registro.usuario
        } : null
      });
    });

    // Procesar ajustes de inventario
    ajustes.forEach(item => {
      const signo = item.tipo_movimiento === 1 ? '-' : '+';
      const esValido = item.estado === 1;
      
      // Sumar a entradas o salidas válidas según tipo de movimiento
      if (esValido) {
        if (item.tipo_movimiento === 1) {
          // Reducción de stock = salida
          totalSalidasValidas += parseFloat(item.cantidad) || 0;
        } else if (item.tipo_movimiento === 2) {
          // Aumento de stock = entrada
          totalEntradasValidas += parseFloat(item.cantidad) || 0;
        }
      }

      movimientos.push({
        tipo: 'Ajuste de Stock',
        estado: esValido ? 'valido' : 'invalido',
        movimiento: `${signo}${item.cantidad}`,
        referencia: null,
        fecha: item.fecha_registro,
        responsable: item.usuario?.id_usuario ? {
          id_usuario: item.usuario.id_usuario,
          nombre_usuario: item.usuario.usuario,
          nombre_completo: item.usuario.empleado?.nombre 
            ? `${item.usuario.empleado.nombre} ${item.usuario.empleado.ap_paterno} ${item.usuario.empleado.ap_materno}`
            : item.usuario.usuario
        } : null
      });
    });

    // Calcular stock de apertura
    const stockActual = parseFloat(producto.stock) || 0;
    const stockApertura = stockActual + totalSalidasValidas - totalEntradasValidas;
    
    // Crear objeto de stock de apertura (siempre al inicio)
    const movimientoApertura = {
      tipo: 'Stock de apertura',
      estado: 'valido',
      movimiento: `+${Math.max(0, stockApertura)}`, // Siempre positivo o +0
      referencia: null,
      fecha: producto.fecha_registro || null,
      responsable: null
    };

    // Ordenar por fecha (más reciente primero)
    movimientos.sort((a, b) => {
      const fechaA = new Date(a.fecha || 0);
      const fechaB = new Date(b.fecha || 0);
      return fechaB - fechaA;
    });
    // Insertar el movimiento de apertura al inicio
    movimientos.push(movimientoApertura);

    movimientos.reverse(); // Para mostrar desde el más antiguo al más reciente
    
    return res.status(200).json({
      id_producto: parseInt(id_producto),
      total_movimientos: movimientos.length,
      movimientos
    });

  } catch (error) {
    console.error('Error en kardex:', error);
    return res.status(500).json({ 
      mensaje: 'Error al obtener el kardex del producto', 
      error: error.message 
    });
  }
};

module.exports = {
  agregar,
  listar,
  modificar,
  movimientos,
  kardex
};

