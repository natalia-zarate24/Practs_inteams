document.addEventListener('DOMContentLoaded', () => {

    // REQUERIMIENTO 1: Usuarios disponibles
    // const usuarios = [
    //     'Ana Pérez',
    //     'Luis Ramírez',
    //     'Marta Gómez',
    //     'Jorge Díaz',
    //     'Sofía Cruz'
    // ];

    // // REQUERIMIENTO 2: Equipos disponibles
    // const equipos = [
    //     'Laptop LAB-03',
    //     'Proyector A-12',
    //     'PC Biblioteca 4',
    //     'Router piso 2',
    //     'Impresora RH'
    // ];

    // // Datos locales de respaldo por si el PHP aún no está listo
    // let solicitudesLocales = [
    //     { id: 12, usuario: 'Ana Pérez', equipo: 'Laptop LAB-03', descripcion: 'No enciende', estado: 'Pendiente' },
    //     { id: 11, usuario: 'Luis Ramírez', equipo: 'Proyector A-12', descripcion: 'Sin señal HDMI', estado: 'Pendiente' }
    // ];

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

    // REQUERIMIENTO 5: Consultar y mostrar solicitudes desde BD (con fallback a local)
    function cargarSolicitudesDesdeBD() {
        fetch('../backend/PHP/obtener_solicitudes.php')
            .then(res => {
                if (!res.ok) throw new Error('Error al conectar con la API');
                return res.json();
            })
            .then(solicitudes => {
                renderizarTabla(solicitudes);
            })
            .catch(err => {
                console.warn('Backend PHP no detectado. Cargando datos locales de muestra:', err);
                renderizarTabla(solicitudesLocales);
            });
    }

    // Renderizar filas en la tabla HTML
    function renderizarTabla(solicitudes) {
        tablaSolicitudes.innerHTML = '';

        if (!solicitudes || solicitudes.length === 0) {
            tablaSolicitudes.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay solicitudes registradas</td></tr>';
            return;
        }

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

        // Intentar guardar mediante PHP en MySQL
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
                mostrarExito();
                formSolicitud.reset();
                cargarSolicitudesDesdeBD();
            } else {
                alert('Error al guardar en BD: ' + data.mensaje);
            }
        })
        .catch(error => {
            console.warn('Servidor PHP no alcanzable. Guardando localmente:', error);
            
            // Si la conexión al PHP falla, registra localmente para no detener la prueba
            solicitudesLocales.unshift({
                id: solicitudesLocales.length > 0 ? solicitudesLocales[0].id + 1 : 1,
                usuario: usuarioVal,
                equipo: equipoVal,
                descripcion: descripcionVal,
                estado: 'Pendiente'
            });

            mostrarExito();
            formSolicitud.reset();
            renderizarTabla(solicitudesLocales);
        });
    });

    function mostrarExito() {
        mensajeExito.style.display = 'block';
        setTimeout(() => {
            mensajeExito.style.display = 'none';
        }, 3000);
    }

    // Inicializar la pantalla
    cargarSelectores();
    cargarSolicitudesDesdeBD();
});