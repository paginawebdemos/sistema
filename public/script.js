 // Lista de frases motivadoras
const quotes = [
    "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
    "No dejes para mañana lo que puedes empezar hoy.",
    "Cada paso que das te acerca a tus sueños.",
    "El único límite es el que te pones tú mismo.",
    "Con esfuerzo y dedicación, todo es posible.",
    "Hoy es un gran día para hacer grandes cosas.",
    "La perseverancia convierte los sueños en logros.",
    "Cree en ti y el resto vendrá solo.",
    "Pequeñas victorias llevan a grandes triunfos.",
    "El trabajo duro siempre da frutos.",
    "La disciplina es el puente entre las metas y los logros.",
            "Enfócate en el progreso, no en la perfección.",
    "Cada desafío es una oportunidad para crecer.",
        "La excelencia no es un acto, sino un hábito.",
    "Tu actitud determina tu dirección.",
    "El fracaso es solo una lección, no un destino.",
    "Invierte en tu crecimiento personal y profesional.",
    "La consistencia es la clave del éxito.",
    "No esperes oportunidades, créalas.",
        "La pasión impulsa el rendimiento.",
    "Sé la mejor versión de ti mismo cada día.",
    "El conocimiento es poder, pero la acción lo hace realidad.",
    "La innovación comienza fuera de la zona de confort.",
    "El liderazgo se construye con acciones, no con palabras.",
    "La resiliencia supera cualquier obstáculo.",
    "La claridad de propósito impulsa el éxito.",
    "Trabaja en silencio, deja que el éxito hable por ti.",
    "La mentalidad de crecimiento abre puertas infinitas.",
    "La productividad es hacer más con menos estrés.",
    "El aprendizaje continuo es la base del progreso.",
    "La confianza en uno mismo atrae oportunidades.",
    "La paciencia y la persistencia siempre ganan.",
    "Sé proactivo, no reactivo.",
    "La creatividad resuelve problemas complejos.",
    "La humildad y la ambición pueden coexistir.",
    "La eficiencia es hacer las cosas bien; la efectividad es hacer las correctas.",
    "El tiempo es tu recurso más valioso, úsalo sabiamente.",
    "La adaptabilidad es esencial en un mundo cambiante.",
    "La colaboración multiplica los resultados.",
    "La integridad construye reputaciones duraderas.",
    "La visión a largo plazo supera las gratificaciones instantáneas.",
    "La autodisciplina es la base del alto rendimiento.",
    "La comunicación efectiva abre puertas.",
    "La estrategia bien ejecutada supera al talento no dirigido.",
    "La mentalidad positiva atrae soluciones.",
    "El enfoque en el cliente impulsa el crecimiento.",
    "La innovación requiere coraje y curiosidad.",
    "La planificación previa evita el desempeño pobre.",
    "La agilidad mental supera la rigidez.",
    "La excelencia operativa marca la diferencia.",
    "La responsabilidad personal genera confianza.",
    "La gestión del tiempo es gestión de la vida.",
    "La mejora continua es la vía hacia la maestría.",
    "La determinación supera a la duda.",
    "La empatía fortalece las relaciones profesionales.",
    "La toma de decisiones audaces impulsa el progreso.",
    "La simplicidad a menudo es la clave de la eficacia.",
    "El equilibrio entre vida y trabajo maximiza la productividad.",
    "La autenticidad atrae conexiones genuinas.",
    "La resiliencia convierte los fracasos en aprendizajes."
];

// Variables globales
let usuarioActual = null;
const { jsPDF } = window.jspdf;
    let inventario = [];
let clientes = [];
let ventas = [];
let fiados = [];
let proveedores = [];
let carritoVenta = [];
let carritoFiar = [];
let carritoEditarFiado = [];
let tasaDolar = 43.50;
    let tasaModo = 'manual';
const itemsPorPagina = 5;
    let paginaActualVentas = 1;
let ventasChartInstance = null;
let productosChartInstance = null;
let tokenSesion = null; // Variable en memoria para el token
let aplicarIVA = false;
const porcentajeIVA = 0.16;
let fiadoSeleccionado = null;

const sonidos = {
    click: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/10/audio_1e1e1e1e1e.mp3'] }),
    success: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/10/audio_2e2e2e2e2e.mp3'] }),
    error: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/10/audio_3e3e3e3e3e.mp3'] })
};

// Función para registrar una actividad
async function registrarActividad(accion, detalles) {
    const actividad = {
        fecha: new Date().toLocaleString(),
        usuario: usuarioActual ? usuarioActual.nombre : 'Sistema',
        accion,
        detalles
    };
    try {
        await fetchConAuth('http://localhost:3000/actividades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(actividad)
        });
    } catch (error) {
        console.error('Error al registrar actividad:', error);
    }
}

// Función para mostrar una frase basada en el día del mes
function displayDailyQuote() {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const quoteIndex = (dayOfMonth - 1) % quotes.length;
    document.getElementById('dailyQuote').textContent = quotes[quoteIndex];
}

// Función para mostrar/ocultar login
function toggleLogin(mostrar) {
    document.getElementById('login-screen').style.display = mostrar ? 'flex' : 'none';
    document.getElementById('sistema').style.display = mostrar ? 'none' : 'flex';
}

// Función de login modificada
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) throw new Error('Credenciales incorrectas');

        const data = await response.json();
        tokenSesion = data.token; // Guardar token en memoria
        usuarioActual = data;

        toggleLogin(false);
        notificar(`Bienvenido ${data.nombre}`, 'success');

        if (data.rol !== 'admin') {
            document.getElementById('nav-actividades').style.display = 'none';
        }
        await cargarDatosIniciales();
        actualizarTodo();

        registrarActividad('Inicio de Sesión', `Usuario: ${data.nombre}`);
    } catch (error) {
        notificar(error.message, 'error');
    }
}

// Función para cargar actividades
async function cargarActividades() {
    try {
        const response = await fetchConAuth('/actividades');
        if (!response.ok) throw new Error('Error al cargar actividades');
        
        const actividades = await response.json();
        
        document.getElementById('tablaActividades').innerHTML = actividades.map(a => `
            <tr>
                <td class="border p-2">${new Date(a.fecha).toLocaleString()}</td>
                <td class="border p-2">${a.usuario || 'Sistema'}</td>
                <td class="border p-2">${a.accion}</td>
                <td class="border p-2">
                    ${a.detalles || ''}
                    ${a.accion.includes('sesión') ? `<span class="text-xs text-gray-500">${a.fecha}</span>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        notificar(error.message, 'error');
    }
}

// Cargar datos del usuario actual
async function cargarUsuarioActual() {
    try {
        const response = await fetchConAuth('/usuario/actual');
        if (!response.ok) throw new Error('Error al cargar usuario');
        
        const usuario = await response.json();
        
        // Llenar formulario
        document.getElementById('usuario-nombre').value = usuario.nombre;
        document.getElementById('usuario-username').value = usuario.username;
        
        // Mostrar sección admin si corresponde
        if (usuario.rol === 'admin') {
            document.getElementById('admin-users-section').classList.remove('hidden');
            cargarListaUsuarios();
        }
    } catch (error) {
        notificar(error.message, 'error');
    }
}
    
// Actualizar usuario actual
async function actualizarUsuario() {
    const nombre = document.getElementById('usuario-nombre').value;
    const username = document.getElementById('usuario-username').value;
    const password = document.getElementById('usuario-password').value;
    
    try {
        const response = await fetchConAuth('/usuario/actual', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, username, password })
        });
        
        if (!response.ok) throw new Error('Error al actualizar usuario');
        
        notificar('Datos actualizados correctamente', 'success');
        document.getElementById('usuario-password').value = '';
    } catch (error) {
        notificar(error.message, 'error');
    }
}

// Cargar lista de usuarios (para admin)
async function cargarListaUsuarios() {
    try {
        const response = await fetchConAuth('/usuarios');
        if (!response.ok) throw new Error('Error al cargar usuarios');
        
        const usuarios = await response.json();
        
        document.getElementById('tablaUsuarios').innerHTML = usuarios.map(u => `
            <tr>
                <td class="p-2">${u.nombre}</td>
                <td class="p-2">${u.username}</td>
                <td class="p-2">${u.rol}</td>
                <td class="p-2">${u.ultimo_login || 'Nunca'}</td>
                <td class="p-2">
                    <button onclick="eliminarUsuario(${u.id})" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs">
                        Eliminar
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        notificar(error.message, 'error');
    }
}

// Crear nuevo usuario (para admin)
async function crearUsuario() {
    const nombre = document.getElementById('nuevo-usuario-nombre').value;
    const username = document.getElementById('nuevo-usuario-username').value;
    const password = document.getElementById('nuevo-usuario-password').value;
    const rol = document.getElementById('nuevo-usuario-rol').value;
    
    try {
        const response = await fetchConAuth('/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, username, password, rol })
        });
        
        if (!response.ok) throw new Error('Error al crear usuario');
        
        notificar('Usuario creado correctamente', 'success');
        cerrarModal('modalNuevoUsuario');
        cargarListaUsuarios();
        
        // Limpiar formulario
        document.getElementById('nuevo-usuario-nombre').value = '';
        document.getElementById('nuevo-usuario-username').value = '';
        document.getElementById('nuevo-usuario-password').value = '';
    } catch (error) {
        notificar(error.message, 'error');
    }
}

// Eliminar usuario (para admin)
async function eliminarUsuario(id) {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    
    try {
        const response = await fetchConAuth(`/usuarios/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Error al eliminar usuario');
        
        notificar('Usuario eliminado', 'success');
        cargarListaUsuarios();
    } catch (error) {
        notificar(error.message, 'error');
    }
}

// Modificar la función mostrarSeccion para cargar datos de usuario cuando se vea Configuración
function mostrarSeccion(seccionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
        section.classList.remove('fade-in');
    });

    const seccion = document.getElementById(seccionId);
    if (seccion) {
        seccion.classList.remove('hidden');
        // Pequeño retraso para permitir la renderización antes de la animación
        setTimeout(() => {
            seccion.classList.add('fade-in');
        }, 10);
    }

    document.querySelectorAll('.sidebar button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`nav-${seccionId}`).classList.add('active');
    sonidos.click.play();

    if (seccionId === 'ventas') actualizarSelectProductos('productosVenta');
    if (seccionId === 'fiar') actualizarSelectProductos('productosFiar');
    if (seccionId === 'reportes') generarReporteVentas();
    if (seccionId === 'dashboard') actualizarDashboard();
    if (seccionId === 'proveedores') actualizarProveedores();
    if (seccionId === 'actividades') cargarActividades();
    if (seccionId === 'config') {
        cargarUsuarioActual();
    }
}

// Al cargar la página
window.addEventListener('load', () => {
    displayDailyQuote();
    if (!tokenSesion) {
        toggleLogin(true);
    } else {
        fetchConAuth('/usuario/actual')
            .then(response => {
                if (!response.ok) {
                    toggleLogin(true);
                } else {
                    toggleLogin(false);
                    cargarDatosIniciales().then(() => {
                        actualizarTodo();
                        setTimeout(() => {
                            document.getElementById('welcome-screen').style.display = 'none';
                        }, 3000);
                    });
                }
            });
    }
});

