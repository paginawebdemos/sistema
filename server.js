const express = require('express');
const db = require('./database.js');
const crypto = require('crypto');

// === Configuración del Servidor ===
/**
 * Configuración inicial del servidor Express
 * @type {express.Express}
 */
const app = express();
const port = 3000;

/**
 * Almacenamiento en memoria para sesiones activas
 * @type {Map<string, number>}
 */
const sesionesActivas = new Map();

// Middleware global
app.use(express.json());
app.use(express.static('public'));

// === Middlewares ===

/**
 * Middleware para registrar actividades en la base de datos
 * @param {express.Request} req - Solicitud HTTP
 * @param {express.Response} res - Respuesta HTTP
 * @param {express.NextFunction} next - Función para pasar al siguiente middleware
 */
function registrarActividad(req, res, next) {
    if (req.usuario && req.body._log) {
        const { accion, detalles } = req.body._log;
        db.run(
            'INSERT INTO Actividades (fecha, usuario_id, usuario_nombre, accion, detalles) VALUES (datetime("now"), ?, ?, ?, ?)',
            [req.usuario.id, req.usuario.nombre, accion, detalles],
            (err) => { if (err) console.error('Error al registrar actividad:', err.message); }
        );
    }
    next();
}

/**
 * Middleware de autenticación basado en token
 * @param {express.Request} req - Solicitud HTTP
 * @param {express.Response} res - Respuesta HTTP
 * @param {express.NextFunction} next - Función para pasar al siguiente middleware
 */
function autenticar(req, res, next) {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    db.get(
        'SELECT s.*, u.username, u.nombre, u.rol FROM Sesiones s JOIN Usuarios u ON s.usuario_id = u.id WHERE s.token = ? AND s.expiracion > datetime("now")',
        [token],
        (err, sesion) => {
            if (err || !sesion) return res.status(401).json({ error: 'No autorizado o sesión expirada' });
            req.usuario = { id: sesion.usuario_id, username: sesion.username, nombre: sesion.nombre, rol: sesion.rol };
            next();
        }
    );
}

// === Endpoints de Autenticación ===

/**
 * Inicia sesión de un usuario
 * @route POST /login
 */
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    db.get('SELECT * FROM Usuarios WHERE username = ? AND password = ?', [username, passwordHash], (err, usuario) => {
        if (err || !usuario) {
            db.run(
                'INSERT INTO Actividades (fecha, accion, detalles) VALUES (datetime("now"), ?, ?)',
                ['Intento de inicio de sesión fallido', `Usuario: ${username}`]
            );
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiracion = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

        db.run('INSERT INTO Sesiones (token, usuario_id, expiracion) VALUES (?, ?, ?)', [token, usuario.id, expiracion], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            sesionesActivas.set(token, usuario.id);
            db.run('UPDATE Usuarios SET ultimo_login = datetime("now") WHERE id = ?', [usuario.id]);
            db.run(
                'INSERT INTO Actividades (fecha, usuario_id, usuario_nombre, accion, detalles) VALUES (datetime("now"), ?, ?, ?, ?)',
                [usuario.id, usuario.nombre, 'Inicio de sesión', `IP: ${req.ip}`]
            );
            res.json({ token, nombre: usuario.nombre, rol: usuario.rol });
        });
    });
});

/**
 * Cierra la sesión de un usuario
 * @route POST /logout
 */
app.post('/logout', autenticar, (req, res) => {
    const token = req.headers.authorization;
    db.run('UPDATE Sesiones SET activa = 0 WHERE token = ?', [token], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        sesionesActivas.delete(token);
        res.json({ message: 'Sesión cerrada' });
    });
});

// === Endpoints de Usuarios ===

/**
 * Lista todos los usuarios (solo admin)
 * @route GET /usuarios
 */
app.get('/usuarios', autenticar, (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No tienes permisos' });
    db.all('SELECT id, username, nombre, rol, ultimo_login FROM Usuarios', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * Crea un nuevo usuario (solo admin)
 * @route POST /usuarios
 */
app.post('/usuarios', autenticar, (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No tienes permisos' });
    const { username, password, nombre, rol } = req.body;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    db.run(
        'INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)',
        [username, passwordHash, nombre, rol],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: 'Usuario creado' });
        }
    );
});

/**
 * Obtiene datos del usuario actual
 * @route GET /usuario/actual
 */
app.get('/usuario/actual', autenticar, (req, res) => {
    res.json({ id: req.usuario.id, username: req.usuario.username, nombre: req.usuario.nombre, rol: req.usuario.rol });
});

