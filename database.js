const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
    }
});

// Crear tablas si no existen
db.serialize(() => {
    // Tabla Productos
    db.run(`
        CREATE TABLE IF NOT EXISTS Productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precioCompraBs REAL DEFAULT 0,
            precioCompraUsd REAL DEFAULT 0,
            precioVentaBs REAL DEFAULT 0,
            precioVentaUsd REAL DEFAULT 0,
            stock INTEGER DEFAULT 0
        )
    `);

    // Tabla Clientes
    db.run(`
        CREATE TABLE IF NOT EXISTS Clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        )
    `);

    // Tabla Ventas
    db.run(`
        CREATE TABLE IF NOT EXISTS Ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            clienteId INTEGER,
            total REAL DEFAULT 0,
            FOREIGN KEY (clienteId) REFERENCES Clientes(id)
        )
    `);

    // Tabla DetalleVentas (detalles de cada venta)
    db.run(`
        CREATE TABLE IF NOT EXISTS DetalleVentas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ventaId INTEGER,
            productoId INTEGER,
            cantidad INTEGER DEFAULT 0,
            precioVentaBs REAL DEFAULT 0,
            total REAL DEFAULT 0,
            FOREIGN KEY (ventaId) REFERENCES Ventas(id),
            FOREIGN KEY (productoId) REFERENCES Productos(id)
        )
    `);

    // Tabla Fiados
    db.run(`
        CREATE TABLE IF NOT EXISTS Fiados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            clienteId INTEGER,
            total REAL DEFAULT 0,
            FOREIGN KEY (clienteId) REFERENCES Clientes(id)
        )
    `);

    // Tabla DetalleFiados (detalles de cada fiado)
    db.run(`
        CREATE TABLE IF NOT EXISTS DetalleFiados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fiadoId INTEGER,
            productoId INTEGER,
            cantidad INTEGER DEFAULT 0,
            precioVentaBs REAL DEFAULT 0,
            total REAL DEFAULT 0,
            FOREIGN KEY (fiadoId) REFERENCES Fiados(id),
            FOREIGN KEY (productoId) REFERENCES Productos(id)
        )
    `);

    // Tabla Proveedores
    db.run(`
        CREATE TABLE IF NOT EXISTS Proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            contacto TEXT,
            productos TEXT
        )
    `);

    // Tabla Config (para configuraciones generales)
    db.run(`
        CREATE TABLE IF NOT EXISTS Config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clave TEXT NOT NULL UNIQUE,
            valor TEXT NOT NULL
        )
    `);

    // Insertar configuraciones iniciales si no existen
    const configuracionesIniciales = [
        ['businessName', 'Mi Negocio'],
        ['tasaDolar', '43.50'],
        ['tasaModo', 'manual'],
        ['puntosMisiones', '0'],
        ['misionVentasHoy', ''],
        ['misionProductosHoy', '']
    ];

    configuracionesIniciales.forEach(([clave, valor]) => {
        db.get("SELECT * FROM Config WHERE clave = ?", [clave], (err, row) => {
            if (!row) {
                db.run("INSERT INTO Config (clave, valor) VALUES (?, ?)", [clave, valor], (err) => {
                    if (err) console.error(`Error al insertar ${clave}:`, err.message);
                });
            }
        });
    });
});

// Exportar la base de datos para usarla en server.js
module.exports = db;         