// Función fetchConAuth modificada para usar tokenSesion
function fetchConAuth(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': tokenSesion,
            'Content-Type': 'application/json'
        }
    });
}

async function cargarDatosIniciales() {
    try {
        const [inventarioRes, clientesRes, ventasRes, fiadosRes, proveedoresRes, configRes] = await Promise.all([
            fetchConAuth('http://localhost:3000/productos'),
            fetchConAuth('http://localhost:3000/clientes'),
            fetchConAuth('http://localhost:3000/ventas'),
            fetchConAuth('http://localhost:3000/fiados'),
            fetchConAuth('http://localhost:3000/proveedores'),
            fetchConAuth('http://localhost:3000/config')
        ]);
        inventario = await inventarioRes.json();
        clientes = await clientesRes.json();
        ventas = await ventasRes.json();
        fiados = await fiadosRes.json();
        proveedores = await proveedoresRes.json();
        const config = await configRes.json();
        tasaDolar = parseFloat(config.tasaDolar) || 43.50;
        tasaModo = config.tasaModo || 'manual';
        document.getElementById('businessName').textContent = config.businessName || 'Mi Negocio';
        actualizarTasaDolar();
        actualizarProveedores();
    } catch (error) {
        notificar('Error al cargar datos iniciales', 'error');
        console.error(error);
    }
}

function abrirModal(id) {
    document.getElementById(id).classList.remove('hidden');
    sonidos.click.play();
}

function cerrarModal(id) {
    document.getElementById(id).classList.add('hidden');
    sonidos.click.play();
}

function notificar(mensaje, tipo) {
    Toastify({
        text: mensaje,
        duration: 3000,
        style: { background: tipo === 'success' ? '#22c55e' : '#ef4444' }
    }).showToast();
    sonidos[tipo === 'success' ? 'success' : 'error'].play();
}

function actualizarTodo() {
    actualizarInventario();
    actualizarClientes();
    actualizarFiados();
    actualizarDashboard();
    actualizarProveedores();
}

async function actualizarTasaDolar() {
    if (tasaModo === 'automatico') {
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await response.json();
            tasaDolar = data.rates.VES || 43.50;
            await fetchConAuth('http://localhost:3000/config', {
                method: 'POST',
                body: JSON.stringify({ clave: 'tasaDolar', valor: tasaDolar.toString() })
            });
            notificar('Tasa del dólar actualizada automáticamente', 'success');
            registrarActividad('Actualización Automática de Tasa', `Nueva tasa: ${tasaDolar.toFixed(2)} Bs/USD`);
        } catch (error) {
            notificar('Error al actualizar la tasa automática, usando valor anterior', 'error');
            console.error('Error en actualizarTasaDolar:', error);
            return;
        }
    }
    document.getElementById('tasaDolar').innerHTML = `${tasaDolar.toFixed(2)} Bs/USD <span id="tasaModo" class="text-sm">(${tasaModo})</span>`;
    actualizarPreciosVenta();
    actualizarCarrito('detalleVenta', carritoVenta, 'totalBsVenta', 'totalUsdVenta');
    actualizarCarrito('detalleFiar', carritoFiar, 'totalBsFiar', 'totalUsdFiar');
    actualizarFiados();
    setTimeout(actualizarTasaDolar, 300000);
}

function actualizarDashboard() {
    const hoy = new Date();
    const hoyStr = hoy.toLocaleDateString();
    const ayer = new Date(Date.now() - 86400000);
    const ayerStr = ayer.toLocaleDateString();

    const ventasHoy = ventas.filter(v => {
        const [fechaParte] = v.fecha.split(',');
        return fechaParte.trim() === hoyStr;
    }).reduce((a, b) => a + b.total, 0);

    const ventasAyer = ventas.filter(v => {
        const [fechaParte] = v.fecha.split(',');
        return fechaParte.trim() === ayerStr;
    }).reduce((a, b) => a + b.total, 0);

    const rendimiento = ventasAyer > 0 ? ((ventasHoy - ventasAyer) / ventasAyer * 100).toFixed(1) : 0;
    const stockBajo = inventario.filter(p => p.stock < 5).length;
    const fiadosPendientes = fiados.length;

    document.getElementById('ventasHoy').textContent = ventasHoy.toFixed(2) + ' Bs';
    document.getElementById('stockBajo').textContent = stockBajo;
    document.getElementById('totalClientes').textContent = clientes.length;
    document.getElementById('fiadosPendientes').textContent = fiadosPendientes;
    document.getElementById('rendimiento').textContent = `${rendimiento > 0 ? '+' : ''}${rendimiento}% vs ayer`;

    generarGraficoVentas();
    if (stockBajo > 0) notificar(`¡Alerta! ${stockBajo} productos con stock bajo`, 'error');
    if (fiadosPendientes > 0) notificar(`Tienes ${fiadosPendientes} fiados pendientes`, 'warning');
}


function actualizarInventario() {
    filtrarInventario();
    actualizarSelectProductos('productosVenta');
    actualizarSelectProductos('productosFiar');
}

function filtrarInventario() {
    const busqueda = document.getElementById('buscarInventario').value.toLowerCase();
    const inventarioFiltrado = inventario.filter(p =>
        p.nombre.toLowerCase().includes(busqueda) || busqueda === ''
    );

    document.getElementById('tablaInventario').innerHTML = inventarioFiltrado.map(p => `
        <tr class="${p.stock < 5 ? 'producto-bajo-stock' : ''}">
            <td class="border p-2">${p.nombre}</td>
            <td class="border p-2">${p.precioCompraBs.toFixed(2)}</td>
            <td class="border p-2">${p.precioCompraUsd.toFixed(2)}</td>
            <td class="border p-2">${p.precioVentaBs.toFixed(2)}</td>
            <td class="border p-2">${p.precioVentaUsd.toFixed(2)}</td>
            <td class="border p-2">${p.stock}</td>
            <td class="border p-2">
                <button onclick="editarProducto(${p.id})" class="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2">Editar</button>
                <button onclick="eliminarProducto(${p.id})" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function filtrarProductos(selectId) {
    const busqueda = document.getElementById(`buscarProducto${selectId === 'productosVenta' ? 'Venta' : 'Fiar'}`).value.toLowerCase();
    const select = document.getElementById(selectId);
    select.innerHTML = inventario
        .filter(p => p.nombre.toLowerCase().includes(busqueda))
        .map(p => `<option value="${p.id}">${p.nombre} - ${p.precioVentaBs.toFixed(2)} Bs</option>`).join('');
}

// Limpiar campos después de agregar producto
function agregarProductoVenta() {
    const select = document.getElementById('productosVenta');
    const producto = inventario.find(p => p.id === parseInt(select.value));
    const cantidadInput = document.getElementById('cantidadVenta');
    const cantidad = parseInt(cantidadInput.value);

    // Validar cantidad
    if (cantidad <= 0 || isNaN(cantidad)) {
        notificar('Ingrese una cantidad válida (mayor a 0)', 'error');
        cantidadInput.focus();
        return;
    }

    if (cantidad > producto.stock) {
        notificar('No hay suficiente stock', 'error');
        return;
    }

    // Agregar al carrito
    carritoVenta.push({ 
        ...producto, 
        cantidad, 
        total: cantidad * producto.precioVentaBs 
    });
    actualizarCarrito('detalleVenta', carritoVenta, 'totalBsVenta', 'totalUsdVenta');

    // Limpiar campos (dejar cantidad vacío para mostrar placeholder)
    document.getElementById('buscarProductoVenta').value = '';
    cantidadInput.value = ''; // ← Vacío para mostrar "Cantidad"
    select.innerHTML = '';
    actualizarSelectProductos('productosVenta');

    notificar('Producto agregado al carrito', 'success');
}

async function finalizarVenta() {
    let nombreCliente = document.getElementById('nombreClienteVenta').value.trim() || 'Anónimo';
    const telefonoCliente = document.getElementById('telefonoClienteVenta').value.trim() || '';

    if (carritoVenta.length === 0) {
        notificar('Agregue al menos un producto', 'error');
        return;
    }

    let clienteId = null;
    
    // Gestión del cliente (existente o nuevo)
    if (nombreCliente !== 'Anónimo') {
        const clienteExistente = clientes.find(c => c.nombre === nombreCliente);
        
        if (clienteExistente) {
                clienteId = clienteExistente.id;
        } else {
            try {
                const response = await fetchConAuth('http://localhost:3000/clientes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nombre: nombreCliente,
                        telefono: telefonoCliente,
                        _log: {
                            accion: 'Agregar Cliente',
                            detalles: `Cliente: ${nombreCliente}`
                        }
                    })
                });
                
                if (!response.ok) throw new Error('Error al crear cliente');
                
                // Actualizar lista de clientes
                const clientesResponse = await fetchConAuth('http://localhost:3000/clientes');
                clientes = await clientesResponse.json();
                
                const nuevoCliente = clientes.find(c => c.nombre === nombreCliente);
                clienteId = nuevoCliente?.id || null;
            } catch (error) {
                console.error('Error al crear cliente:', error);
                notificar('Error al registrar cliente, la venta será anónima', 'warning');
                nombreCliente = 'Anónimo';
            }
        }
    }

    // Manejo de cliente anónimo
    if (nombreCliente === 'Anónimo') {
        const clienteAnonimo = clientes.find(c => c.nombre === 'Anónimo');
        clienteId = clienteAnonimo?.id || null;
    }

// Cálculo de totales (corregido)
const subtotal = carritoVenta.reduce((a, b) => a + b.total, 0); // 282.36
const descuentoPorcentaje = parseFloat(document.getElementById('descuentoInput').value) || 0;
const descuento = subtotal * (descuentoPorcentaje / 100); // 141.18
const montoConDescuento = subtotal - descuento; // 141.18
const iva = aplicarIVA ? calcularIVA(montoConDescuento) : 0; // 16% de 141.18 = 22.59
const totalConIVA = montoConDescuento + iva; // 141.18 + 22.59 = 163.77

// Preparamos los productos para enviar
const productosParaEnviar = carritoVenta.map(p => ({
    id: p.id,
    nombre: p.nombre,
    cantidad: p.cantidad,
    precioVentaBs: p.precioVentaBs,
    total: p.total
}));

// Preparar datos de la venta
const ventaData = {
    fecha: new Date().toLocaleString(),
    clienteId: clienteId,
            cliente: nombreCliente,
    total: totalConIVA, // Usar el total correcto
    iva: iva,
    descuento: descuento,
    metodo_pago: document.getElementById('metodoPagoSelect').value,
    productos: productosParaEnviar,
    _log: {
        accion: 'Finalizar Venta',
        detalles: `Cliente: ${nombreCliente}, Total: ${totalConIVA.toFixed(2)} Bs`
    }
};

    try {
        // Registrar la venta
        const response = await fetchConAuth('http://localhost:3000/ventas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ventaData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al registrar venta');
        }

        // Actualizar stock de productos
        await Promise.all(carritoVenta.map(async p => {
            const producto = inventario.find(i => i.id === p.id);
            if (producto) {
                producto.stock -= p.cantidad;
                await fetchConAuth(`http://localhost:3000/productos/${p.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(producto)
                });
            }
        }));

