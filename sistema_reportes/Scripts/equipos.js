var URL_EQUIPOS = '../backend/PHP/equipos.php';

var form = document.getElementById('form-equipo');
var aviso = document.getElementById('aviso');
var tbody = document.getElementById('tabla-equipos');

function cargarEquipos() {
    fetch(URL_EQUIPOS)
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(resp.mensaje); }
            llenarTabla(tbody, resp.datos, ['id_equipo', 'nombre', 'stock', 'descripcion']);
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo cargar el catálogo de equipos.', false);
        });
}

form.addEventListener('submit', function (e) {
    e.preventDefault();

    var nombre = form.nombre.value.trim();
    var stock = form.stock.value.trim();
    var descripcion = form.descripcion.value.trim();

    if (nombre === '') {
        mostrarAviso(aviso, 'Escribe el nombre del equipo.', false);
        return form.nombre.focus();
    }
    if (!/^\d+$/.test(stock)) {
        mostrarAviso(aviso, 'El stock debe ser un número entero mayor o igual a 0.', false);
        return form.stock.focus();
    }
    if (descripcion === '') {
        mostrarAviso(aviso, 'Escribe la descripción del equipo.', false);
        return form.descripcion.focus();
    }

    fetch(URL_EQUIPOS, { method: 'POST', body: new FormData(form) })
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            mostrarAviso(aviso, resp.mensaje, resp.ok);
            if (resp.ok) {
                form.reset();
                form.stock.value = 1;
                cargarEquipos();
            }
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo conectar con el servidor.', false);
        });
});

cargarEquipos();