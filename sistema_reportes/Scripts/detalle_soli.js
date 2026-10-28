/* Detalle de una solicitud (?id=N) para la persona solicitante. */
var aviso = document.getElementById('aviso');

function mostrarDetalle(s) {
    document.getElementById('titulo-solicitud').textContent = 'Solicitud n.º ' + formatearNumero(s.id_solicitud);
    document.getElementById('detalle-equipo').textContent = s.equipo;
    document.getElementById('detalle-fecha').textContent = s.fecha;
    var estado = document.getElementById('detalle-estado');
    estado.textContent = '';
    estado.appendChild(crearBadge(s.estado));
    document.getElementById('detalle-descripcion').textContent = s.descripcion;

    var caja = document.getElementById('detalle-observacion');
    caja.textContent = '';
    if (s.comentarios.length === 0) {
        caja.textContent = 'Aún sin observaciones.';
        return;
    }
    s.comentarios.forEach(function (c) {
        var p = document.createElement('p');
        p.textContent = c.fecha + ' — ' + c.descripcion;
        caja.appendChild(p);
    });
}

var id = parametroURL('id');
if (id === null) {
    mostrarAviso(aviso, 'No se indicó la solicitud. Vuelve al historial y elige una.', false);
} else {
    fetch(URL_SOLICITUDES + '?id=' + encodeURIComponent(id))
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(resp.mensaje); }
            mostrarDetalle(resp.datos);
        })
        .catch(function (err) {
            mostrarAviso(aviso, err.message || 'No se pudo cargar la solicitud.', false);
        });
}