// Actualizar datos locales
const [ventasResponse, inventarioResponse, clientesResponse] = await Promise.all([
    fetchConAuth('http://localhost:3000/ventas'),
    fetchConAuth('http://localhost:3000/productos'),
    fetchConAuth('http://localhost:3000/clientes')
]);

ventas = await ventasResponse.json();
inventario = await inventarioResponse.json();
clientes = await clientesResponse.json();

// Limpiar el formulario y reiniciar IVA
carritoVenta = [];
document.getElementById('nombreClienteVenta').value = '';
document.getElementById('telefonoClienteVenta').value = '';
document.getElementById('buscarProductoVenta').value = '';

const cantidadInput = document.getElementById('cantidadVenta');
cantidadInput.value = '';
cantidadInput.placeholder = 'Cantidad';

// Reiniciar IVA completamente
aplicarIVA = false; // Ahora funciona porque es 'let'
const toggleIVA = document.getElementById('toggleIVA');
toggleIVA.checked = false; // Desactivar el toggle en la interfaz
document.getElementById('ivaInfo').classList.add('hidden'); // Ocultar la información del IVA
document.getElementById('ivaAmount').textContent = '0.00'; // Reiniciar el monto mostrado

document.getElementById('descuentoInput').value = '0';
document.getElementById('metodoPagoSelect').value = 'Efectivo';

actualizarCarrito('detalleVenta', carritoVenta, 'totalBsVenta', 'totalUsdVenta');

notificar('Venta registrada correctamente', 'success');
} catch (error) {
console.error('Error en finalizarVenta:', error);
notificar('Error al registrar venta: ' + error.message, 'error');
}
}

// Función auxiliar para calcular el IVA (16%)
function calcularIVA(monto) {
    return monto * 0.16;
}

function actualizarCarrito(idTabla, carrito, idTotalBs, idTotalUsd) {
    if (idTabla === 'detalleVenta') {
        document.getElementById(idTabla).innerHTML = carrito.map((p, i) => `
            <tr>
                <td class="border p-2">${p.nombre}</td>
                <td class="border p-2">${p.cantidad}</td>
                <td class="border p-2">
                    ${p.precioVentaBs.toFixed(2)} Bs<br>
                    ${(p.precioVentaBs / tasaDolar).toFixed(2)} USD
                </td>
                <td class="border p-2">${p.total.toFixed(2)}</td>
                <td class="border p-2">
                    <button onclick="editarProductoCarrito('Venta', ${i})" class="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2">Editar</button>
                    <button onclick="eliminarProductoCarrito('Venta', ${i})" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Eliminar</button>
                </td>
            </tr>
        `).join('');
    
        actualizarTotalesConIVA();
    

        const totalBs = carrito.reduce((a, b) => a + b.total, 0);
        document.getElementById(idTotalBs).textContent = totalBs.toFixed(2);
        document.getElementById(idTotalUsd).textContent = (totalBs / tasaDolar).toFixed(2);
    } else if (idTabla === 'detalleFiar') {
        document.getElementById(idTabla).innerHTML = carrito.map((p, i) => `
            <tr>
                <td class="border p-2">${p.nombre}</td>
                <td class="border p-2">${p.cantidad}</td>
                <td class="border p-2">
                    <button onclick="editarProductoCarrito('Fiar', ${i})" class="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2">Editar</button>
                    <button onclick="eliminarProductoCarrito('Fiar', ${i})" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Eliminar</button>
                </td>
            </tr>
        `).join('');
    }
}

function editarProducto(id) {
    const producto = inventario.find(p => p.id === id);
    document.getElementById('editProductoIndex').value = id;
    document.getElementById('editNombreProducto').value = producto.nombre;
    document.getElementById('editPrecioCompraBs').value = producto.precioCompraBs;
    document.getElementById('editPrecioCompraUsd').value = producto.precioCompraUsd;
    document.getElementById('editPrecioVentaUsd').value = producto.precioVentaUsd;
    document.getElementById('editPrecioVentaBs').value = producto.precioVentaBs;
    document.getElementById('editStockProducto').value = producto.stock;
    abrirModal('modalEditarProducto');
}

