function contarRegistros(url, idSpan) {
    fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (resp) {
            if (!resp.ok) { throw new Error(); }
            document.getElementById(idSpan).textContent = resp.datos.length + ' registrados';
        })
        .catch(function () {
            document.getElementById(idSpan).textContent = 'No disponible';
        });
}

contarRegistros('../backend/PHP/usuarios.php', 'contador-usuarios');
contarRegistros('../backend/PHP/equipos.php', 'contador-equipos');