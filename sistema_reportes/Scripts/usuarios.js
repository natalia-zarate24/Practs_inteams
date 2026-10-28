var URL_USUARIOS = '../backend/PHP/usuarios.php';

var form = document.getElementById('form-usuario');
var aviso = document.getElementById('aviso');
var tbody = document.getElementById('tabla-usuarios');

function cargarUsuarios() {
    fetch(URL_USUARIOS)
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(resp.mensaje); }
            llenarTabla(tbody, resp.datos, ['id_usuario', 'nombre', 'correo']);
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo cargar la lista de usuarios.', false);
        });
}

form.addEventListener('submit', function (e) {
    e.preventDefault();

    var nombre = form.nombre.value.trim();
    var correo = form.correo.value.trim();

    if (nombre === '') {
        mostrarAviso(aviso, 'Escribe el nombre completo.', false);
        return form.nombre.focus();
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        mostrarAviso(aviso, 'Escribe un correo electrónico válido.', false);
        return form.correo.focus();
    }

    fetch(URL_USUARIOS, { method: 'POST', body: new FormData(form) })
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            mostrarAviso(aviso, resp.mensaje, resp.ok);
            if (resp.ok) {
                form.reset();
                cargarUsuarios();
            }
        })
        .catch(function () {
            mostrarAviso(aviso, 'No se pudo conectar con el servidor.', false);
        });
});

cargarUsuarios();