async function eliminarProducto(id) {
    const producto = inventario.find(p => p.id == id);
    const response = await fetchConAuth(`http://localhost:3000/productos/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
            _log: {
                accion: 'Eliminar Producto',
                detalles: `Producto: ${producto.nombre}`
            }
        })
    });
    if (response.ok) {
        inventario = inventario.filter(p => p.id != id);
        actualizarInventario();
        notificar('Producto eliminado', 'success');
    } else {
        notificar('Error al eliminar producto', 'error');
    }
}

function actualizarSelectProductos(id) {
    document.getElementById(id).innerHTML = inventario.map(p =>
        `<option value="${p.id}">${p.nombre} (Stock: ${p.stock}, Precio: ${p.precioVentaBs.toFixed(2)} Bs)</option>`
    ).join('');
}

function generarReporteVentas() {
    const nombreCliente = document.getElementById('buscarVenta').value;
    const fechaFiltro = document.getElementById('filtroFecha').value;
    const tipoReporte = document.getElementById('tipoReporte').value;

    // Determinar tipo de venta a filtrar
    let tipoVenta = '';
    if (tipoReporte === 'fiados') {
        tipoVenta = 'fiados';
    } else if (tipoReporte === 'directas') {
        tipoVenta = 'directas';
    }
    
    // Construir URL con parámetros de filtro
    let url = '/ventas?';
    const params = new URLSearchParams();
    
    if (nombreCliente) params.append('cliente', nombreCliente);
    if (fechaFiltro) params.append('fecha', fechaFiltro);
    if (tipoVenta) params.append('tipo', tipoVenta);
    
    url += params.toString();

    fetchConAuth(`/ventas?cliente=${nombreCliente}&fecha=${fechaFiltro}&tipo=${tipoReporte}`)
        .then(response => response.json())
        .then(ventas => {
            // Actualizar la tabla sin USD
            document.getElementById('reporteVentasBody').innerHTML = ventas.map(v => `
                    <tr>
                    <td class="border p-2">${v.fecha}</td>
                    <td class="border p-2">${v.cliente || 'Sin cliente'}</td>
                    <td class="border p-2 ${v.origenFiado ? 'text-purple-600 font-semibold' : 'text-blue-600'}">
                        ${v.origenFiado ? 'Fiado Pagado' : 'Venta Directa'}
                    </td>
                    <td class="border p-2 text-right">${v.total.toFixed(2)}</td> <!-- Solo Bs -->
                    <td class="border p-2 text-center">
                        <button onclick="verVenta(${v.id})" class="px-2 py-1 bg-teal-500 text-white hover:bg-teal-600">Ver</button>
                    </td>
                </tr>
            `).join('');

           // Actualizar total general (solo Bs)
           const totalBs = ventas.reduce((sum, v) => sum + v.total, 0);
           document.getElementById('totalBsReporte').textContent = totalBs.toFixed(2);
        })
        .catch(error => {
            console.error('Error al generar reporte:', error);
            notificar('Error al cargar ventas', 'error');
        });
}
async function verVenta(id) {
    const venta = ventas.find(v => v.id === id);
    document.getElementById('detalleVerVenta').innerHTML = `
        <p><strong>Fecha:</strong> ${venta.fecha}</p>
        <p><strong>Cliente:</strong> ${venta.cliente}</p>
        <div class="scrollable-table-container">
            <table class="w-full border-collapse holo">
                <thead>
                    <tr class="bg-gray-700">
                        <th class="border p-2">Producto</th>
                        <th class="border p-2">Cantidad</th>
                        <th class="border p-2">Precio (Bs)</th>
                        <th class="border p-2">Total (Bs)</th>
                    </tr>
                </thead>
                <tbody>
                    ${venta.productos.map(p => `
                        <tr>
                            <td class="border p-2">${p.nombre}</td>
                            <td class="border p-2">${p.cantidad}</td>
                            <td class="border p-2">${p.precioVentaBs.toFixed(2)}</td>
                            <td class="border p-2">${p.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <p class="mt-2"><strong>Total:</strong> ${venta.total.toFixed(2)} Bs</p> <!-- Solo Bs -->
    `;
    abrirModal('modalVerVenta');
}

function verVenta(id) {
    const venta = ventas.find(v => v.id === id);
    document.getElementById('detalleVerVenta').innerHTML = `
        <p><strong>Fecha:</strong> ${venta.fecha}</p>
        <p><strong>Cliente:</strong> ${venta.cliente}</p>
        <p class="${venta.origenFiado ? 'text-purple-600 font-semibold' : 'text-blue-600'}">
            <strong>Tipo:</strong> ${venta.origenFiado ? 'Fiado Pagado' : 'Venta Directa'}
        </p>
        <div class="scrollable-table-container">
            <table class="w-full border-collapse holo">
                <thead>
                    <tr class="bg-gray-700">
                        <th class="border p-2">Producto</th>
                        <th class="border p-2">Cantidad</th>
                        <th class="border p-2">Precio (Bs)</th>
                        <th class="border p-2">Total (Bs)</th>
                    </tr>
                </thead>
                <tbody>
                    ${venta.productos.map(p => `
                        <tr>
                            <td class="border p-2">${p.nombre}</td>
                            <td class="border p-2">${p.cantidad}</td>
                            <td class="border p-2">${p.precioVentaBs.toFixed(2)}</td>
                            <td class="border p-2">${p.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <p class="mt-2"><strong>Total:</strong> ${venta.total.toFixed(2)} Bs</p> <!-- Solo Bs -->
    `;
    abrirModal('modalVerVenta');
}

function verVenta(id) {
    const venta = ventas.find(v => v.id === id);
    document.getElementById('detalleVerVenta').innerHTML = `
        <p><strong>Fecha:</strong> ${venta.fecha}</p>
        <p><strong>Cliente:</strong> ${venta.cliente}</p>
        <p class="${venta.origenFiado ? 'text-purple-600 font-semibold' : 'text-blue-600'}">
            <strong>Tipo:</strong> ${venta.tipoVenta}
        </p>
        <div class="scrollable-table-container">
            <table class="w-full border-collapse holo">
                <thead>
                    <tr class="bg-gray-700">
                        <th class="border p-2">Producto</th>
                        <th class="border p-2">Cantidad</th>
                        <th class="border p-2">Precio (Bs)</th>
                        <th class="border p-2">Total (Bs)</th>
                    </tr>
                </thead>
                <tbody>
                    ${venta.productos.map(p => `
                        <tr>
                            <td class="border p-2">${p.nombre}</td>
                            <td class="border p-2">${p.cantidad}</td>
                            <td class="border p-2">${p.precioVentaBs.toFixed(2)}</td>
                            <td class="border p-2">${p.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <p class="mt-2"><strong>Total:</strong> ${venta.total.toFixed(2)} Bs</p> <!-- Solo Bs -->
    `;
    abrirModal('modalVerVenta');
}
        
function actualizarClientes() {
    filtrarClientes();
    const datalistVenta = document.getElementById('clientesList');
    const datalistFiar = document.getElementById('clientesListFiar');
    const opciones = clientes.map(c => `<option value="${c.nombre}">`).join('');
    datalistVenta.innerHTML = opciones;
    datalistFiar.innerHTML = opciones;
}

function filtrarClientes() {
    const busqueda = document.getElementById('buscarCliente').value.toLowerCase();
    const clientesFiltrados = clientes.filter(c => c.nombre.toLowerCase().includes(busqueda));
    document.getElementById('tablaClientes').innerHTML = clientesFiltrados.map(c => `
        <tr>
            <td class="border p-2">${c.nombre}</td>
            <td class="border p-2">${c.telefono || 'N/A'}</td>
            <td class="border p-2">
                <button onclick="verHistorialCliente(${c.id})" class="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 mr-2">Historial</button>
                <button onclick="eliminarCliente(${c.id})" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function eliminarCliente(id) {
    const cliente = clientes.find(c => c.id == id);
    const response = await fetchConAuth(`http://localhost:3000/clientes/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
            _log: {
                accion: 'Eliminar Cliente',
                detalles: `Cliente: ${cliente.nombre}`
            }
        })
    });
    if (response.ok) {
        clientes = clientes.filter(c => c.id != id);
        actualizarClientes();
        notificar('Cliente eliminado', 'success');
    } else {
        notificar('Error al eliminar cliente', 'error');
    }
}

function actualizarFiados() {
    document.getElementById('tablaFiados').innerHTML = fiados.map(f => `
        <tr>
            <td class="border p-2">${f.fecha}</td>
            <td class="border p-2">${f.cliente}</td>
            <td class="border p-2">
                <button onclick="editarFiado(${f.id})" class="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2">Editar</button>
                <button onclick="eliminarFiado(${f.id})" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 mr-2">Eliminar</button>
                <button onclick="verFiado(${f.id})" class="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 mr-2">Ver</button>
                <button onclick="console.log('Pagar fiado ${f.id}'); pagarFiado(${f.id})" class="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700">Pagar Fiado</button>
            </td>
        </tr>
    `).join('');
}

async function guardarFiado() {
    const nombreCliente = document.getElementById('nombreClienteFiar').value;
    const telefonoCliente = document.getElementById('telefonoClienteFiar').value || '';

    if (!nombreCliente) {
        notificar('Ingrese el nombre del cliente', 'error');
        return;
    }
    if (carritoFiar.length === 0) {
        notificar('Agregue al menos un producto', 'error');
        return;
    }

    let clienteId = clientes.find(c => c.nombre === nombreCliente)?.id;
    if (!clienteId) {
        const response = await fetchConAuth('http://localhost:3000/clientes', {
            method: 'POST',
            body: JSON.stringify({
                nombre: nombreCliente,
                telefono: telefonoCliente,
                _log: { accion: 'Agregar Cliente', detalles: `Cliente: ${nombreCliente}` }
            })
        });
        if (!response.ok) throw new Error('Error al crear cliente');
        clientes = await (await fetchConAuth('http://localhost:3000/clientes')).json();
        clienteId = clientes.find(c => c.nombre === nombreCliente).id;
    }

    const fiado = {
        fecha: new Date().toLocaleString(),
        clienteId,
        productos: carritoFiar.map(p => ({
            id: p.id,
            cantidad: p.cantidad,
            precioVentaBs: p.precioVentaBs,
            total: p.cantidad * p.precioVentaBs
        })),
        _log: { accion: 'Guardar Fiado', detalles: `Cliente: ${nombreCliente}, Total: ${carritoFiar.reduce((a, b) => a + b.total, 0).toFixed(2)} Bs` }
    };

    const response = await fetchConAuth('http://localhost:3000/fiados', {
        method: 'POST',
        body: JSON.stringify(fiado)
    });

    if (response.ok) {
        for (const p of carritoFiar) {
            const producto = inventario.find(i => i.id === p.id);
            producto.stock -= p.cantidad;
            await fetchConAuth(`http://localhost:3000/productos/${p.id}`, {
                method: 'PUT',
                body: JSON.stringify(producto)
            });
        }
        fiados = await (await fetchConAuth('http://localhost:3000/fiados')).json();
        inventario = await (await fetchConAuth('http://localhost:3000/productos')).json();
        carritoFiar = [];
        document.getElementById('nombreClienteFiar').value = '';
        document.getElementById('telefonoClienteFiar').value = '';
        document.getElementById('cantidadFiar').value = '';
        document.getElementById('buscarProductoFiar').value = '';
        actualizarCarrito('detalleFiar', carritoFiar, 'totalBsFiar', 'totalUsdFiar');
        actualizarFiados();
        actualizarInventario();
        actualizarClientes(); // Agregar esta línea para reflejar el cliente en la UI
        notificar('Fiado registrado', 'success');
    } else {
        notificar('Error al registrar fiado', 'error');
    }
}

function editarProductoCarrito(tipo, index) {
    console.log(`Editando producto en ${tipo}, índice: ${index}`);
    const carrito = tipo === 'Venta' ? carritoVenta : carritoFiar;
    const producto = carrito[index];
    if (!producto) {
        console.error(`Producto no encontrado en ${tipo} en índice ${index}`);
        return;
    }
    document.getElementById(`editProducto${tipo}Index`).value = index;
    document.getElementById(`editNombreProducto${tipo}`).value = producto.nombre;
    document.getElementById(`editCantidadProducto${tipo}`).value = producto.cantidad;
    abrirModal(`modalEditarProducto${tipo}`);
}

document.getElementById('formEditarProductoVenta').addEventListener('submit', (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('editProductoVentaIndex').value);
    const cantidad = parseInt(document.getElementById('editCantidadProductoVenta').value);
    const productoInventario = inventario.find(p => p.id === carritoVenta[index].id);
    if (cantidad > productoInventario.stock) {
        notificar('No hay suficiente stock', 'error');
        return;
    }
    carritoVenta[index].cantidad = cantidad;
    carritoVenta[index].total = cantidad * carritoVenta[index].precioVentaBs;
    actualizarCarrito('detalleVenta', carritoVenta, 'totalBsVenta', 'totalUsdVenta');
    cerrarModal('modalEditarProductoVenta');
    notificar('Producto editado en venta', 'success');
    registrarActividad('Editar Producto en Venta', `Producto: ${carritoVenta[index].nombre}, Nueva Cantidad: ${cantidad}`);
});

document.getElementById('formEditarProductoFiar').addEventListener('submit', (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('editProductoFiarIndex').value);
    const cantidad = parseInt(document.getElementById('editCantidadProductoFiar').value);
    const productoInventario = inventario.find(p => p.id === carritoFiar[index].id);
    if (cantidad > productoInventario.stock) {
        notificar('No hay suficiente stock', 'error');
        return;
    }
    carritoFiar[index].cantidad = cantidad;
    carritoFiar[index].total = cantidad * carritoFiar[index].precioVentaBs;
    actualizarCarrito('detalleFiar', carritoFiar, 'totalBsFiar', 'totalUsdFiar');
    cerrarModal('modalEditarProductoFiar');
    notificar('Producto editado en fiado', 'success');
    registrarActividad('Editar Producto en Fiado', `Producto: ${carritoFiar[index].nombre}, Nueva Cantidad: ${cantidad}`);
});

function eliminarProductoCarrito(tipo, index) {
    console.log(`Eliminando producto en ${tipo}, índice: ${index}`);
    const carrito = tipo === 'Venta' ? carritoVenta : carritoFiar;
    if (index >= 0 && index < carrito.length) {
        const productoEliminado = carrito[index];
        carrito.splice(index, 1);
        actualizarCarrito(tipo === 'Venta' ? 'detalleVenta' : 'detalleFiar', carrito,
            tipo === 'Venta' ? 'totalBsVenta' : 'totalBsFiar',
            tipo === 'Venta' ? 'totalUsdVenta' : 'totalUsdFiar');
        notificar(`Producto eliminado del carrito de ${tipo.toLowerCase()}`, 'success');
        registrarActividad(`Eliminar Producto de ${tipo}`, `Producto: ${productoEliminado.nombre}, Cantidad: ${productoEliminado.cantidad}`);
    } else {
        console.error(`Índice ${index} fuera de rango en ${tipo}`);
    }
}

function agregarProductoFiar() {
    const select = document.getElementById('productosFiar');
    const producto = inventario.find(p => p.id === parseInt(select.value));
    const cantidad = parseInt(document.getElementById('cantidadFiar').value);
    if (cantidad > producto.stock) {
        notificar('No hay suficiente stock', 'error');
        return;
    }
    carritoFiar.push({ ...producto, cantidad, total: cantidad * producto.precioVentaBs });
    actualizarCarrito('detalleFiar', carritoFiar, 'totalBsFiar', 'totalUsdFiar');
    notificar('Producto agregado al fiado', 'success');
    registrarActividad('Agregar Producto a Fiado', `Producto: ${producto.nombre}, Cantidad: ${cantidad}`);
}

async function agregarProductoEditarFiado() {
    const select = document.getElementById('editProductosFiado');
    const producto = inventario.find(p => p.id === parseInt(select.value));
    const cantidad = parseInt(document.getElementById('editCantidadFiado').value) || 0;

    if (cantidad <= 0) {
        notificar('Ingrese una cantidad válida', 'error');
        return;
    }

    if (cantidad > producto.stock) {
        notificar('No hay suficiente stock', 'error');
        return;
    }

    carritoEditarFiado.push({
        id: producto.id,
        nombre: producto.nombre,
        cantidad: cantidad,
        precioVentaBs: producto.precioVentaBs,
        total: cantidad * producto.precioVentaBs
    });

    producto.stock -= cantidad;
    const response = await fetchConAuth(`http://localhost:3000/productos/${producto.id}`, {
        method: 'PUT',
        body: JSON.stringify(producto)
    });

    if (response.ok) {
        inventario = await (await fetchConAuth('http://localhost:3000/productos')).json();
        actualizarInventario();
        actualizarCarritoEditarFiado();
        notificar('Producto agregado al fiado y restado del inventario', 'success');
        registrarActividad('Agregar Producto a Fiado Editado', `Producto: ${producto.nombre}, Cantidad: ${cantidad}`);
        document.getElementById('editCantidadFiado').value = '';
    } else {
        producto.stock += cantidad;
        carritoEditarFiado.pop();
        notificar('Error al actualizar el inventario', 'error');
    }
}

function editarFiado(id) {
    const fiado = fiados.find(f => f.id === id);
    document.getElementById('editFiadoIndex').value = id;
    document.getElementById('editClienteFiado').value = fiado.cliente;
    carritoEditarFiado = fiado.productos.map(p => ({
        id: p.productoId || p.id,
        nombre: p.nombre,
        cantidad: p.cantidad,
        precioVentaBs: p.precioVentaBs,
        total: p.total
    }));
    actualizarSelectProductos('editProductosFiado');
    actualizarCarritoEditarFiado();
    abrirModal('modalEditarFiado');
}

function actualizarCarritoEditarFiado() {
    document.getElementById('detalleEditarFiado').innerHTML = carritoEditarFiado.map((p, i) => `
        <tr>
            <td class="border p-2">${p.nombre}</td>
            <td class="border p-2">
                <input type="number" id="editCant_${i}" value="${p.cantidad}" class="w-full p-1 border rounded" onchange="actualizarCantidadEditarFiado(${i}, this.value)">
            </td>
            <td class="border p-2">
                <button onclick="eliminarProductoCarritoEditarFiado(${i})" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function actualizarCantidadEditarFiado(index, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad) || 0;
    const productoInventario = inventario.find(p => p.id === carritoEditarFiado[index].id);
    const diferencia = cantidad - carritoEditarFiado[index].cantidad;

    if (diferencia > productoInventario.stock) {
        notificar('No hay suficiente stock', 'error');
        document.getElementById(`editCant_${index}`).value = carritoEditarFiado[index].cantidad;
        return;
    }

    carritoEditarFiado[index].cantidad = cantidad;
    carritoEditarFiado[index].total = cantidad * carritoEditarFiado[index].precioVentaBs;
    actualizarCarritoEditarFiado();
    registrarActividad('Editar Cantidad en Fiado', `Producto: ${carritoEditarFiado[index].nombre}, Nueva Cantidad: ${cantidad}`);
}

function eliminarProductoCarritoEditarFiado(index) {
    const productoEliminado = carritoEditarFiado[index];
    carritoEditarFiado.splice(index, 1);
    actualizarCarritoEditarFiado();
    registrarActividad('Eliminar Producto de Fiado Editado', `Producto: ${productoEliminado.nombre}, Cantidad: ${productoEliminado.cantidad}`);
}

document.getElementById('formEditarFiado').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('editFiadoIndex').value);
    const clienteNombre = document.getElementById('editClienteFiado').value;
    let clienteId = clientes.find(c => c.nombre === clienteNombre)?.id;
    if (!clienteId) {
        await fetchConAuth('http://localhost:3000/clientes', {
            method: 'POST',
            body: JSON.stringify({
                nombre: clienteNombre,
                _log: {
                    accion: 'Agregar Cliente',
                    detalles: `Cliente: ${clienteNombre}`
                }
            })
        });
        clientes = await (await fetchConAuth('http://localhost:3000/clientes')).json();
        clienteId = clientes.find(c => c.nombre === clienteNombre).id;
    }
    const totalFiado = carritoEditarFiado.reduce((a, b) => a + b.total, 0);
    const fiado = {
        fecha: fiados.find(f => f.id === id).fecha,
        clienteId,
        total: totalFiado,
        productos: carritoEditarFiado.map(p => ({
            id: p.id,
            cantidad: p.cantidad,
            precioVentaBs: p.precioVentaBs,
            total: p.total
        })),
        _log: {
            accion: 'Editar Fiado',
            detalles: `Cliente: ${clienteNombre}, Total: ${totalFiado.toFixed(2)} Bs`
        }
    };
    const response = await fetchConAuth(`http://localhost:3000/fiados/${id}`, {
        method: 'PUT',
        body: JSON.stringify(fiado)
    });
    if (response.ok) {
        fiados = await (await fetchConAuth('http://localhost:3000/fiados')).json();
        inventario = await (await fetchConAuth('http://localhost:3000/productos')).json();
        actualizarFiados();
        actualizarInventario();
        cerrarModal('modalEditarFiado');
        notificar('Fiado editado', 'success');
        carritoEditarFiado = [];
    } else {
        notificar('Error al editar fiado', 'error');
    }
});

