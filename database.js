const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

// === Conexión a la Base de Datos ===
/**
 * Establece la conexión con la base de datos SQLite
 * @type {sqlite3.Database}
 */
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Conexión a la base de datos establecida');
    }
});

// === Configuración Inicial ===
/**
 * Ejecuta operaciones en serie para garantizar el orden de creación y configuración
 */
db.serialize(() => {
    // === Creación de Tablas ===
    const tablas = [
        // Usuarios
        `CREATE TABLE IF NOT EXISTS Usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            nombre TEXT NOT NULL,
            rol TEXT NOT NULL DEFAULT 'usuario',
            ultimo_login TEXT
        )`,

        // Sesiones
        `CREATE TABLE IF NOT EXISTS Sesiones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            usuario_id INTEGER NOT NULL,
            creado TEXT DEFAULT (datetime('now')),
            expiracion TEXT NOT NULL,
            activa INTEGER DEFAULT 1,
            FOREIGN KEY (usuario_id) REFERENCES Usuarios(id)
        )`,

        // Actividades
        `CREATE TABLE IF NOT EXISTS Actividades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            usuario_id INTEGER,
            usuario_nombre TEXT,
            accion TEXT NOT NULL,
            detalles TEXT,
            FOREIGN KEY (usuario_id) REFERENCES Usuarios(id)
        )`,

        // Productos
        `CREATE TABLE IF NOT EXISTS Productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precioCompraBs REAL DEFAULT 0,
            precioCompraUsd REAL DEFAULT 0,
            precioVentaBs REAL DEFAULT 0,
            precioVentaUsd REAL DEFAULT 0,
            stock INTEGER DEFAULT 0
        )`,

        // Clientes
        `CREATE TABLE IF NOT EXISTS Clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            telefono TEXT
        )`,

        // Ventas
        `CREATE TABLE IF NOT EXISTS Ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            clienteId INTEGER,
            total REAL DEFAULT 0,
            iva REAL DEFAULT 0,
            descuento REAL DEFAULT 0,
            metodo_pago TEXT DEFAULT 'Efectivo',
            origenFiado INTEGER DEFAULT 0,
            FOREIGN KEY (clienteId) REFERENCES Clientes(id)
        )`,

        // Detalle de Ventas
        `CREATE TABLE IF NOT EXISTS DetalleVentas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ventaId INTEGER,
            productoId INTEGER,
            cantidad INTEGER DEFAULT 0,
            precioVentaBs REAL DEFAULT 0,
            total REAL DEFAULT 0,
            FOREIGN KEY (ventaId) REFERENCES Ventas(id),
            FOREIGN KEY (productoId) REFERENCES Productos(id)
        )`,

        // Fiados
        `CREATE TABLE IF NOT EXISTS Fiados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT NOT NULL,
            clienteId INTEGER,
            total REAL DEFAULT 0,
            FOREIGN KEY (clienteId) REFERENCES Clientes(id)
        )`,

        // Detalle de Fiados
        `CREATE TABLE IF NOT EXISTS DetalleFiados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fiadoId INTEGER,
            productoId INTEGER,
            cantidad INTEGER DEFAULT 0,
            precioVentaBs REAL DEFAULT 0,
            total REAL DEFAULT 0,
            FOREIGN KEY (fiadoId) REFERENCES Fiados(id),
            FOREIGN KEY (productoId) REFERENCES Productos(id)
        )`,

        // Proveedores
        `CREATE TABLE IF NOT EXISTS Proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            contacto TEXT,
            productos TEXT
        )`,

        // Configuración
        `CREATE TABLE IF NOT EXISTS Config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clave TEXT NOT NULL UNIQUE,
            valor TEXT NOT NULL
        )`
    ];

    // Ejecuta la creación de todas las tablas
    tablas.forEach(sql => {
        db.run(sql, (err) => {
            if (err) console.error(`Error al crear tabla: ${err.message}`);
        });
    });

    // === Inicialización de Datos ===

    /**
     * Configuraciones iniciales del sistema
     * @type {Array<[string, string]>}
     */
    const configuracionesIniciales = [
        ['businessName', 'Mi Negocio'],
        ['tasaDolar', '43.50'],
        ['tasaModo', 'manual'],
        ['puntosMisiones', '0'],
        ['misionVentasHoy', ''],
        ['misionProductosHoy', '']
    ];

    // Inserta configuraciones iniciales
    configuracionesIniciales.forEach(([clave, valor]) => {
        db.run(
            `INSERT OR IGNORE INTO Config (clave, valor) VALUES (?, ?)`,
            [clave, valor],
            (err) => {
                if (err) {
                    console.error(`Error al insertar configuración ${clave}:`, err.message);
                } else {
                    console.log(`Configuración ${clave} inicializada o ya existente`);
                }
            }
        );
    });

    // Verifica y crea usuario admin si no existe
    inicializarUsuarioAdmin();

    // === Migración de Estructura ===

    /**
     * Verifica y aplica migraciones a la tabla Ventas
     */
    function aplicarMigracionesVentas() {
        db.get("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Ventas'", (err, row) => {
            if (err) {
                console.error('Error al verificar estructura de Ventas:', err.message);
                return;
            }
            if (!row) return;

            const tableSql = row.sql.toLowerCase();
            const migraciones = [
                { columna: 'descuento', sql: 'ALTER TABLE Ventas ADD COLUMN descuento REAL DEFAULT 0' },
                { columna: 'metodo_pago', sql: 'ALTER TABLE Ventas ADD COLUMN metodo_pago TEXT DEFAULT \'Efectivo\'' },
                { columna: 'iva', sql: 'ALTER TABLE Ventas ADD COLUMN iva REAL DEFAULT 0' },
                { columna: 'origenfiado', sql: 'ALTER TABLE Ventas ADD COLUMN origenFiado INTEGER DEFAULT 0' }
            ];

            migraciones.forEach(({ columna, sql }) => {
                if (!tableSql.includes(columna)) {
                    db.run(sql, (err) => {
                        if (err) console.error(`Error al agregar columna ${columna}:`, err.message);
                        else console.log(`Columna ${columna} agregada a Ventas`);
                    });
                }
            });
        });
    }

    aplicarMigracionesVentas();
});

