const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

db.all("SELECT id, username, password, nombre, rol FROM Usuarios", [], (err, rows) => {
    if (err) {
        console.error('Error al consultar usuarios:', err);
    } else if (rows.length === 0) {
        console.log('No hay usuarios en la base de datos.');
    } else {
        console.log('Usuarios encontrados:');
        rows.forEach(row => console.log(row));
    }
    db.close();
});