async function eliminarFiado(id) {
    const fiado = fiados.find(f => f.id == id);
    const response = await fetchConAuth(`http://localhost:3000/fiados/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
            _log: {
                accion: 'Eliminar Fiado',
                detalles: `Cliente: ${fiado.cliente}, Total: ${fiado.total.toFixed(2)} Bs`
            }
        })
    });
    if (response.ok) {
        fiados = await (await fetchConAuth('http://localhost:3000/fiados')).json();
        actualizarFiados();
        actualizarInventario();
        notificar('Fiado eliminado', 'success');
    } else {
        notificar('Error al eliminar fiado', 'error');
    }
}

function verFiado(id) {
    const fiado = fiados.find(f => f.id === id);
    const cliente = fiado.cliente;
    const fiadosCliente = fiados.filter(f => f.cliente === cliente);
    let detalle = '';
    fiadosCliente.forEach(f => {
        f.productos.forEach(p => {
            detalle += `
                <tr>
                    <td class="border p-2">${p.nombre}</td>
                    <td class="border p-2">${p.cantidad}</td>
                </tr>
            `;
        });
    });
    document.getElementById('detalleVerFiado').innerHTML = `
        <p><strong>Cliente:</strong> ${cliente}</p>
        <div class="scrollable-table-container">
            <table class="w-full border-collapse holo rounded-lg">
                <thead><tr class="bg-gray-700"><th class="border p-2">Producto</th><th class="border p-2">Cantidad</th></tr></thead>
                <tbody>${detalle}</tbody>
            </table>
        </div>
    `;
    abrirModal('modalVerFiado');
}


// Esta función solo abre el modal ahora
function pagarFiado(id) {
    fiadoSeleccionado = fiados.find(f => f.id === id);
    if (fiadoSeleccionado) {
        abrirModal('modalPagarFiado');
    }
}

// Nueva función para confirmar el pago (usa tu lógica original pero con método de pago)
async function confirmarPagoFiado() {
    if (!fiadoSeleccionado) return;
    
    const metodoPago = document.getElementById('metodoPagoFiado').value;
    
    try {
        const clienteNombre = fiadoSeleccionado.cliente;
        const clienteTelefono = fiadoSeleccionado.telefono || '';
        let cliente = clientes.find(c => c.nombre === clienteNombre);

        if (!cliente) {
            const response = await fetchConAuth('http://localhost:3000/clientes', {
                method: 'POST',
                body: JSON.stringify({
                    nombre: clienteNombre,
                    telefono: clienteTelefono,
                    _log: { accion: 'Agregar Cliente', detalles: `Cliente: ${clienteNombre}` }
                })
            });
            if (!response.ok) throw new Error('Error al registrar cliente');
            clientes = await (await fetchConAuth('http://localhost:3000/clientes')).json();
            cliente = clientes.find(c => c.nombre === clienteNombre);
        }

        const venta = {
            fecha: new Date().toLocaleString(),
            clienteId: cliente.id,
            total: fiadoSeleccionado.productos.reduce((a, b) => a + b.total, 0),
            metodo_pago: metodoPago, // <- Aquí agregamos el método de pago seleccionado
            origenFiado: 1,
            productos: fiadoSeleccionado.productos.map(p => ({
                id: p.id,
                nombre: p.nombre,
                cantidad: p.cantidad,
                precioVentaBs: p.precioVentaBs,
                total: p.total
            })),
            _log: { 
                accion: 'Pagar Fiado', 
                detalles: `Fiado ID: ${fiadoSeleccionado.id}, Método: ${metodoPago}` 
            }
        };
        
        const ventaResponse = await fetchConAuth('http://localhost:3000/ventas', {
            method: 'POST',
            body: JSON.stringify(venta)
        });
        if (!ventaResponse.ok) throw new Error('Error al registrar venta');

        const deleteResponse = await fetchConAuth(`http://localhost:3000/fiados/${fiadoSeleccionado.id}`, {
            method: 'DELETE',
            body: JSON.stringify({
                _log: { 
                    accion: 'Eliminar Fiado', 
                    detalles: `Fiado ID: ${fiadoSeleccionado.id}, Pagado con: ${metodoPago}` 
                }
            })
        });
        if (!deleteResponse.ok) throw new Error('Error al eliminar fiado');

        // Actualizar datos locales
        ventas = await (await fetchConAuth('http://localhost:3000/ventas')).json();
        fiados = await (await fetchConAuth('http://localhost:3000/fiados')).json();

        // Actualizar vistas
        actualizarFiados();
        actualizarDashboard();
        actualizarClientes();
        
        cerrarModal('modalPagarFiado');
        notificar(`Fiado pagado con ${metodoPago}`, 'success');
        
    } catch (error) {
        console.error('Error al pagar fiado:', error);
        notificar('Error al pagar fiado: ' + error.message, 'error');
    } finally {
        fiadoSeleccionado = null;
    }
}

// Función auxiliar para actualizar reportes
function actualizarReportes() {
    if (document.getElementById('reportes') && !document.getElementById('reportes').classList.contains('hidden')) {
        generarReporteVentas();
    }
}

function filtrarVentas() {
    generarReporteVentas();
}

function limpiarFiltros() {
    document.getElementById('buscarVenta').value = '';
    document.getElementById('filtroFecha').value = '';
    document.getElementById('tipoReporte').value = 'todos';
    generarReporteVentas();
}
function agruparPorSemana(ventas) {
    const semanas = {};
    ventas.forEach(v => {
        const fecha = new Date(v.fecha.split(',')[0].split('/').reverse().join('-'));
        const inicioSemana = new Date(fecha);
        inicioSemana.setDate(fecha.getDate() - fecha.getDay());
        const key = `${inicioSemana.toLocaleDateString()}`;
        if (!semanas[key]) {
            semanas[key] = { periodo: `Semana del ${key}`, total: 0, cliente: 'Múltiples', productos: [] };
        }
        semanas[key].total += v.total;
        semanas[key].productos.push(...v.productos);
    });
    return Object.values(semanas);
}

