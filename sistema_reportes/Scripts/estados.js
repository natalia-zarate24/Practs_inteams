/* Utilidades compartidas por los módulos de solicitudes y seguimiento. */
var URL_SOLICITUDES = '../backend/PHP/obtener_solicitudes.php';

var CLASES_ESTADO = {
    'Pendiente': 'badge-warning',
    'En proceso': 'badge-info',
    'Resuelta': 'badge-success',
    'Cancelada': 'badge-danger'
};

/* <span class="badge ..."> con el estado; usa textContent (sin inyección de HTML) */
function crearBadge(estado) {
    var span = document.createElement('span');
    span.className = 'badge ' + (CLASES_ESTADO[estado] || 'badge-warning');
    span.textContent = estado;
    return span;
}

/* 12 -> "12", 7 -> "07" */
function formatearNumero(id) {
    return String(id).padStart(2, '0');
}

/* Lee un parámetro de la URL: ?id=12 */
function parametroURL(nombre) {
    return new URLSearchParams(window.location.search).get(nombre);
}

function crearCelda(contenido) {
    var td = document.createElement('td');
    if (contenido instanceof Node) { td.appendChild(contenido); }
    else { td.textContent = contenido; }
    return td;
}

/* Llena un <tbody> con solicitudes.
   columnas: arreglo de claves ('id_solicitud', 'usuario', 'equipo', 'descripcion', 'fecha', 'estado')
   enlace:   { texto: 'Actualizar', href: 'actualizar_soli.html' } agrega una última celda con enlace ?id= */
function llenarTablaSolicitudes(tbody, filas, columnas, enlace) {
    tbody.textContent = '';
    var total = columnas.length + (enlace ? 1 : 0);

    if (filas.length === 0) {
        var trVacia = document.createElement('tr');
        var tdVacia = document.createElement('td');
        tdVacia.colSpan = total;
        tdVacia.textContent = 'No hay solicitudes registradas.';
        trVacia.appendChild(tdVacia);
        tbody.appendChild(trVacia);
        return;
    }

    filas.forEach(function (fila) {
        var tr = document.createElement('tr');
        columnas.forEach(function (col) {
            if (col === 'estado') { tr.appendChild(crearCelda(crearBadge(fila.estado))); }
            else if (col === 'id_solicitud') { tr.appendChild(crearCelda(formatearNumero(fila.id_solicitud))); }
            else { tr.appendChild(crearCelda(fila[col])); }
        });
        if (enlace) {
            var a = document.createElement('a');
            a.className = 'link-action';
            a.textContent = enlace.texto;
            a.href = enlace.href + '?id=' + encodeURIComponent(fila.id_solicitud);
            var td = crearCelda(a);
            td.className = 'text-right';
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    });
}
