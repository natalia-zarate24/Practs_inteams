/* Módulo 3: lista de todas las solicitudes para que soporte elija cuál actualizar. */
var aviso = document.getElementById('aviso');
var tbody = document.getElementById('tabla-seguimiento');

fetch(URL_SOLICITUDES)
    .then(function (r) { return r.json(); })
    .then(function (resp) {
        if (!resp.ok) { throw new Error(resp.mensaje); }
        llenarTablaSolicitudes(tbody, resp.datos,
            ['id_solicitud', 'usuario', 'equipo', 'descripcion', 'estado'],
            { texto: 'Actualizar', href: 'actualizar_soli.html' });
    })
    .catch(function () {
        mostrarAviso(aviso, 'No se pudieron cargar las solicitudes.', false);
    });