function agruparPorMes(ventas) {
    const meses = {};
    ventas.forEach(v => {
        const fecha = new Date(v.fecha.split(',')[0].split('/').reverse().join('-'));
        const key = `${fecha.getFullYear()}-${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
        if (!meses[key]) {
            meses[key] = { periodo: `${fecha.toLocaleString('default', { month: 'long' })} ${fecha.getFullYear()}`, total: 0, cliente: 'Múltiples', productos: [] };
        }
        meses[key].total += v.total;
        meses[key].productos.push(...v.productos);
    });
    return Object.values(meses);
}



async function descargarReporteVentasPDF() {
    try {
        const busqueda = document.getElementById('buscarVenta').value.toLowerCase();
        const fechaFiltro = document.getElementById('filtroFecha').value;
        const tipoReporte = document.getElementById('tipoReporte').value;

        const response = await fetchConAuth('http://localhost:3000/ventas');
        let ventas = await response.json();

        const normalizarFechaVenta = (fechaVenta) => {
            const [fechaPart] = fechaVenta.split(',');
            const [dia, mes, anio] = fechaPart.trim().split('/');
            return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        };

        const ventasFiltradas = ventas.filter(v => {
            const coincideCliente = v.cliente?.toLowerCase().includes(busqueda) || busqueda === '';
            let coincideFecha = true;
            if (fechaFiltro) {
                const fechaVentaNormalizada = normalizarFechaVenta(v.fecha);
                coincideFecha = fechaVentaNormalizada === fechaFiltro;
            }
            return coincideCliente && coincideFecha;
        });

        if (ventasFiltradas.length === 0) {
            notificar('No hay ventas que coincidan con los filtros aplicados', 'warning');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const businessName = document.getElementById('businessName').textContent;
        const fechaGeneracion = new Date().toLocaleString();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let startY = 20;

        const checkPageBreak = (neededSpace) => {
            const pageHeight = doc.internal.pageSize.getHeight();
            if (startY + neededSpace > pageHeight - 20) {
                doc.addPage();
                startY = 20;
            }
        };

        // Encabezado del documento
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(businessName, pageWidth / 2, startY, { align: 'center' });
        startY += 10;

        doc.setFontSize(14);
        doc.text('REPORTE DETALLADO DE VENTAS', pageWidth / 2, startY, { align: 'center' });
        startY += 15;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Fecha de generación: ${fechaGeneracion}`, margin, startY);
        startY += 5;

        if (busqueda) {
            doc.text(`Cliente filtrado: ${busqueda}`, margin, startY);
            startY += 5;
        }

        if (fechaFiltro) {
            doc.text(`Fecha filtrada: ${fechaFiltro}`, margin, startY);
            startY += 5;
        }

        startY += 10;

        // Detalle de cada venta
        ventasFiltradas.forEach((venta, index) => {
            checkPageBreak(50);

            // Encabezado de venta
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(41, 128, 185);
            doc.text(`Venta #${index + 1} - ${venta.fecha}`, 105, startY, { align: 'center' });
            startY += 7;

            // Información de la venta
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            
            if (venta.origenFiado) {
                doc.setTextColor(128, 0, 128);
            } else {
                doc.setTextColor(0, 0, 255);
            }
            doc.text(`Tipo: ${venta.origenFiado ? 'Fiado Pagado' : 'Venta Directa'}`, margin, startY);
            startY += 5;
            
            doc.setTextColor(0, 0, 0);
            doc.text(`Cliente: ${venta.cliente || 'Sin cliente'}`, margin, startY);
            startY += 5;
            
            doc.text(`Método de Pago: ${venta.metodo_pago || 'No especificado'}`, margin, startY);
            startY += 5;

            if (venta.descuento > 0) {
                doc.text(`Descuento: ${venta.descuento.toFixed(2)} Bs (${(venta.descuento / venta.total * 100).toFixed(2)}%)`, margin, startY);
                startY += 5;
            }

            // Tabla de productos (solo columnas en Bs)
            const productosHeaders = [['Producto', 'Cantidad', 'P. Unit. (Bs)', 'Total (Bs)']]; // Eliminada columna USD
            const productosData = venta.productos.map(p => [
                p.nombre,
                p.cantidad,
                p.precioVentaBs.toFixed(2),
                p.total.toFixed(2) // Solo Bs
            ]);

            doc.autoTable({
                startY: startY,
                head: productosHeaders,
                body: productosData,
                margin: { left: margin, right: margin },
                styles: {
                    fontSize: 9,
                    cellPadding: 3,
                    textColor: [50, 50, 50]
                },
                headStyles: {
                    fillColor: [41, 128, 185],
                    textColor: 255,
                    fontSize: 9
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245]
                },
                didDrawPage: function(data) {
                    startY = data.cursor.y + 10;
                }
            });

            // Total de la venta (solo Bs)
            const totalVenta = venta.productos.reduce((sum, p) => sum + p.total, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(`Total Venta: ${totalVenta.toFixed(2)} Bs`, // Eliminado USD
                pageWidth - margin, startY, { align: 'right' });

            startY += 15;

            // Línea separadora
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, startY, pageWidth - margin, startY);

            startY += 10;
        });

        // Resumen general (solo Bs)
        checkPageBreak(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        const totalGeneralBs = ventasFiltradas.reduce((sum, v) => sum + v.total, 0);

        doc.setTextColor(0, 0, 0);
        doc.text(`Resumen General:`, margin, startY);
        startY += 7;

        doc.text(`Total de ventas: ${ventasFiltradas.length}`, margin, startY);
        startY += 7;

        doc.text(`Total en Bolívares: ${totalGeneralBs.toFixed(2)} Bs`, margin, startY); // Eliminado USD
        startY += 7;

        // Pie de página
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Sistema Operix - ${fechaGeneracion}`, pageWidth / 2, 290, { align: 'center' });

        // Generar nombre del archivo
        const nombreArchivo = `Reporte_Detallado_Ventas_${businessName.replace(/ /g, '_')}` +
            `${fechaFiltro ? '_' + fechaFiltro : ''}` +
            `${busqueda ? '_' + busqueda : ''}.pdf`;

        doc.save(nombreArchivo);

        notificar('Reporte detallado generado exitosamente', 'success');
        registrarActividad('Generar Reporte de Ventas PDF', `Filtro: ${busqueda || 'Ninguno'}, Fecha: ${fechaFiltro || 'Todas'}`);
    } catch (error) {
        console.error('Error al generar PDF:', error);
        notificar('Error al generar el reporte PDF: ' + error.message, 'error');
    }
}

document.getElementById('formProducto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const producto = {
        nombre: document.getElementById('nombreProducto').value || 'Sin Nombre',
        precioCompraBs: parseFloat(document.getElementById('precioCompraBs').value) || 0,
        precioCompraUsd: parseFloat(document.getElementById('precioCompraUsd').value) || 0,
        precioVentaUsd: parseFloat(document.getElementById('precioVentaUsd').value) || 0,
        precioVentaBs: parseFloat(document.getElementById('precioVentaBs').value) || 0,
        stock: parseInt(document.getElementById('stockProducto').value) || 0,
        _log: {
            accion: 'Agregar Producto',
            detalles: `Producto: ${document.getElementById('nombreProducto').value || 'Sin Nombre'}`
        }
    };
    const response = await fetchConAuth('http://localhost:3000/productos', {
        method: 'POST',
        body: JSON.stringify(producto)
    });
    if (response.ok) {
        inventario = await (await fetchConAuth('http://localhost:3000/productos')).json();
        actualizarInventario();
        cerrarModal('modalProducto');
        notificar('Producto agregado', 'success');
        e.target.reset();
    } else {
        notificar('Error al agregar producto', 'error');
    }
});

document.getElementById('precioCompraUsd').addEventListener('input', (e) => {
    const precioUsd = parseFloat(e.target.value) || 0;
    document.getElementById('precioCompraBs').value = (precioUsd * tasaDolar).toFixed(2);
});

document.getElementById('precioCompraBs').addEventListener('input', (e) => {
    const precioBs = parseFloat(e.target.value) || 0;
    document.getElementById('precioCompraUsd').value = (precioBs / tasaDolar).toFixed(2);
});

document.getElementById('precioVentaUsd').addEventListener('input', (e) => {
    const precioUsd = parseFloat(e.target.value) || 0;
    document.getElementById('precioVentaBs').value = (precioUsd * tasaDolar).toFixed(2);
});

document.getElementById('precioVentaBs').addEventListener('input', (e) => {
    const precioBs = parseFloat(e.target.value) || 0;
    document.getElementById('precioVentaUsd').value = (precioBs / tasaDolar).toFixed(2);
});

document.getElementById('formEditarProducto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('editProductoIndex').value);
    const producto = {
        nombre: document.getElementById('editNombreProducto').value,
        precioCompraBs: parseFloat(document.getElementById('editPrecioCompraBs').value) || 0,
        precioCompraUsd: parseFloat(document.getElementById('editPrecioCompraUsd').value) || 0,
        precioVentaBs: parseFloat(document.getElementById('editPrecioVentaBs').value) || 0,
        precioVentaUsd: parseFloat(document.getElementById('editPrecioVentaUsd').value) || 0,
        stock: parseInt(document.getElementById('editStockProducto').value) || 0,
        _log: {
            accion: 'Editar Producto',
            detalles: `Producto ID: ${id}, Nombre: ${document.getElementById('editNombreProducto').value}`
        }
    };

    try {
        const response = await fetchConAuth(`http://localhost:3000/productos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(producto)
        });
        if (!response.ok) throw new Error('Error al actualizar producto');

        // Actualizar inventario local
        inventario = await (await fetchConAuth('http://localhost:3000/productos')).json();
        actualizarInventario();
        cerrarModal('modalEditarProducto');
        notificar('Producto actualizado correctamente', 'success');
    } catch (error) {
        console.error('Error al editar producto:', error);
        notificar('Error al actualizar producto: ' + error.message, 'error');
    }
});

document.getElementById('editPrecioCompraUsd').addEventListener('input', (e) => {
    const precioUsd = parseFloat(e.target.value) || 0;
    document.getElementById('editPrecioCompraBs').value = (precioUsd * tasaDolar).toFixed(2);
});

document.getElementById('editPrecioCompraBs').addEventListener('input', (e) => {
    const precioBs = parseFloat(e.target.value) || 0;
    document.getElementById('editPrecioCompraUsd').value = (precioBs / tasaDolar).toFixed(2);
});

document.getElementById('editPrecioVentaUsd').addEventListener('input', (e) => {
    const precioUsd = parseFloat(e.target.value) || 0;
    document.getElementById('editPrecioVentaBs').value = (precioUsd * tasaDolar).toFixed(2);
});

document.getElementById('editPrecioVentaBs').addEventListener('input', (e) => {
    const precioBs = parseFloat(e.target.value) || 0;
    document.getElementById('editPrecioVentaUsd').value = (precioBs / tasaDolar).toFixed(2);
});

document.getElementById('formProveedor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const proveedor = {
        nombre: document.getElementById('nombreProveedor').value,
        contacto: document.getElementById('contactoProveedor').value,
        productos: document.getElementById('productosProveedor').value,
        _log: {
            accion: 'Agregar Proveedor',
            detalles: `Proveedor: ${document.getElementById('nombreProveedor').value}`
        }
    };
    const response = await fetchConAuth('http://localhost:3000/proveedores', {
        method: 'POST',
        body: JSON.stringify(proveedor)
    });
    if (response.ok) {
        proveedores = await (await fetchConAuth('http://localhost:3000/proveedores')).json();
        actualizarProveedores();
        cerrarModal('modalProveedor');
        notificar('Proveedor agregado', 'success');
        e.target.reset();
    } else {
        notificar('Error al agregar proveedor', 'error');
    }
});

function actualizarProveedores() {
    document.getElementById('tablaProveedores').innerHTML = proveedores.map(p => `
        <tr>
            <td class="border p-2">${p.nombre}</td>
            <td class="border p-2">${p.contacto}</td>
            <td class="border p-2">${p.productos}</td>
            <td class="border p-2">
                <button onclick="eliminarProveedor(${p.id})" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

async function eliminarProveedor(id) {
    const proveedor = proveedores.find(p => p.id == id);
    const response = await fetchConAuth(`http://localhost:3000/proveedores/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({
            _log: {
                accion: 'Eliminar Proveedor',
                detalles: `Proveedor: ${proveedor.nombre}`
            }
        })
    });
    if (response.ok) {
        proveedores = await (await fetchConAuth('http://localhost:3000/proveedores')).json();
        actualizarProveedores();
        notificar('Proveedor eliminado', 'success');
    } else {
        notificar('Error al eliminar proveedor', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const selectTasaModo = document.getElementById('configTasaModo');
    if (selectTasaModo) {
        selectTasaModo.addEventListener('change', toggleTasaDolarInput);
    }
});

