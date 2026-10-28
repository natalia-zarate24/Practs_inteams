/* Módulo 2: registrar solicitudes y listarlas (sin sesión: cualquiera puede entrar). */
var URL_USUARIOS = '../backend/PHP/usuarios.php';
var URL_EQUIPOS = '../backend/PHP/equipos.php';
var URL_GUARDAR = '../backend/PHP/guardar_solicitud.php';

var form = document.getElementById('form-solicitud');
var aviso = document.getElementById('aviso');
var tbody = document.getElementById('tabla-solicitudes');

/* Llena un <select> con las opciones recibidas del servidor */
function llenarSelect(select, filas, claveValor, claveTexto) {
    filas.forEach(function (fila) {
        var option = document.createElement('option');
        option.value = fila[claveValor];
        option.textContent = fila[claveTexto];
        select.appendChild(option);
    });
}

function cargarSelectores() {
    fetch(URL_USUARIOS)
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(resp.mensaje); }
            llenarSelect(form.solicitante, resp.datos, 'id_usuario', 'nombre');
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo cargar la lista de usuarios.', false);
        });

    fetch(URL_EQUIPOS)
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(resp.mensaje); }
            llenarSelect(form.equipo, resp.datos, 'id_equipo', 'nombre');
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo cargar la lista de equipos.', false);
        });
}

function cargarSolicitudes() {
    fetch(URL_SOLICITUDES)
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(resp.mensaje); }
            llenarTablaSolicitudes(tbody, resp.datos,
                ['id_solicitud', 'usuario', 'equipo', 'descripcion', 'estado']);
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudieron cargar las solicitudes.', false);
        });
}

form.addEventListener('submit', function (e) {
    e.preventDefault();

    var descripcion = form.descripcion.value.trim();

    if (form.solicitante.value === '') {
        mostrarAviso(aviso, 'Selecciona al solicitante.', false);
        return form.solicitante.focus();
    }
    if (form.equipo.value === '') {
        mostrarAviso(aviso, 'Selecciona un equipo.', false);
        return form.equipo.focus();
    }
    if (descripcion === '') {
        mostrarAviso(aviso, 'Describe el problema del equipo.', false);
        return form.descripcion.focus();
    }

    var datos = new FormData();
    datos.append('id_usuario', form.solicitante.value);
    datos.append('id_equipo', form.equipo.value);
    datos.append('descripcion', descripcion);

    fetch(URL_GUARDAR, { method: 'POST', body: datos })
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            mostrarAviso(aviso, resp.mensaje, resp.ok);
            if (resp.ok) {
                form.reset();
                cargarSolicitudes();
            }
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo conectar con el servidor.', false);
        });
});

cargarSelectores();
cargarSolicitudes();