/**
 * Actualiza datos del usuario actual
 * @route PUT /usuario/actual
 */
app.put('/usuario/actual', autenticar, (req, res) => {
    const { nombre, username, password } = req.body;
    const query = password
        ? 'UPDATE Usuarios SET nombre = ?, username = ?, password = ? WHERE id = ?'
        : 'UPDATE Usuarios SET nombre = ?, username = ? WHERE id = ?';
    const params = password
        ? [nombre, username, crypto.createHash('sha256').update(password).digest('hex'), req.usuario.id]
        : [nombre, username, req.usuario.id];

    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Usuario actualizado' });
    });
});

/**
 * Elimina un usuario (solo admin)
 * @route DELETE /usuarios/:id
 */
app.delete('/usuarios/:id', autenticar, (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No tienes permisos' });

    db.get('SELECT COUNT(*) as count FROM Usuarios WHERE rol = "admin"', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row.count <= 1) {
            db.get('SELECT id FROM Usuarios WHERE rol = "admin" AND id = ?', [req.params.id], (err, admin) => {
                if (admin) return res.status(400).json({ error: 'No puedes eliminar el último administrador' });
                eliminarUsuario(req, res);
            });
        } else {
            eliminarUsuario(req, res);
        }
    });
});

/**
 * Función auxiliar para eliminar un usuario
 * @param {express.Request} req - Solicitud HTTP
 * @param {express.Response} res - Respuesta HTTP
 */
function eliminarUsuario(req, res) {
    db.run('DELETE FROM Usuarios WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Usuario eliminado' });
    });
}

// === Endpoint de Actividades ===

/**
 * Obtiene las últimas 100 actividades (solo admin)
 * @route GET /actividades
 */
app.get('/actividades', autenticar, (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No tienes permisos' });
    db.all(
        `SELECT a.fecha, u.nombre as usuario, a.accion, a.detalles 
         FROM Actividades a LEFT JOIN Usuarios u ON a.usuario_id = u.id 
         ORDER BY a.fecha DESC LIMIT 100`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Aplica middlewares globales a rutas protegidas
app.use(autenticar);
app.use(registrarActividad);

// === Endpoints de Productos ===

/**
 * Lista todos los productos
 * @route GET /productos
 */
app.get('/productos', (req, res) => {
    db.all('SELECT * FROM Productos', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * Obtiene un producto por ID
 * @route GET /productos/:id
 */
app.get('/productos/:id', (req, res) => {
    db.get('SELECT * FROM Productos WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || {});
    });
});

/**
 * Agrega un nuevo producto
 * @route POST /productos
 */
app.post('/productos', (req, res) => {
    const { nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock } = req.body;
    db.run(
        'INSERT INTO Productos (nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock) VALUES (?, ?, ?, ?, ?, ?)',
        [nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Producto agregado' });
        }
    );
});

/**
 * Actualiza un producto
 * @route PUT /productos/:id
 */
app.put('/productos/:id', (req, res) => {
    const { nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock } = req.body;
    db.run(
        'UPDATE Productos SET nombre = ?, precioCompraBs = ?, precioCompraUsd = ?, precioVentaBs = ?, precioVentaUsd = ?, stock = ? WHERE id = ?',
        [nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Producto actualizado' });
        }
    );
});

/**
 * Elimina un producto
 * @route DELETE /productos/:id
 */
app.delete('/productos/:id', (req, res) => {
    db.run('DELETE FROM Productos WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Producto eliminado' });
    });
});

// === Endpoints de Clientes ===

/**
 * Lista todos los clientes
 * @route GET /clientes
 */
app.get('/clientes', (req, res) => {
    db.all('SELECT id, nombre, telefono FROM Clientes', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * Agrega un nuevo cliente
 * @route POST /clientes
 */
app.post('/clientes', (req, res) => {
    const { nombre, telefono } = req.body;
    db.run('INSERT INTO Clientes (nombre, telefono) VALUES (?, ?)', [nombre, telefono], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Cliente agregado' });
    });
});

/**
 * Elimina un cliente
 * @route DELETE /clientes/:id
 */
app.delete('/clientes/:id', (req, res) => {
    db.run('DELETE FROM Clientes WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Cliente eliminado' });
    });
});

/**
 * Obtiene el historial de un cliente
 * @route GET /clientes/:id/historial
 */
app.get('/clientes/:id/historial', (req, res) => {
    const clienteId = req.params.id;
    const query = `
        SELECT v.id, v.fecha, CASE WHEN v.origenFiado = 1 THEN 'Fiado Pagado' ELSE 'Venta' END AS tipo, v.total, v.iva, v.descuento,
               GROUP_CONCAT(dv.productoId || '|' || dv.cantidad || '|' || dv.precioVentaBs || '|' || dv.total) AS productos
        FROM Ventas v LEFT JOIN DetalleVentas dv ON v.id = dv.ventaId WHERE v.clienteId = ?
        GROUP BY v.id, v.fecha, v.total, v.iva, v.descuento, v.origenFiado
        UNION
        SELECT f.id, f.fecha, 'Fiado' AS tipo, f.total, 0 AS iva, 0 AS descuento,
               GROUP_CONCAT(df.productoId || '|' || df.cantidad || '|' || df.precioVentaBs || '|' || df.total) AS productos
        FROM Fiados f LEFT JOIN DetalleFiados df ON f.id = df.fiadoId WHERE f.clienteId = ?
        GROUP BY f.id, f.fecha, f.total`;

    db.all(query, [clienteId, clienteId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const historial = rows.map(row => ({
            ...row,
            productos: row.productos ? row.productos.split(',').map(p => {
                const [productoId, cantidad, precioVentaBs, total] = p.split('|');
                return { productoId: parseInt(productoId), cantidad: parseInt(cantidad), precioVentaBs: parseFloat(precioVentaBs), total: parseFloat(total), nombre: '' };
            }) : []
        }));

        Promise.all(historial.map(item =>
            Promise.all(item.productos.map(p =>
                new Promise((resolve) => {
                    db.get('SELECT nombre FROM Productos WHERE id = ?', [p.productoId], (err, row) => {
                        p.nombre = row ? row.nombre : 'Desconocido';
                        resolve(p);
                    });
                })
            ))
        )).then(historialCompleto => res.json(historialCompleto.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))))
          .catch(err => res.status(500).json({ error: err.message }));
    });
});

