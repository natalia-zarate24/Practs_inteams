/* Historial: sin sesión, la persona elige su nombre para ver sus solicitudes. */
var URL_USUARIOS = '../backend/PHP/usuarios.php';

var selectUsuario = document.getElementById('filtro-usuario');
var aviso = document.getElementById('aviso');
var tbody = document.getElementById('tabla-historial');

function cargarUsuarios() {
    fetch(URL_USUARIOS)
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(resp.mensaje); }
            resp.datos.forEach(function (u) {
                var option = document.createElement('option');
                option.value = u.id_usuario;
                option.textContent = u.nombre;
                selectUsuario.appendChild(option);
            });
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo cargar la lista de usuarios.', false);
        });
}

function cargarHistorial() {
    var url = URL_SOLICITUDES;
    if (selectUsuario.value !== '') {
        url += '?id_usuario=' + encodeURIComponent(selectUsuario.value);
    }
    fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(resp.mensaje); }
            llenarTablaSolicitudes(tbody, resp.datos,
                ['id_solicitud', 'equipo', 'descripcion', 'fecha', 'estado'],
                { texto: 'Ver detalle', href: 'detalle_soli.html' });
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo cargar el historial.', false);
        });
}

selectUsuario.addEventListener('change', cargarHistorial);

cargarUsuarios();
cargarHistorial();
