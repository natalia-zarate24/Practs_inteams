/* Avisos compartidos. Uso: mostrarAviso(elemento, "texto", true|false) */
function mostrarAviso(el, mensaje, exito) {
    el.textContent = mensaje;
    el.className = exito ? 'alert-success' : 'alert-error';
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.hidden = true; }, 5000);
}

/* Llena un <tbody>; columnas = claves a mostrar */
function llenarTabla(tbody, filas, columnas) {
    tbody.textContent = '';
    if (filas.length === 0) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = columnas.length;
        td.textContent = 'Aún no hay registros.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }
    filas.forEach(function (fila) {
        var tr = document.createElement('tr');
        columnas.forEach(function (col) {
            var td = document.createElement('td');
            td.textContent = fila[col];   // textContent evita inyección de HTML
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}