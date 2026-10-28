document.addEventListener('DOMContentLoaded', () => {

    // REQUERIMIENTO 1: Usuarios disponibles
    const usuarios = [
        'Ana Pérez',
        'Luis Ramírez',
        'Marta Gómez',
        'Jorge Díaz',
        'Sofía Cruz'
    ];

    // REQUERIMIENTO 2: Equipos disponibles
    const equipos = [
        'Laptop LAB-03',
        'Proyector A-12',
        'PC Biblioteca 4',
        'Router piso 2',
        'Impresora RH'
    ];

    // Elementos del DOM
    const selectSolicitante = document.getElementById('solicitante');
    const selectEquipo = document.getElementById('equipo');
    const formSolicitud = document.getElementById('form-solicitud');
    const txtDescripcion = document.getElementById('descripcion');
    const tablaSolicitudes = document.getElementById('tabla-solicitudes');
    const mensajeExito = document.getElementById('mensaje-exito');

    // Cargar listas desplegables
    function cargarSelectores() {
        usuarios.forEach(u => {
            const option = document.createElement('option');
            option.value = u;
            option.textContent = u;
            selectSolicitante.appendChild(option);
        });

        equipos.forEach(e => {
            const option = document.createElement('option');
            option.value = e;
            option.textContent = e;
            selectEquipo.appendChild(option);
        });
    }

    // REQUERIMIENTO 5: Consultar y mostrar solicitudes desde la Base de Datos
    function cargarSolicitudesDesdeBD() {
        fetch('../backend/PHP/obtener_solicitudes.php')
            .then(res => res.json())
            .then(solicitudes => {
                renderizarTabla(solicitudes);
            })
            .catch(err => console.error('Error al obtener solicitudes:', err));
    }

    // Renderizar filas en la tabla HTML
    function renderizarTabla(solicitudes) {
        tablaSolicitudes.innerHTML = '';

        solicitudes.forEach(sol => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sol.id < 10 ? '0' + sol.id : sol.id}</td>
                <td>${sol.usuario}</td>
                <td>${sol.equipo}</td>
                <td>${sol.descripcion || sol.problema}</td>
                <td><span class="badge badge-warning">${sol.estado}</span></td>
            `;
            tablaSolicitudes.appendChild(tr);
        });
    }

    // REQUERIMIENTO 3 y 4: Registrar en BD con estado automático «Pendiente»
    formSolicitud.addEventListener('submit', (e) => {
        e.preventDefault();

        const usuarioVal = selectSolicitante.value;
        const equipoVal = selectEquipo.value;
        const descripcionVal = txtDescripcion.value.trim();

        if (!usuarioVal || !equipoVal || !descripcionVal) return;

        const nuevaSolicitud = {
            usuario: usuarioVal,
            equipo: equipoVal,
            descripcion: descripcionVal
        };

        // Enviar a la Base de Datos vía PHP
        fetch('../backend/PHP/guardar_solicitud.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(nuevaSolicitud)
        })
        .then(res => res.json())
        .then(data => {
            if (data.exito) {
                // Mostrar alerta de éxito
                mensajeExito.style.display = 'block';
                setTimeout(() => {
                    mensajeExito.style.display = 'none';
                }, 3000);

                // Limpiar formulario y recargar tabla desde BD
                formSolicitud.reset();
                cargarSolicitudesDesdeBD();
            } else {
                alert('Error al guardar en la base de datos: ' + data.mensaje);
            }
        })
        .catch(error => {
            console.error('Error en la petición AJAX:', error);
            alert('No se pudo conectar con el servidor.');
        });
    });

    // Inicializar la pantalla
    cargarSelectores();
    cargarSolicitudesDesdeBD();
});