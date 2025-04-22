 const express = require('express');
const db = require('./database.js');
const crypto = require('crypto');

// Configuración inicial del servidor Express
const app = express();
const port = 3000;

// Middleware para parsear JSON y servir archivos estáticos
app.use(express.json());
app.use(express.static('public'));

// Almacenamiento en memoria para sesiones activas
const sesionesActivas = new Map();

// === MIDDLEWARES ===

// Middleware para registrar actividades en la base de datos
function registrarActividad(req, res, next) {
    if (req.usuario) {
        const { accion, detalles } = req.body._log || {};
        if (accion) {
            db.run(
                "INSERT INTO Actividades (fecha, usuario_id, usuario_nombre, accion, detalles) VALUES (datetime('now'), ?, ?, ?, ?)",
                [req.usuario.id, req.usuario.nombre, accion, detalles]
            );
        }
    }
    next();
}

// Middleware de autenticación basado en token
function autenticar(req, res, next) {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    db.get(
        "SELECT s.*, u.username, u.nombre, u.rol FROM Sesiones s JOIN Usuarios u ON s.usuario_id = u.id WHERE s.token = ? AND s.expiracion > datetime('now')", 
        [token], 
        (err, sesion) => {
            if (err || !sesion) return res.status(401).json({ error: 'No autorizado o sesión expirada' });
            req.usuario = {
                id: sesion.usuario_id,
                username: sesion.username,
                nombre: sesion.nombre,
                rol: sesion.rol
            };
            next();
        }
    );
}

// === ENDPOINTS DE AUTENTICACIÓN ===

// Login de usuario
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    db.get("SELECT * FROM Usuarios WHERE username = ? AND password = ?", 
        [username, passwordHash], 
        (err, usuario) => {
            if (err || !usuario) {
                db.run(
                    "INSERT INTO Actividades (fecha, accion, detalles) VALUES (datetime('now'), ?, ?)",
                    ['Intento de inicio de sesión fallido', `Usuario: ${username}`]
                );
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            const expiracion = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 horas

            db.run(
                "INSERT INTO Sesiones (token, usuario_id, expiracion) VALUES (?, ?, ?)",
                [token, usuario.id, expiracion.toISOString()],
                function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    
                    sesionesActivas.set(token, usuario.id);
                    db.run("UPDATE Usuarios SET ultimo_login = datetime('now') WHERE id = ?", [usuario.id]);
                    db.run(
                        "INSERT INTO Actividades (fecha, usuario_id, usuario_nombre, accion, detalles) VALUES (datetime('now'), ?, ?, ?, ?)",
                        [usuario.id, usuario.nombre, 'Inicio de sesión', `IP: ${req.ip}`]
                    );

                    res.json({ token, nombre: usuario.nombre, rol: usuario.rol });
                }
            );
        }
    );
});

// Cierre de sesión
app.post('/logout', autenticar, (req, res) => {
    const token = req.headers.authorization;
    db.run("UPDATE Sesiones SET activa = 0 WHERE token = ?", [token], (err) => {
        sesionesActivas.delete(token);
        res.json({ message: 'Sesión cerrada' });
    });
});

// === ENDPOINTS DE USUARIOS ===

