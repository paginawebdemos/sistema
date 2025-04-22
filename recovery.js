const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// Crear admin de emergencia si no existe ningún usuario
db.get("SELECT COUNT(*) as count FROM Usuarios", [], (err, row) => {
    if (row.count === 0) {
        const passwordHash = require('crypto')
            .createHash('sha256')
            .update('recovery123') // Contraseña temporal
            .digest('hex');
        
        db.run(
            "INSERT INTO Usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)",
            ['recovery_admin', passwordHash, 'Usuario de Recuperación', 'admin'],
            (err) => {
                if (err) console.error("Error en recuperación:", err);
                else console.log("Usuario de recuperación creado. Credenciales: recovery_admin / recovery123");
                process.exit();
            }
        );
    } else {
        console.log("Sistema tiene usuarios existentes. No se requiere recuperación.");
        process.exit();
    }
});