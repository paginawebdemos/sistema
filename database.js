 const sqlite3 = require('sqlite3').verbose();

// Conexión a la base de datos SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conexión a la base de datos establecida');
    }
});

// Ejecuta las operaciones en serie para garantizar el orden
db.serialize(() => {
    // === CREACIÓN DE TABLAS ===
    db.run(`
        CREATE TABLE IF NOT EXISTS Usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            nombre TEXT NOT NULL,
            rol TEXT NOT NULL DEFAULT 'usuario',
            ultimo_login TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Sesiones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            usuario_id INTEGER NOT NULL,
            creado TEXT DEFAULT (datetime('now')),
            expiracion TEXT NOT NULL,
            activa INTEGER DEFAULT 1,
            FOREIGN KEY (usuario_id) REFERENCES Usuarios(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Actividades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            usuario_id INTEGER,
            usuario_nombre TEXT,
            accion TEXT NOT NULL,
            detalles TEXT,
            FOREIGN KEY (usuario_id) REFERENCES Usuarios(id)
        )
    `);

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

    db.run(`
        CREATE TABLE IF NOT EXISTS Clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            telefono TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            clienteId INTEGER,
            total REAL DEFAULT 0,
            iva REAL DEFAULT 0,
            descuento REAL DEFAULT 0,
            metodo_pago TEXT DEFAULT 'Efectivo',
            origenFiado INTEGER DEFAULT 0,
            FOREIGN KEY (clienteId) REFERENCES Clientes(id)
        )
    `);

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

    db.run(`
        CREATE TABLE IF NOT EXISTS Fiados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            clienteId INTEGER,
            total REAL DEFAULT 0,
            FOREIGN KEY (clienteId) REFERENCES Clientes(id)
        )
    `);

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

    db.run(`
        CREATE TABLE IF NOT EXISTS Proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            contacto TEXT,
            productos TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS Config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clave TEXT NOT NULL UNIQUE,
            valor TEXT NOT NULL
        )
    `);

    // === INICIALIZACIÓN DE DATOS ===

    // Verifica y crea usuario admin si no existe
    db.get("SELECT * FROM Usuarios WHERE username = 'admin'", (err, row) => {
        if (err) {
            console.error('Error al verificar usuario admin:', err.message);
        } else if (!row) {
            const passwordHash = require('crypto').createHash('sha256').update('admin123').digest('hex');
            db.run(
                "INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)",
                ['admin', passwordHash, 'Administrador', 'admin'],
                (err) => {
                    if (err) {
                        console.error("Error al crear admin por defecto:", err.message);
                    } else {
                        console.log("Usuario admin creado con éxito");
                    }
                }
            );
        } else {
            console.log("Usuario admin ya existe, omitiendo creación");
        }
    });

    // Configuraciones iniciales del sistema
    const configuracionesIniciales = [
        ['businessName', 'Mi Negocio'],
        ['tasaDolar', '43.50'],
        ['tasaModo', 'manual'],
        ['puntosMisiones', '0'],
        ['misionVentasHoy', ''],
        ['misionProductosHoy', '']
    ];

    // Inserta configuraciones iniciales en serie
    configuracionesIniciales.forEach(([clave, valor]) => {
        db.run(
            "INSERT OR IGNORE INTO Config (clave, valor) VALUES (?, ?)",
            [clave, valor],
            (err) => {
                if (err) {
                    console.error(`Error al insertar ${clave}:`, err.message);
                } else {
                    console.log(`Configuración ${clave} inicializada o ya existente`);
                }
            }
        );
    });

    // === MIGRACIÓN DE ESTRUCTURA ===

    db.get("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Ventas'", (err, row) => {
        if (err) {
            console.error('Error al verificar estructura de Ventas:', err.message);
            return;
        }

        if (!row) {
            return;
        }

        const tableSql = row.sql.toLowerCase();
        
        if (!tableSql.includes('descuento')) {
            db.run("ALTER TABLE Ventas ADD COLUMN descuento REAL DEFAULT 0", (err) => {
                if (err) console.error('Error al agregar columna descuento:', err.message);
            });
        }
        
        if (!tableSql.includes('metodo_pago')) {
            db.run("ALTER TABLE Ventas ADD COLUMN metodo_pago TEXT DEFAULT 'Efectivo'", (err) => {
                if (err) console.error('Error al agregar columna metodo_pago:', err.message);
            });
        }

        if (!tableSql.includes('iva')) {
            db.run("ALTER TABLE Ventas ADD COLUMN iva REAL DEFAULT 0", (err) => {
                if (err) console.error('Error al agregar columna iva:', err.message);
            });
        }

        if (!tableSql.includes('origenfiado')) {
            db.run("ALTER TABLE Ventas ADD COLUMN origenFiado INTEGER DEFAULT 0", (err) => {
                if (err) console.error('Error al agregar columna origenFiado:', err.message);
            });
        }
    });
});

// === FUNCIONES AUXILIARES ===

// Función para verificar/crear usuario admin periódicamente
function verificarAdmin() {
    db.get("SELECT * FROM Usuarios WHERE username = 'admin'", (err, row) => {
        if (err) {
            console.error('Error al verificar usuario admin:', err.message);
        } else if (!row) {
            const passwordHash = require('crypto').createHash('sha256').update('admin123').digest('hex');
            db.run(
                "INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)",
                ['admin', passwordHash, 'Administrador', 'admin'],
                (err) => {
                    if (err) {
                        console.error("Error al crear admin por defecto:", err.message);
                    } else {
                        console.log("Usuario admin creado con éxito (verificación periódica)");
                    }
                }
            );
        }
    });
}

// Ejecuta verificación de admin cada 24 horas (86400000 ms)
setInterval(verificarAdmin, 86400000);

// Exporta la conexión a la base de datos
module.exports = db;