// Listar todos los usuarios (solo admin)
app.get('/usuarios', autenticar, (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No tienes permisos' });
    db.all("SELECT id, username, nombre, rol, ultimo_login FROM Usuarios", [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// Crear nuevo usuario (solo admin)
app.post('/usuarios', autenticar, (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No tienes permisos' });
    const { username, password, nombre, rol } = req.body;
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    db.run(
        "INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)",
        [username, passwordHash, nombre, rol],
        function(err) {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ id: this.lastID, message: 'Usuario creado' });
        }
    );
});

// Obtener datos del usuario actual
app.get('/usuario/actual', autenticar, (req, res) => {
    res.json({
        id: req.usuario.id,
        username: req.usuario.username,
        nombre: req.usuario.nombre,
        rol: req.usuario.rol
    });
});

// Actualizar datos del usuario actual
app.put('/usuario/actual', autenticar, (req, res) => {
    const { nombre, username, password } = req.body;
    let query = "UPDATE Usuarios SET nombre = ?, username = ?";
    let params = [nombre, username];
    
    if (password) {
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
        query += ", password = ?";
        params.push(passwordHash);
    }
    
    query += " WHERE id = ?";
    params.push(req.usuario.id);
    
    db.run(query, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Usuario actualizado' });
    });
});

// Eliminar usuario (solo admin)
app.delete('/usuarios/:id', autenticar, (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No tienes permisos' });
    
    db.get("SELECT COUNT(*) as count FROM Usuarios WHERE rol = 'admin'", [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (row.count <= 1) {
            db.get("SELECT id FROM Usuarios WHERE rol = 'admin' AND id = ?", [req.params.id], (err, admin) => {
                if (admin) {
                    return res.status(400).json({ error: 'No puedes eliminar el último administrador' });
                }
                procederConEliminacion();
            });
        } else {
            procederConEliminacion();
        }
    });
    
    function procederConEliminacion() {
        db.run("DELETE FROM Usuarios WHERE id = ?", [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Usuario eliminado' });
        });
    }
});

// === ENDPOINT DE ACTIVIDADES ===

// Obtener últimas 100 actividades (solo admin)
app.get('/actividades', autenticar, (req, res) => {
    if (req.usuario.rol !== 'admin') return res.status(403).json({ error: 'No tienes permisos' });
    db.all(`
        SELECT a.fecha, u.nombre as usuario, a.accion, a.detalles 
        FROM Actividades a
        LEFT JOIN Usuarios u ON a.usuario_id = u.id
        ORDER BY a.fecha DESC
        LIMIT 100
    `, [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

// Aplicar middlewares globales a rutas protegidas
app.use(autenticar);
app.use(registrarActividad);

// === ENDPOINTS DE PRODUCTOS ===

app.get('/productos', (req, res) => {
    db.all("SELECT * FROM Productos", [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.get('/productos/:id', (req, res) => {
    db.get("SELECT * FROM Productos WHERE id = ?", [req.params.id], (err, row) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(row);
    });
});

app.post('/productos', (req, res) => {
    const { nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock } = req.body;
    db.run(
        "INSERT INTO Productos (nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock) VALUES (?, ?, ?, ?, ?, ?)",
        [nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock],
        (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ message: 'Producto agregado' });
        }
    );
});

app.put('/productos/:id', (req, res) => {
    const { nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock } = req.body;
    db.run(
        "UPDATE Productos SET nombre = ?, precioCompraBs = ?, precioCompraUsd = ?, precioVentaBs = ?, precioVentaUsd = ?, stock = ? WHERE id = ?",
        [nombre, precioCompraBs, precioCompraUsd, precioVentaBs, precioVentaUsd, stock, req.params.id],
        (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ message: 'Producto actualizado' });
        }
    );
});

app.delete('/productos/:id', (req, res) => {
    db.run("DELETE FROM Productos WHERE id = ?", [req.params.id], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Producto eliminado' });
    });
});

// === ENDPOINTS DE CLIENTES ===

app.get('/clientes', (req, res) => {
    db.all("SELECT id, nombre, telefono FROM Clientes", [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.post('/clientes', (req, res) => {
    const { nombre, telefono } = req.body; 
    db.run("INSERT INTO Clientes (nombre, telefono) VALUES (?, ?)", [nombre, telefono], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Cliente agregado' });
    });
});

app.delete('/clientes/:id', (req, res) => {
    db.run("DELETE FROM Clientes WHERE id = ?", [req.params.id], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Cliente eliminado' });
    });
});

app.get('/clientes/:id/historial', (req, res) => {
    const clienteId = req.params.id;
    const query = `
        SELECT v.id, v.fecha, 
               CASE WHEN v.origenFiado = 1 THEN 'Fiado Pagado' ELSE 'Venta' END AS tipo, 
               v.total, v.iva, v.descuento,
               GROUP_CONCAT(dv.productoId || '|' || dv.cantidad || '|' || dv.precioVentaBs || '|' || dv.total) AS productos
        FROM Ventas v
        LEFT JOIN DetalleVentas dv ON v.id = dv.ventaId
        WHERE v.clienteId = ?
        GROUP BY v.id, v.fecha, v.total, v.iva, v.descuento, v.origenFiado
        UNION
        SELECT f.id, f.fecha, 'Fiado' AS tipo, f.total, 0 AS iva, 0 AS descuento,
               GROUP_CONCAT(df.productoId || '|' || df.cantidad || '|' || df.precioVentaBs || '|' || df.total) AS productos
        FROM Fiados f
        LEFT JOIN DetalleFiados df ON f.id = df.fiadoId
        WHERE f.clienteId = ?
        GROUP BY f.id, f.fecha, f.total
    `;

    db.all(query, [clienteId, clienteId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const procesarProductos = (items) => items.map(item => {
            const productos = item.productos ? item.productos.split(',').map(p => {
                const [productoId, cantidad, precioVentaBs, total] = p.split('|');
                return { 
                    productoId: parseInt(productoId), 
                    cantidad: parseInt(cantidad), 
                    precioVentaBs: parseFloat(precioVentaBs), 
                    total: parseFloat(total), 
                    nombre: '' 
                };
            }) : [];
            return { ...item, productos };
        });

        let historial = procesarProductos(rows);

        Promise.all(historial.map(item =>
            Promise.all(item.productos.map(p =>
                new Promise((resolve) => {
                    db.get("SELECT nombre FROM Productos WHERE id = ?", [p.productoId], (err, row) => {
                        p.nombre = row ? row.nombre : 'Desconocido';
                        resolve(p);
                    });
                })
            )).then(() => item)
        )).then(historialCompleto => {
            historialCompleto.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            res.json(historialCompleto);
        }).catch(err => res.status(500).json({ error: err.message }));
    });
});

// === ENDPOINTS DE VENTAS ===

app.get('/ventas', (req, res) => {
    const { cliente, fecha, tipo } = req.query;
    let whereClauses = [];
    let params = [];

    if (cliente) {
        whereClauses.push("c.nombre LIKE ?");
        params.push(`%${cliente}%`);
    }

    if (fecha) {
        console.log('Fecha recibida:', fecha);
        const [year, month, day] = fecha.split('-').map(part => parseInt(part).toString());
        const fechaFormateada = `${day}/${month}/${year}`;
        whereClauses.push("SUBSTR(v.fecha, 1, INSTR(v.fecha, ',') - 1) = ?");
        params.push(fechaFormateada);
    }

    if (tipo === 'fiados') {
        whereClauses.push("v.origenFiado = 1");
    } else if (tipo === 'directas') {
        whereClauses.push("v.origenFiado = 0 OR v.origenFiado IS NULL");
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const query = `
        SELECT 
            v.id, v.fecha, v.total, v.iva, v.descuento, v.metodo_pago, v.origenFiado,
            c.nombre AS cliente,
            json_group_array(json_object(
                'id', p.id, 'nombre', p.nombre, 'cantidad', dv.cantidad,
                'precioVentaBs', dv.precioVentaBs, 'total', dv.total
            )) AS productos
        FROM Ventas v
        LEFT JOIN Clientes c ON v.clienteId = c.id
        LEFT JOIN DetalleVentas dv ON v.id = dv.ventaId
        LEFT JOIN Productos p ON dv.productoId = p.id
        ${whereClause}
        GROUP BY v.id
        ORDER BY v.fecha DESC
    `;

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error en reporte ventas:', err);
            return res.status(500).json([]);
        }
        const ventas = rows.map(row => ({
            ...row,
            tipoVenta: row.origenFiado ? 'Fiado Pagado' : 'Venta Directa',
            productos: JSON.parse(row.productos || '[]')
        }));
        res.json(ventas);
    });
});

app.post('/ventas', (req, res) => {
    let { fecha, clienteId, clienteNombre, total, iva, descuento = 0, metodo_pago = 'Efectivo', origenFiado = 0, productos } = req.body;
    
    if (!productos || !Array.isArray(productos)) {
        return res.status(400).json({ error: 'Productos no válidos' });
    }

    const gestionarCliente = () => {
        return new Promise((resolve, reject) => {
            if (clienteId) return resolve(clienteId);
            if (!clienteNombre || clienteNombre.trim() === '') clienteNombre = 'Anónimo';

            db.get("SELECT id FROM Clientes WHERE nombre = ?", [clienteNombre.trim()], (err, row) => {
                if (err) return reject(err);
                if (row) {
                    resolve(row.id);
                } else {
                    db.run("INSERT INTO Clientes (nombre) VALUES (?)", [clienteNombre.trim()], function(err) {
                        if (err) return reject(err);
                        resolve(this.lastID);
                    });
                }
            });
        });
    };

    const productosConNombre = productos.map(p => {
        if (!p.nombre) {
            return new Promise((resolve) => {
                db.get("SELECT nombre FROM Productos WHERE id = ?", [p.id], (err, row) => {
                    p.nombre = row ? row.nombre : 'Producto Desconocido';
                    resolve(p);
                });
            });
        }
        return Promise.resolve(p);
    });

    gestionarCliente()
        .then(clienteIdFinal => {
            return Promise.all(productosConNombre)
                .then(prodsVerificados => {
                    return new Promise((resolve, reject) => {
                        db.run(
                            "INSERT INTO Ventas (fecha, clienteId, total, iva, descuento, metodo_pago, origenFiado) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                            [fecha, clienteIdFinal, total, iva || 0, descuento, metodo_pago, origenFiado],
                            function(err) {
                                if (err) return reject(err);
                                resolve({ ventaId: this.lastID, productos: prodsVerificados });
                            }
                        );
                    });
                })
                .then(({ ventaId, productos }) => {
                    const inserts = productos.map(p => 
                        new Promise((resolve, reject) => {
                            db.run(
                                "INSERT INTO DetalleVentas (ventaId, productoId, cantidad, precioVentaBs, total) VALUES (?, ?, ?, ?, ?)",
                                [ventaId, p.id, p.cantidad, p.precioVentaBs, p.total],
                                (err) => err ? reject(err) : resolve()
                            );
                        })
                    );
                    return Promise.all(inserts).then(() => ventaId);
                });
        })
        .then(ventaId => {
            res.json({ message: 'Venta registrada correctamente', ventaId });
        })
        .catch(err => {
            console.error('Error en el proceso de venta:', err);
            res.status(500).json({ error: 'Error al registrar venta', details: err.message });
        });
});

// === ENDPOINTS DE FIADOS ===

app.get('/fiados', (req, res) => {
    const query = `
        SELECT 
            f.id, f.fecha, f.total, c.nombre AS cliente,
            json_group_array(json_object(
                'id', p.id, 'nombre', p.nombre, 'cantidad', df.cantidad,
                'precioVentaBs', df.precioVentaBs, 'total', df.total
            )) AS productos
        FROM Fiados f
        LEFT JOIN Clientes c ON f.clienteId = c.id
        LEFT JOIN DetalleFiados df ON f.id = df.fiadoId
        LEFT JOIN Productos p ON df.productoId = p.id
        GROUP BY f.id
        ORDER BY f.fecha DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error en reporte fiados:', err);
            return res.status(500).json([]);
        }
        const fiados = rows.map(row => ({
            ...row,
            productos: JSON.parse(row.productos || '[]')
        }));
        res.json(fiados);
    });
});

app.get('/fiados/:id', (req, res) => {
    db.get(`
        SELECT f.id, f.fecha, f.total, c.nombre AS cliente, GROUP_CONCAT(df.productoId || '|' || df.cantidad || '|' || df.precioVentaBs || '|' || df.total) AS productos
        FROM Fiados f
        JOIN Clientes c ON f.clienteId = c.id
        LEFT JOIN DetalleFiados df ON f.id = df.fiadoId
        WHERE f.id = ?
        GROUP BY f.id, f.fecha, f.total, c.nombre
    `, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Fiado no encontrado' });
        const productos = row.productos ? row.productos.split(',').map(p => {
            const [productoId, cantidad, precioVentaBs, total] = p.split('|');
            return { 
                productoId: parseInt(productoId), 
                cantidad: parseInt(cantidad), 
                precioVentaBs: parseFloat(precioVentaBs), 
                total: parseFloat(total), 
                nombre: '' 
            };
        }) : [];
        Promise.all(productos.map(p =>
            new Promise((resolve) => {
                db.get("SELECT nombre FROM Productos WHERE id = ?", [p.productoId], (err, row) => {
                    p.nombre = row ? row.nombre : 'Desconocido';
                    resolve(p);
                });
            })
        )).then(updatedProductos => res.json({ ...row, productos: updatedProductos }))
          .catch(err => res.status(500).json({ error: err.message }));
    });
});

app.post('/fiados', (req, res) => {
    const { fecha, clienteId, total, productos } = req.body;
    db.run("INSERT INTO Fiados (fecha, clienteId, total) VALUES (?, ?, ?)", [fecha, clienteId, total], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const fiadoId = this.lastID;
        const inserts = productos.map(p =>
            new Promise((resolve, reject) =>
                db.run("INSERT INTO DetalleFiados (fiadoId, productoId, cantidad, precioVentaBs, total) VALUES (?, ?, ?, ?, ?)",
                    [fiadoId, p.id, p.cantidad, p.precioVentaBs, p.total], (err) => err ? reject(err) : resolve())
            )
        );
        Promise.all(inserts)
            .then(() => res.json({ message: 'Fiado registrado' }))
            .catch(err => res.status(500).json({ error: err.message }));
    });
});

app.put('/fiados/:id', (req, res) => {
    const { fecha, clienteId, total, productos } = req.body;
    db.run("UPDATE Fiados SET fecha = ?, clienteId = ?, total = ? WHERE id = ?", [fecha, clienteId, total, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all("SELECT productoId, cantidad FROM DetalleFiados WHERE fiadoId = ?", [req.params.id], (err, originales) => {
            if (err) return res.status(500).json({ error: err.message });

            db.run("DELETE FROM DetalleFiados WHERE fiadoId = ?", [req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                const inserts = productos.map(p =>
                    new Promise((resolve, reject) => {
                        db.run("INSERT INTO DetalleFiados (fiadoId, productoId, cantidad, precioVentaBs, total) VALUES (?, ?, ?, ?, ?)",
                            [req.params.id, p.id, p.cantidad, p.precioVentaBs, p.total], (err) => {
                                if (err) return reject(err);
                                const original = originales.find(o => o.productoId === p.id);
                                const diff = original ? original.cantidad - p.cantidad : -p.cantidad;
                                db.run("UPDATE Productos SET stock = stock + ? WHERE id = ?", [diff, p.id], (err) => {
                                    err ? reject(err) : resolve();
                                });
                            });
                    })
                );

                Promise.all(inserts)
                    .then(() => res.json({ message: 'Fiado actualizado' }))
                    .catch(err => res.status(500).json({ error: err.message }));
            });
        });
    });
});

app.delete('/fiados/:id', (req, res) => {
    db.run("DELETE FROM DetalleFiados WHERE fiadoId = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run("DELETE FROM Fiados WHERE id = ?", [req.params.id], (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ message: 'Fiado eliminado' });
        });
    });
});

// === ENDPOINTS DE PROVEEDORES ===

app.get('/proveedores', (req, res) => {
    db.all("SELECT * FROM Proveedores", [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.post('/proveedores', (req, res) => {
    const { nombre, contacto, productos } = req.body;
    const productosTexto = Array.isArray(productos) ? productos.join(', ') : productos;
    db.run(
        "INSERT INTO Proveedores (nombre, contacto, productos) VALUES (?, ?, ?)",
        [nombre, contacto, productosTexto],
        (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ message: 'Proveedor agregado' });
        }
    );
});

app.delete('/proveedores/:id', (req, res) => {
    db.run("DELETE FROM Proveedores WHERE id = ?", [req.params.id], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Proveedor eliminado' });
    });
});

// === ENDPOINTS DE CONFIGURACIÓN ===

app.get('/config', (req, res) => {
    db.all("SELECT clave, valor FROM Config", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const config = rows.reduce((acc, row) => {
            acc[row.clave] = row.valor;
            return acc;
        }, {});
        res.json(config);
    });
});

app.post('/config', (req, res) => {
    const { clave, valor } = req.body;
    db.get("SELECT * FROM Config WHERE clave = ?", [clave], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            db.run("UPDATE Config SET valor = ? WHERE clave = ?", [valor, clave], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: `Configuración ${clave} actualizada` });
            });
        } else {
            db.run("INSERT INTO Config (clave, valor) VALUES (?, ?)", [clave, valor], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: `Configuración ${clave} agregada` });
            });
        }
    });
});

// === ENDPOINT DE ESTADÍSTICAS ===

app.get('/estadisticas', autenticar, (req, res) => {
    db.all(`
      SELECT 
        (SELECT COUNT(*) FROM Ventas) AS total_ventas,
        (SELECT COUNT(*) FROM Fiados) AS total_fiados,
        (SELECT COUNT(*) FROM Productos) AS total_productos,
        (SELECT COUNT(*) FROM Clientes) AS total_clientes
    `, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row[0]);
    });
});

// === FUNCIONES AUXILIARES ===

function inicializarConfig() {
    const valoresPorDefecto = [
        { clave: 'businessName', valor: 'Mi Negocio' },
        { clave: 'tasaDolar', valor: '43.50' },
        { clave: 'tasaModo', valor: 'manual' },
        { clave: 'puntosMisiones', valor: '0' },
        { clave: 'misionVentasHoy', valor: '' },
        { clave: 'misionProductosHoy', valor: '' }
    ];
    valoresPorDefecto.forEach(config => {
        db.get("SELECT * FROM Config WHERE clave = ?", [config.clave], (err, row) => {
            if (!row) {
                db.run("INSERT INTO Config (clave, valor) VALUES (?, ?)", [config.clave, config.valor]);
            }
        });
    });
}

// === INICIO DEL SERVIDOR ===

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    inicializarConfig();
});    