// === Endpoints de Ventas ===

/**
 * Lista todas las ventas con filtros
 * @route GET /ventas
 */
app.get('/ventas', (req, res) => {
    const { cliente, fecha, tipo } = req.query;
    let whereClauses = [];
    let params = [];

    if (cliente) {
        whereClauses.push('c.nombre LIKE ?');
        params.push(`%${cliente}%`);
    }
    if (fecha) {
        const [year, month, day] = fecha.split('-').map(part => parseInt(part).toString());
        const fechaFormateada = `${day}/${month}/${year}`;
        whereClauses.push('SUBSTR(v.fecha, 1, INSTR(v.fecha, ",") - 1) = ?');
        params.push(fechaFormateada);
    }
    if (tipo === 'fiados') whereClauses.push('v.origenFiado = 1');
    else if (tipo === 'directas') whereClauses.push('v.origenFiado = 0 OR v.origenFiado IS NULL');

    const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const query = `
        SELECT v.id, v.fecha, v.total, v.iva, v.descuento, v.metodo_pago, v.origenFiado, c.nombre AS cliente,
               json_group_array(json_object('id', p.id, 'nombre', p.nombre, 'cantidad', dv.cantidad, 'precioVentaBs', dv.precioVentaBs, 'total', dv.total)) AS productos
        FROM Ventas v LEFT JOIN Clientes c ON v.clienteId = c.id LEFT JOIN DetalleVentas dv ON v.id = dv.ventaId LEFT JOIN Productos p ON dv.productoId = p.id
        ${whereClause}
        GROUP BY v.id ORDER BY v.fecha DESC`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => ({ ...row, productos: JSON.parse(row.productos || '[]') })));
    });
});

/**
 * Registra una nueva venta
 * @route POST /ventas
 */
