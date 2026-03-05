const express = require('express');
const app = express();
//son para acceder a la variable de entorno
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path')
const morgan = require('morgan')
// Configurar CORS para permitir solicitudes desde cualquier origen 
const corsOptions = {
  origin: ['*','http://localhost:4200','http://localhost:9001','https://front2026.onrender.com'], // tu frontend en producción
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true // 👈 Permite enviar cookies/tokens
};
app.use(cors(corsOptions));
app.use(morgan('dev'))

dotenv.config();
app.use(express.json()); // <-- necesario para leer JSON desde req.body
app.use(express.urlencoded({ extended: true }));
//listar
app.use('/api/auth', require('./src/rutas/auth.route'))
app.use('/api/rol', require('./src/rutas/rol.route'))
app.use('/api/empleados', require('./src/rutas/empleado.route'))
app.use('/api/usuarios', require('./src/rutas/usuario.route'))
app.use('/api/proveedor', require('./src/rutas/proveedor.route'))
app.use('/api/cliente', require('./src/rutas/cliente.route'))
app.use('/api/producto', require('./src/rutas/producto.route'))
app.use('/api/categoria', require('./src/rutas/categoria.route'))
app.use('/api/marca', require('./src/rutas/marca.route'))
app.use('/api/unidad', require('./src/rutas/unidadMedida.route'))
app.use('/api/compra', require('./src/rutas/compra.route'))
app.use('/api/venta', require('./src/rutas/venta.route'))
app.use('/api/inventario', require('./src/rutas/inventario.route'))
app.use('/api/reporte', require('./src/rutas/reporte.route'))
app.use('/api/gasto', require('./src/rutas/gasto.route'))
app.use('/api/pedido', require('./src/rutas/pedido.route'))

app.use('/api/det_compra', require('./src/rutas/det_compra.route'))
app.use('/api/det_venta', require('./src/rutas/det_venta.route'))

app.use('/api/reporte-venta', require('./src/rutas/reporteVenta.route'))
//  Esto permite acceder a las imágenes por URL:
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.json('Algo salió mal!, errror: ' + err.message, err.stack)
});
// Configurar el servidor
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
});