function toggleTasaDolarInput() {
    const modo = document.getElementById('configTasaModo').value;
    const tasaInput = document.getElementById('configTasaDolar');
    if (modo === 'manual') {
        tasaInput.removeAttribute('disabled');
        tasaInput.focus();
    } else {
        tasaInput.setAttribute('disabled', 'true');
        actualizarTasaDolar();
    }
}

document.getElementById('nav-config').addEventListener('click', () => {
    mostrarSeccion('config');
    document.getElementById('configBusinessName').value = document.getElementById('businessName').textContent;
    document.getElementById('configTasaDolar').value = tasaDolar.toFixed(2);
    document.getElementById('configTasaModo').value = tasaModo;
    toggleTasaDolarInput();
});

function actualizarPreciosVenta() {
    inventario.forEach(producto => {
        if (producto.precioVentaUsd) {
            producto.precioVentaBs = producto.precioVentaUsd * tasaDolar;
        }
        if (producto.precioCompraUsd) {
            producto.precioCompraBs = producto.precioCompraUsd * tasaDolar;
        }
    });
    actualizarInventario();
}

async function guardarConfig() {
    const nuevoModo = document.getElementById('configTasaModo').value;
    const tasaIngresada = parseFloat(document.getElementById('configTasaDolar').value) || tasaDolar;
    const businessName = document.getElementById('configBusinessName').value || 'Mi Negocio';

    if (isNaN(tasaIngresada) || tasaIngresada <= 0) {
        notificar('Ingrese una tasa de dólar válida', 'error');
        return;
    }

    try {
        const requests = [
            fetchConAuth('http://localhost:3000/config', {
                method: 'POST',
                body: JSON.stringify({
                    clave: 'businessName',
                    valor: businessName,
                    _log: {
                        accion: 'Actualizar Configuración',
                        detalles: `Nombre del Negocio: ${businessName}`
                    }
                })
            }),
            fetchConAuth('http://localhost:3000/config', {
                method: 'POST',
                body: JSON.stringify({
                    clave: 'tasaDolar',
                    valor: tasaIngresada.toString(),
                    _log: {
                        accion: 'Actualizar Configuración',
                        detalles: `Tasa Dólar: ${tasaIngresada.toFixed(2)} Bs/USD`
                    }
                })
            }),
            fetchConAuth('http://localhost:3000/config', {
                method: 'POST',
                body: JSON.stringify({
                    clave: 'tasaModo',
                    valor: nuevoModo,
                    _log: {
                        accion: 'Actualizar Configuración',
                        detalles: `Modo Tasa: ${nuevoModo}`
                    }
                })
            })
        ];

        const responses = await Promise.all(requests);
        const allSuccess = responses.every(r => r.ok);
        if (!allSuccess) {
            throw new Error('Algunas configuraciones no se guardaron correctamente');
        }

        document.getElementById('businessName').textContent = businessName;
        tasaModo = nuevoModo;
        tasaDolar = tasaIngresada;

        if (tasaModo === 'automatico') {
            await actualizarTasaDolar();
        } else {
            document.getElementById('tasaDolar').innerHTML = `${tasaDolar.toFixed(2)} Bs/USD <span id="tasaModo" class="text-sm">(manual)</span>`;
        }

        notificar('Configuración guardada correctamente', 'success');

        actualizarPreciosVenta();
        actualizarCarrito('detalleVenta', carritoVenta, 'totalBsVenta', 'totalUsdVenta');
        actualizarCarrito('detalleFiar', carritoFiar, 'totalBsFiar', 'totalUsdFiar');
    } catch (error) {
        console.error('Error en guardarConfig:', error);
        notificar('Error al guardar la configuración: ' + error.message, 'error');
        document.getElementById('configTasaDolar').value = tasaDolar;
        document.getElementById('configTasaModo').value = tasaModo;
        document.getElementById('configBusinessName').value = document.getElementById('businessName').textContent;
    }
}

function generarGraficoVentas() {
    const ctx = document.getElementById('ventasChart').getContext('2d');
    if (window.ventasChart instanceof Chart) {
        window.ventasChart.destroy();
    }
    const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        return fecha.toLocaleDateString();
    }).reverse();
    const ventasPorDia = ultimos7Dias.map(dia => {
        return ventas.filter(v => v.fecha.includes(dia)).reduce((a, b) => a + b.total, 0);
    });
    window.ventasChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ultimos7Dias,
            datasets: [{
                label: 'Ventas (Bs)',
                data: ventasPorDia,
                borderColor: '#ffcc00',
                fill: false
            }]
        },
        options: { scales: { y: { beginAtZero: true } } }
    });
}


function generarGraficoVentas() {
    const ctx = document.getElementById('ventasChart').getContext('2d');
    if (window.ventasChart instanceof Chart) {
        window.ventasChart.destroy();
    }
    const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        return fecha.toLocaleDateString();
    }).reverse();
    const ventasPorDia = ultimos7Dias.map(dia => {
        return ventas.filter(v => v.fecha.includes(dia)).reduce((a, b) => a + b.total, 0);
    });
    window.ventasChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ultimos7Dias,
            datasets: [{
                label: 'Ventas (Bs)',
                data: ventasPorDia,
                borderColor: '#ffcc00',
                fill: false
            }]
        },
        options: { scales: { y: { beginAtZero: true } } }
    });
}

function generarGraficoProductos() {
    const ctx = document.getElementById('productosChart').getContext('2d');
    if (window.productosChart instanceof Chart) {
        window.productosChart.destroy();
    }
    const productosVendidos = {};
    ventas.forEach(v => v.productos.forEach(p => {
        productosVendidos[p.id] = (productosVendidos[p.id] || 0) + p.cantidad;
    }));
    const topProductos = Object.entries(productosVendidos)
        .map(([id, cantidad]) => ({
            nombre: inventario.find(p => p.id === parseInt(id))?.nombre || 'Desconocido',
            cantidad
        }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);
    window.productosChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topProductos.map(p => p.nombre),
            datasets: [{
                label: 'Unidades Vendidas',
                data: topProductos.map(p => p.cantidad),
                backgroundColor: '#00ced1'
            }]
        },
        options: { scales: { y: { beginAtZero: true } } }
    });
}

// Función para cerrar sesión
async function cerrarSesion() {
try {
    // Registrar el cierre de sesión
    await fetchConAuth('/logout', {
        method: 'POST',
        body: JSON.stringify({
            _log: {
                accion: 'Cierre de sesión',
                detalles: 'Usuario cerró sesión'
            }
        })
    });
    } catch (e) {
    console.log("Error al registrar cierre:", e);
} finally {
    // Limpiar almacenamiento local y recargar
    localStorage.removeItem('authToken');
    window.location.reload();
}
}