app.post('/ventas', (req, res) => {
    const { fecha, clienteId, clienteNombre, total, iva = 0, descuento = 0, metodo_pago = 'Efectivo', origenFiado = 0, productos } = req.body;
    if (!productos || !Array.isArray(productos)) return res.status(400).json({ error: 'Productos no válidos' });

    const obtenerClienteId = () => new Promise((resolve, reject) => {
        if (clienteId) return resolve(clienteId);
        const nombre = (clienteNombre || 'Anónimo').trim();
        db.get('SELECT id FROM Clientes WHERE nombre = ?', [nombre], (err, row) => {
            if (err) return reject(err);
            if (row) resolve(row.id);
            else db.run('INSERT INTO Clientes (nombre) VALUES (?)', [nombre], function (err) { err ? reject(err) : resolve(this.lastID); });
        });
    });

    obtenerClienteId()
        .then(clienteIdFinal => {
            return new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO Ventas (fecha, clienteId, total, iva, descuento, metodo_pago, origenFiado) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [fecha, clienteIdFinal, total, iva, descuento, metodo_pago, origenFiado],
                    function (err) { err ? reject(err) : resolve(this.lastID); }
                );
            }).then(ventaId => Promise.all(productos.map(p =>
                new Promise((resolve, reject) => {
                    db.get('SELECT nombre FROM Productos WHERE id = ?', [p.id], (err, row) => {
                        if (err) return reject(err);
                        db.run(
                            'INSERT INTO DetalleVentas (ventaId, productoId, cantidad, precioVentaBs, total) VALUES (?, ?, ?, ?, ?)',
                            [ventaId, p.id, p.cantidad, p.precioVentaBs, p.total],
                            (err) => err ? reject(err) : resolve({ ...p, nombre: row ? row.nombre : 'Desconocido' })
                        );
                    });
                })
            )).then(() => ventaId));
        })
        .then(ventaId => res.json({ message: 'Venta registrada correctamente', ventaId }))
        .catch(err => res.status(500).json({ error: 'Error al registrar venta', details: err.message }));
});

// === Endpoints de Fiados ===

/**
 * Lista todos los fiados
 * @route GET /fiados
 */
app.get('/fiados', (req, res) => {
    const query = `
        SELECT f.id, f.fecha, f.total, c.nombre AS cliente,
               json_group_array(json_object('id', p.id, 'nombre', p.nombre, 'cantidad', df.cantidad, 'precioVentaBs', df.precioVentaBs, 'total', df.total)) AS productos
        FROM Fiados f LEFT JOIN Clientes c ON f.clienteId = c.id LEFT JOIN DetalleFiados df ON f.id = df.fiadoId LEFT JOIN Productos p ON df.productoId = p.id
        GROUP BY f.id ORDER BY f.fecha DESC`;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => ({ ...row, productos: JSON.parse(row.productos || '[]') })));
    });
});

/**
 * Obtiene un fiado por ID
 * @route GET /fiados/:id
 */
app.get('/fiados/:id', (req, res) => {
    const query = `
        SELECT f.id, f.fecha, f.total, c.nombre AS cliente,
               GROUP_CONCAT(df.productoId || '|' || df.cantidad || '|' || df.precioVentaBs || '|' || df.total) AS productos
        FROM Fiados f JOIN Clientes c ON f.clienteId = c.id LEFT JOIN DetalleFiados df ON f.id = df.fiadoId
        WHERE f.id = ? GROUP BY f.id, f.fecha, f.total, c.nombre`;
    db.get(query, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Fiado no encontrado' });
        const productos = row.productos ? row.productos.split(',').map(p => {
            const [productoId, cantidad, precioVentaBs, total] = p.split('|');
            return { productoId: parseInt(productoId), cantidad: parseInt(cantidad), precioVentaBs: parseFloat(precioVentaBs), total: parseFloat(total), nombre: '' };
        }) : [];
        Promise.all(productos.map(p =>
            new Promise((resolve) => {
                db.get('SELECT nombre FROM Productos WHERE id = ?', [p.productoId], (err, row) => {
                    p.nombre = row ? row.nombre : 'Desconocido';
                    resolve(p);
                });
            })
        )).then(updatedProductos => res.json({ ...row, productos: updatedProductos }))
          .catch(err => res.status(500).json({ error: err.message }));
    });
});

/**
 * Registra un nuevo fiado
 * @route POST /fiados
 */
app.post('/fiados', (req, res) => {
    const { fecha, clienteId, total, productos } = req.body;
    db.run('INSERT INTO Fiados (fecha, clienteId, total) VALUES (?, ?, ?)', [fecha, clienteId, total], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const fiadoId = this.lastID;
        Promise.all(productos.map(p =>
            new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO DetalleFiados (fiadoId, productoId, cantidad, precioVentaBs, total) VALUES (?, ?, ?, ?, ?)',
                    [fiadoId, p.id, p.cantidad, p.precioVentaBs, p.total],
                    (err) => err ? reject(err) : resolve()
                );
            })
        )).then(() => res.json({ message: 'Fiado registrado' }))
          .catch(err => res.status(500).json({ error: err.message }));
    });
});

/**
 * Actualiza un fiado
 * @route PUT /fiados/:id
 */
