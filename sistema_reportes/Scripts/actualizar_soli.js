/* Módulo 3: cambiar el estado de una solicitud (?id=N) y agregar una observación. */
var URL_ACTUALIZAR = '../backend/PHP/actualizar_solicitud.php';

var form = document.getElementById('form-actualizar');
var aviso = document.getElementById('aviso');
var id = parametroURL('id');

function mostrarResumen(s) {
    document.getElementById('titulo-solicitud').textContent = 'Solicitud n.º ' + formatearNumero(s.id_solicitud);
    document.getElementById('resumen-usuario').textContent = s.usuario;
    document.getElementById('resumen-equipo').textContent = s.equipo;
    document.getElementById('resumen-problema').textContent = s.descripcion;
    var estado = document.getElementById('resumen-estado');
    estado.textContent = '';
    estado.appendChild(crearBadge(s.estado));
}

function cargarSolicitud() {
    fetch(URL_SOLICITUDES + '?id=' + encodeURIComponent(id))
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(resp.mensaje); }
            mostrarResumen(resp.datos);
        })
        .catch(function (err) {
            mostrarAviso(aviso, err.message || 'No se pudo cargar la solicitud.', false);
        });
}

if (id === null) {
    mostrarAviso(aviso, 'No se indicó la solicitud. Vuelve a Seguimiento y elige una.', false);
    form.querySelector('button[type="submit"]').disabled = true;
} else {
    cargarSolicitud();
}

form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (form.estado.value === '') {
        mostrarAviso(aviso, 'Selecciona el nuevo estado.', false);
        return form.estado.focus();
    }

    var datos = new FormData();
    datos.append('id_solicitud', id);
    datos.append('estado', form.estado.value);
    datos.append('observacion', form.observacion.value.trim());

    fetch(URL_ACTUALIZAR, { method: 'POST', body: datos })
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            mostrarAviso(aviso, resp.mensaje, resp.ok);
            if (resp.ok) {
                form.observacion.value = '';
                cargarSolicitud();   // muestra la información ya actualizada
            }
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo conectar con el servidor.', false);
        });
});
