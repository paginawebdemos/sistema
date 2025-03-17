const express = require('express');
const db = require('./database.js');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

// Productos
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

// Clientes
app.get('/clientes', (req, res) => {
    db.all("SELECT * FROM Clientes", [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.post('/clientes', (req, res) => {
    const { nombre } = req.body;
    db.run("INSERT INTO Clientes (nombre) VALUES (?)", [nombre], (err) => {
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

// Ventas (corregido)
app.get('/ventas', (req, res) => {
    db.all(`
        SELECT v.id, v.fecha, v.total, c.nombre AS cliente, GROUP_CONCAT(dv.productoId || '|' || dv.cantidad || '|' || dv.precioVentaBs || '|' || dv.total) AS productos
        FROM Ventas v
        JOIN Clientes c ON v.clienteId = c.id
        LEFT JOIN DetalleVentas dv ON v.id = dv.ventaId
        GROUP BY v.id, v.fecha, v.total, c.nombre
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const ventas = rows.map(row => {
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
            return { ...row, productos };
        });
        Promise.all(ventas.map(venta =>
            Promise.all(venta.productos.map(p =>
                new Promise((resolve) => {
                    db.get("SELECT nombre FROM Productos WHERE id = ?", [p.productoId], (err, row) => {
                        p.nombre = row ? row.nombre : 'Desconocido';
                        resolve(p);
                    });
                })
            )).then(() => venta)
        )).then(updatedVentas => res.json(updatedVentas))
          .catch(err => res.status(500).json({ error: err.message }));
    });
});

app.post('/ventas', (req, res) => {
    const { fecha, clienteId, total, productos } = req.body;
    db.run("INSERT INTO Ventas (fecha, clienteId, total) VALUES (?, ?, ?)", [fecha, clienteId, total], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const ventaId = this.lastID;
        const inserts = productos.map(p =>
            new Promise((resolve, reject) =>
                db.run("INSERT INTO DetalleVentas (ventaId, productoId, cantidad, precioVentaBs, total) VALUES (?, ?, ?, ?, ?)",
                    [ventaId, p.id, p.cantidad, p.precioVentaBs, p.total], (err) => err ? reject(err) : resolve())
            )
        );
        Promise.all(inserts)
            .then(() => res.json({ message: 'Venta registrada' }))
            .catch(err => res.status(500).json({ error: err.message }));
    });
});

// Fiados (corregido)
app.get('/fiados', (req, res) => {
    db.all(`
        SELECT f.id, f.fecha, f.total, c.nombre AS cliente, GROUP_CONCAT(df.productoId || '|' || df.cantidad || '|' || df.precioVentaBs || '|' || df.total) AS productos
        FROM Fiados f
        JOIN Clientes c ON f.clienteId = c.id
        LEFT JOIN DetalleFiados df ON f.id = df.fiadoId
        GROUP BY f.id, f.fecha, f.total, c.nombre
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const fiados = rows.map(row => {
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
            return { ...row, productos };
        });
        Promise.all(fiados.map(fiado =>
            Promise.all(fiado.productos.map(p =>
                new Promise((resolve) => {
                    db.get("SELECT nombre FROM Productos WHERE id = ?", [p.productoId], (err, row) => {
                        p.nombre = row ? row.nombre : 'Desconocido';
                        resolve(p);
                    });
                })
            )).then(() => fiado)
        )).then(updatedFiados => res.json(updatedFiados))
          .catch(err => res.status(500).json({ error: err.message }));
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

        // Obtener productos originales para ajustar stock
        db.all("SELECT productoId, cantidad FROM DetalleFiados WHERE fiadoId = ?", [req.params.id], (err, originales) => {
            if (err) return res.status(500).json({ error: err.message });

            // Eliminar detalles antiguos
            db.run("DELETE FROM DetalleFiados WHERE fiadoId = ?", [req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Insertar nuevos detalles y ajustar stock
                const inserts = productos.map(p =>
                    new Promise((resolve, reject) => {
                        db.run("INSERT INTO DetalleFiados (fiadoId, productoId, cantidad, precioVentaBs, total) VALUES (?, ?, ?, ?, ?)",
                            [req.params.id, p.id, p.cantidad, p.precioVentaBs, p.total], (err) => {
                                if (err) return reject(err);

                                // Ajustar stock
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

// Proveedores
app.get('/proveedores', (req, res) => {
    db.all("SELECT * FROM Proveedores", [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.post('/proveedores', (req, res) => {
    const { nombre, contacto, productos } = req.body;
    db.run("INSERT INTO Proveedores (nombre, contacto, productos) VALUES (?, ?, ?)", [nombre, contacto, productos], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Proveedor agregado' });
    });
});

app.delete('/proveedores/:id', (req, res) => {
    db.run("DELETE FROM Proveedores WHERE id = ?", [req.params.id], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ message: 'Proveedor eliminado' });
    });
});

// Configuración
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

// Inicializar base de datos con valores por defecto si está vacía
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

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
    inicializarConfig();
});