async function imprimirTicket(tipo) {
    const carrito = tipo === 'venta' ? carritoVenta : carritoFiar;
    const cliente = tipo === 'venta' ? 
        document.getElementById('nombreClienteVenta').value || 'CLIENTE ANÓNIMO' : 
        document.getElementById('nombreClienteFiar').value;
    
    const subtotal = carrito.reduce((a, b) => a + b.total, 0);
    const aplicarIVA = document.getElementById('toggleIVA').checked;
    const iva = aplicarIVA ? calcularIVA(subtotal) : 0;
    const descuento = parseFloat(document.getElementById('descuentoInput').value) || 0;
    const montoDescuento = subtotal * (descuento / 100);
    const total = subtotal + iva - montoDescuento;
    const metodoPago = document.getElementById('metodoPagoSelect').value;
    const businessName = document.getElementById('businessName').textContent.toUpperCase();
    const fecha = new Date().toLocaleString();

    // Calcular posición para centrar la ventana
    const windowWidth = 600;
    const windowHeight = 800;
    const left = (screen.width - windowWidth) / 2;
    const top = (screen.height - windowHeight) / 2;

    // Generar e imprimir ticket
    const printWindow = window.open('', '_blank', `width=${windowWidth},height=${windowHeight},left=${left},top=${top}`);
    if (!printWindow) {
        notificar('Por favor, permite las ventanas emergentes para imprimir el ticket', 'error');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket de ${tipo === 'venta' ? 'Venta' : 'Fiado'}</title>
            <style>
                body {
                    font-family: 'Courier New', monospace;
                    width: 58mm;
                    margin: 0;
                    padding: 3mm;
                    font-size: 10px;
                    line-height: 1.3;
                }
                .header {
                    text-align: center;
                    font-weight: bold;
                    margin-bottom: 3mm;
                    padding-bottom: 2mm;
                    border-bottom: 1px dashed #000;
                }
                .business-name {
                    font-size: 12px;
                    margin-bottom: 1mm;
                }
                .ticket-type {
                    font-size: 11px;
                }
                .info {
                    margin-bottom: 4mm;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 3mm;
                }
                th {
                    text-align: left;
                    padding: 1mm 0;
                    border-bottom: 1px dashed #000;
                }
                td {
                    padding: 1mm 0;
                    vertical-align: top;
                }
                .producto {
                    display: flex;
                }
                .cantidad {
                    width: 8mm;
                    margin-right: 1mm;
                }
                .nombre {
                    flex-grow: 1;
                }
                .precio {
                    width: 20mm;
                    text-align: right;
                }
                .totals {
                    margin-top: 3mm;
                    padding-top: 2mm;
                    border-top: 1px dashed #000;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 1mm;
                }
                .footer {
                    text-align: center;
                    margin-top: 3mm;
                    padding-top: 2mm;
                    border-top: 1px dashed #000;
                    font-size: 9px;
                }
                @media print {
                    @page {
                        size: 58mm auto;
                        margin: 0;
                    }
                }
            </style>
        </head>
        <body onload="window.print();">
            <div class="header">
                <div class="business-name">${businessName}</div>
                <div class="ticket-type">TICKET DE ${tipo === 'venta' ? 'VENTA' : 'FIADO'}</div>
            </div>
            
            <div class="info">
                <div><strong>Fecha:</strong> ${fecha}</div>
                <div><strong>Cliente:</strong> ${cliente.toUpperCase()}</div>
                <div><strong>Método de Pago:</strong> ${metodoPago.toUpperCase()}</div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th colspan="3">PRODUCTOS</th>
                    </tr>
                </thead>
                <tbody>
                    ${carrito.map(p => `
                        <tr>
                            <td colspan="3">
                                <div class="producto">
                                    <div class="cantidad">(${p.cantidad})</div>
                                    <div class="nombre">${p.nombre.toUpperCase()}</div>
                                    <div class="precio">${p.total.toFixed(2)} BS</div>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="totals">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)} BS</span>
                </div>
                ${aplicarIVA ? `
                <div class="total-row">
                    <span>IVA (16%):</span>
                    <span>${iva.toFixed(2)} BS</span>
                </div>
                ` : ''}
                ${descuento > 0 ? `
                <div class="total-row">
                    <span>Descuento (${descuento}%):</span>
                    <span>-${montoDescuento.toFixed(2)} BS</span>
                </div>
                ` : ''}
                <div class="total-row" style="font-weight: bold;">
                    <span>TOTAL:</span>
                    <span>${total.toFixed(2)} BS</span>
                </div>
            </div>
            
            <div class="footer">
                <div>¡Gracias por su compra!</div>
                <div>${businessName}</div>
                ${tipo === 'fiar' ? '<div style="font-weight: bold;">** FIADO - PENDIENTE DE PAGO **</div>' : ''}
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();

    // Registrar la venta y actualizar después de imprimir
    printWindow.onafterprint = async () => {
        if (tipo === 'venta' && carritoVenta.length > 0) {
            let clienteId = null;
            const nombreCliente = cliente.trim();
            const telefonoCliente = document.getElementById('telefonoClienteVenta').value.trim() || '';

            // Buscar o crear cliente
            const clienteExistente = clientes.find(c => c.nombre === nombreCliente);
            if (clienteExistente) {
                clienteId = clienteExistente.id;
            } else if (nombreCliente !== 'CLIENTE ANÓNIMO') {
                try {
                    const response = await fetchConAuth('http://localhost:3000/clientes', {
                        method: 'POST',
                        body: JSON.stringify({
                            nombre: nombreCliente,
                            telefono: telefonoCliente,
                            _log: { accion: 'Agregar Cliente', detalles: `Cliente: ${nombreCliente}` }
                        })
                    });
                    if (!response.ok) throw new Error('Error al crear cliente');
                    clientes = await (await fetchConAuth('http://localhost:3000/clientes')).json();
                    clienteId = clientes.find(c => c.nombre === nombreCliente).id;
                } catch (error) {
                    console.error('Error al crear cliente:', error);
                    notificar('Error al registrar cliente, venta anónima', 'warning');
                }
            }

            // Registrar la venta
            const venta = {
                fecha,
                clienteId,
                cliente: nombreCliente,
                total,
                subtotal,
                iva: aplicarIVA ? iva : 0,
                descuento,
                metodoPago,
                productos: carrito.map(p => ({
                    id: p.id,
                    nombre: p.nombre,
                    cantidad: p.cantidad,
                    precioVentaBs: p.precioVentaBs,
                    total: p.cantidad * p.precioVentaBs
                })),
                _log: { accion: 'Finalizar Venta con Ticket', detalles: `Cliente: ${nombreCliente}, Total: ${total.toFixed(2)} Bs` }
            };

            try {
                const response = await fetchConAuth('http://localhost:3000/ventas', {
                    method: 'POST',
                    body: JSON.stringify(venta)
                });
                if (!response.ok) throw new Error('Error al registrar venta');

                // Actualizar inventario
                for (const p of carritoVenta) {
                    const producto = inventario.find(i => i.id === p.id);
                    if (producto) {
                        producto.stock -= p.cantidad;
                        await fetchConAuth(`http://localhost:3000/productos/${p.id}`, {
                            method: 'PUT',
                            body: JSON.stringify(producto)
                        });
                    }
                }

                // Actualizar datos locales
                ventas = await (await fetchConAuth('http://localhost:3000/ventas')).json();
                inventario = await (await fetchConAuth('http://localhost:3000/productos')).json();

                // Limpiar carrito y campos
                carritoVenta = [];
                document.getElementById('nombreClienteVenta').value = '';
                document.getElementById('telefonoClienteVenta').value = '';
                document.getElementById('cantidadVenta').value = '';
                document.getElementById('descuentoInput').value = '';
                document.getElementById('toggleIVA').checked = false;
                
                // Actualizar vistas
                actualizarCarrito('detalleVenta', carritoVenta, 'totalBsVenta', 'totalUsdVenta');
                actualizarInventario();
                actualizarClientes();
                actualizarDashboard();
                
                notificar('Venta registrada e inventario actualizado', 'success');
            } catch (error) {
                console.error('Error al registrar venta:', error);
                notificar('Error al registrar venta', 'error');
            }
        }
        printWindow.close(); // Cerrar la ventana después de registrar
    };
    
// Opción alternativa para impresión directa
    setTimeout(() => {
        if (printWindow.closed || typeof printWindow.print === 'undefined') {
            const printDiv = document.createElement('div');
            printDiv.style.position = 'absolute';
            printDiv.style.left = '-9999px';
            printDiv.innerHTML = `
                <div style="font-family: Arial; width: 80mm; padding: 10px 15px; background: white; color: #333;">
                    <div style="text-align: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px dashed #e0e0e0;">
                        <div style="font-weight: bold; font-size: 18px; margin-bottom: 4px; color: #2c3e50; letter-spacing: 1px;">${businessName}</div>
                        <div style="font-size: 14px; font-weight: bold; color: ${tipo === 'venta' ? '#27ae60' : '#e74c3c'}; margin-bottom: 6px; text-transform: uppercase;">
                            Ticket de ${tipo === 'venta' ? 'Venta' : 'Fiado'}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 12px; font-size: 11px; line-height: 1.4;">
                        <div><span style="font-weight: bold; color: #7f8c8d;">Fecha:</span> ${fecha}</div>
                        <div><span style="font-weight: bold; color: #7f8c8d;">Cliente:</span> ${cliente}</div>
                    </div>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px;">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 6px 0; border-bottom: 2px solid #e0e0e0; color: #7f8c8d; font-weight: bold;">Producto</th>
                                <th style="text-align: right; padding: 6px 0; border-bottom: 2px solid #e0e0e0; color: #7f8c8d; font-weight: bold;">Cant.</th>
                                <th style="text-align: right; padding: 6px 0; border-bottom: 2px solid #e0e0e0; color: #7f8c8d; font-weight: bold;">P. Unit.</th>
                                <th style="text-align: right; padding: 6px 0; border-bottom: 2px solid #e0e0e0; color: #7f8c8d; font-weight: bold;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${carrito.map(p => `
                                <tr>
                                    <td style="padding: 6px 0; border-bottom: 1px dashed #eee; vertical-align: top;">${p.nombre}</td>
                                    <td style="padding: 6px 0; border-bottom: 1px dashed #eee; vertical-align: top; text-align: right;">${p.cantidad}</td>
                                    <td style="padding: 6px 0; border-bottom: 1px dashed #eee; vertical-align: top; text-align: right;">${p.precioVentaBs.toFixed(2)}</td>
                                    <td style="padding: 6px 0; border-bottom: 1px dashed #eee; vertical-align: top; text-align: right;">${p.total.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div style="margin-top: 12px; padding-top: 10px; border-top: 2px dashed #e0e0e0; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-weight: bold; color: #7f8c8d;">Subtotal:</span>
                            <span style="font-weight: bold; color: #2c3e50;">${totalBs.toFixed(2)} Bs</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-weight: bold; color: #7f8c8d;">Tasa USD:</span>
                            <span style="font-weight: bold; color: #2c3e50;">${tasaDolar.toFixed(2)} Bs/USD</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; color: ${tipo === 'venta' ? '#27ae60' : '#e74c3c'};">
                            <span style="font-weight: bold;">TOTAL:</span>
                            <span style="font-weight: bold;">${totalBs.toFixed(2)} Bs (${totalUsd} USD)</span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 15px; font-size: 10px; color: #95a5a6; padding-top: 10px; border-top: 2px dashed #e0e0e0;">
                        <div style="font-style: italic; margin-bottom: 5px;">¡Gracias por su preferencia!</div>
                        <div>${businessName}</div>
                        ${tipo === 'fiar' ? '<div style="color: #e74c3c; font-weight: bold; margin-top: 8px; font-size: 11px;">** FIADO - PENDIENTE DE PAGO **</div>' : ''}
                    </div>
                </div>
            `;
            
            document.body.appendChild(printDiv);
            window.print();
            setTimeout(() => document.body.removeChild(printDiv), 1000);
        }
    }, 500);
        }

        // Función para calcular el IVA
function calcularIVA(total) {
    return total * porcentajeIVA;
}

function actualizarTotalesConIVA() {
    const subtotal = carritoVenta.reduce((a, b) => a + b.total, 0);
    const descuentoPorcentaje = parseFloat(document.getElementById('descuentoInput').value) || 0;
    const descuento = subtotal * (descuentoPorcentaje / 100);
    const iva = aplicarIVA ? calcularIVA(subtotal - descuento) : 0;
    const total = subtotal - descuento + iva;

    document.getElementById('totalBsVenta').textContent = total.toFixed(2);
    document.getElementById('totalUsdVenta').textContent = (total / tasaDolar).toFixed(2);
    
    const ivaInfo = document.getElementById('ivaInfo');
    if (aplicarIVA) {
        ivaInfo.classList.remove('hidden');
        document.getElementById('ivaAmount').textContent = iva.toFixed(2);
    } else {
        ivaInfo.classList.add('hidden');
    }
        }
    
// Event listener para el toggle de IVA
document.getElementById('toggleIVA').addEventListener('change', function() {
    aplicarIVA = this.checked;
    actualizarTotalesConIVA();
    registrarActividad(
        aplicarIVA ? 'Activar IVA' : 'Desactivar IVA', 
        `IVA ${aplicarIVA ? 'activado' : 'desactivado'} en venta`
    );
    });

    function verHistorialCliente(id) {
        fetchConAuth(`http://localhost:3000/clientes/${id}/historial`)
            .then(response => response.json())
            .then(historial => {
                const tbody = historial.map(h => `
                    <tr>
                        <td class="border p-2">${h.fecha}</td>
                        <td class="border p-2">${h.tipo}</td>
                        <td class="border p-2">${h.productos.map(p => `${p.nombre} (${p.cantidad})`).join(', ')}</td>
                        <td class="border p-2">${h.total.toFixed(2)} Bs</td>
                        </tr>
                `).join('');
                
                document.getElementById('historialClienteBody').innerHTML = tbody;
                document.getElementById('historialClienteNombre').textContent = 
                    clientes.find(c => c.id === id)?.nombre || 'Cliente Desconocido';
                abrirModal('modalHistorialCliente');
            })
            .catch(err => notificar('Error al cargar historial: ' + err.message, 'error'));
    }
    
function aplicarDescuento() {
    const descuentoInput = document.getElementById('descuentoInput');
    const descuentoPorcentaje = parseFloat(descuentoInput.value) || 0;
    
    if (descuentoPorcentaje < 0 || descuentoPorcentaje > 100) {
        notificar('El descuento debe estar entre 0% y 100%', 'error');
        descuentoInput.value = '0';
        return;
    }
    
    actualizarTotalesConIVA(); // Actualiza los totales con el descuento aplicado
    notificar(`Descuento del ${descuentoPorcentaje}% aplicado`, 'success');
    }     