app.put('/fiados/:id', (req, res) => {
    const { fecha, clienteId, total, productos } = req.body;
    db.run('UPDATE Fiados SET fecha = ?, clienteId = ?, total = ? WHERE id = ?', [fecha, clienteId, total, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all('SELECT productoId, cantidad FROM DetalleFiados WHERE fiadoId = ?', [req.params.id], (err, originales) => {
            if (err) return res.status(500).json({ error: err.message });

            db.run('DELETE FROM DetalleFiados WHERE fiadoId = ?', [req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                Promise.all(productos.map(p =>
                    new Promise((resolve, reject) => {
                        db.run(
                            'INSERT INTO DetalleFiados (fiadoId, productoId, cantidad, precioVentaBs, total) VALUES (?, ?, ?, ?, ?)',
                            [req.params.id, p.id, p.cantidad, p.precioVentaBs, p.total],
                            (err) => {
                                if (err) return reject(err);
                                const original = originales.find(o => o.productoId === p.id);
                                const diff = original ? original.cantidad - p.cantidad : -p.cantidad;
                                db.run('UPDATE Productos SET stock = stock + ? WHERE id = ?', [diff, p.id], (err) => err ? reject(err) : resolve());
                            }
                        );
                    })
                )).then(() => res.json({ message: 'Fiado actualizado' }))
                  .catch(err => res.status(500).json({ error: err.message }));
            });
        });
    });
});

/**
 * Elimina un fiado
 * @route DELETE /fiados/:id
 */
app.delete('/fiados/:id', (req, res) => {
    db.run('DELETE FROM DetalleFiados WHERE fiadoId = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run('DELETE FROM Fiados WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Fiado eliminado' });
        });
    });
});

// === Endpoints de Proveedores ===

/**
 * Lista todos los proveedores
 * @route GET /proveedores
 */
app.get('/proveedores', (req, res) => {
    db.all('SELECT * FROM Proveedores', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * Agrega un nuevo proveedor
 * @route POST /proveedores
 */
app.post('/proveedores', (req, res) => {
    const { nombre, contacto, productos } = req.body;
    const productosTexto = Array.isArray(productos) ? productos.join(', ') : productos;
    db.run('INSERT INTO Proveedores (nombre, contacto, productos) VALUES (?, ?, ?)', [nombre, contacto, productosTexto], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Proveedor agregado' });
    });
});

/**
 * Elimina un proveedor
 * @route DELETE /proveedores/:id
 */
app.delete('/proveedores/:id', (req, res) => {
    db.run('DELETE FROM Proveedores WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Proveedor eliminado' });
    });
});

// === Endpoints de Configuración ===

/**
 * Obtiene todas las configuraciones
 * @route GET /config
 */
app.get('/config', (req, res) => {
    db.all('SELECT clave, valor FROM Config', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.reduce((acc, row) => ({ ...acc, [row.clave]: row.valor }), {}));
    });
});

/**
 * Actualiza o agrega una configuración
 * @route POST /config
 */
app.post('/config', (req, res) => {
    const { clave, valor } = req.body;
    db.get('SELECT * FROM Config WHERE clave = ?', [clave], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        const query = row ? 'UPDATE Config SET valor = ? WHERE clave = ?' : 'INSERT INTO Config (clave, valor) VALUES (?, ?)';
        db.run(query, row ? [valor, clave] : [clave, valor], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: `Configuración ${clave} ${row ? 'actualizada' : 'agregada'}` });
        });
    });
});

// === Endpoint de Estadísticas ===

/**
 * Obtiene estadísticas generales
 * @route GET /estadisticas
 */
app.get('/estadisticas', (req, res) => {
    db.all(
        'SELECT (SELECT COUNT(*) FROM Ventas) AS total_ventas, (SELECT COUNT(*) FROM Fiados) AS total_fiados, (SELECT COUNT(*) FROM Productos) AS total_productos, (SELECT COUNT(*) FROM Clientes) AS total_clientes',
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows[0]);
        }
    );
});

// === Funciones Auxiliares ===

/**
 * Inicializa configuraciones por defecto si no existen
 */
function inicializarConfig() {
    const valoresPorDefecto = [
        { clave: 'businessName', valor: 'Mi Negocio' },
        { clave: 'tasaDolar', valor: '43.50' },
        { clave: 'tasaModo', valor: 'manual' },
        { clave: 'puntosMisiones', valor: '0' },
        { clave: 'misionVentasHoy', valor: '' },
        { clave: 'misionProductosHoy', valor: '' }
    ];
    valoresPorDefecto.forEach(({ clave, valor }) => {
        db.get('SELECT * FROM Config WHERE clave = ?', [clave], (err, row) => {
            if (!row && !err) db.run('INSERT INTO Config (clave, valor) VALUES (?, ?)', [clave, valor]);
        });
    });
}

// === Inicio del Servidor ===

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    inicializarConfig();
});