// === Funciones Auxiliares ===

/**
 * Inicializa el usuario admin si no existe
 */
function inicializarUsuarioAdmin() {
    db.get("SELECT * FROM Usuarios WHERE username = 'admin'", (err, row) => {
        if (err) {
            console.error('Error al verificar usuario admin:', err.message);
            return;
        }
        if (!row) {
            const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');
            db.run(
                `INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)`,
                ['admin', passwordHash, 'Administrador', 'admin'],
                (err) => {
                    if (err) {
                        console.error('Error al crear admin por defecto:', err.message);
                    } else {
                        console.log('Usuario admin creado con éxito');
                    }
                }
            );
        } else {
            console.log('Usuario admin ya existe, omitiendo creación');
        }
    });
}

/**
 * Verifica periódicamente la existencia del usuario admin
 */
function verificarAdminPeriodico() {
    setInterval(() => {
        db.get("SELECT * FROM Usuarios WHERE username = 'admin'", (err, row) => {
            if (err) {
                console.error('Error al verificar usuario admin (periódico):', err.message);
                return;
            }
            if (!row) {
                const passwordHash = crypto.createHash('sha256').update('admin123').digest('hex');
                db.run(
                    `INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)`,
                    ['admin', passwordHash, 'Administrador', 'admin'],
                    (err) => {
                        if (err) {
                            console.error('Error al crear admin (periódico):', err.message);
                        } else {
                            console.log('Usuario admin creado con éxito (verificación periódica)');
                        }
                    }
                );
            }
        });
    }, 86400000); // Cada 24 horas
}

verificarAdminPeriodico();

// === Exportación ===
/**
 * Exporta la instancia de la base de datos para su uso en otros módulos
 * @type {sqlite3.Database}
 */
module.exports = db;