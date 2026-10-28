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

    // Estado inicial de solicitudes
    let solicitudes = [
        { id: 12, usuario: 'Ana Pérez', equipo: 'Laptop LAB-03', problema: 'No enciende', estado: 'Pendiente' },
        { id: 11, usuario: 'Luis Ramírez', equipo: 'Proyector A-12', problema: 'Sin señal HDMI', estado: 'Pendiente' }
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

    // REQUERIMIENTO 5: Mostrar solicitudes registradas (usuario, equipo y estado)
    function renderizarTabla() {
        tablaSolicitudes.innerHTML = '';

        solicitudes.forEach(sol => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sol.id < 10 ? '0' + sol.id : sol.id}</td>
                <td>${sol.usuario}</td>
                <td>${sol.equipo}</td>
                <td>${sol.problema}</td>
                <td><span class="badge badge-warning">${sol.estado}</span></td>
            `;
            tablaSolicitudes.appendChild(tr);
        });
    }

    // REQUERIMIENTO 3 y 4: Registrar solicitud con usuario, equipo, descripción y estado automático «Pendiente»
    formSolicitud.addEventListener('submit', (e) => {
        e.preventDefault();

        const usuarioVal = selectSolicitante.value;
        const equipoVal = selectEquipo.value;
        const descripcionVal = txtDescripcion.value.trim();

        if (!usuarioVal || !equipoVal || !descripcionVal) return;

        const nuevaSolicitud = {
            id: solicitudes.length > 0 ? solicitudes[0].id + 1 : 1,
            usuario: usuarioVal,
            equipo: equipoVal,
            problema: descripcionVal,
            estado: 'Pendiente' // Requerimiento 4: Asignación automática
        };

        solicitudes.unshift(nuevaSolicitud);

        renderizarTabla();
        formSolicitud.reset();

        // Mostrar alerta de éxito
        mensajeExito.style.display = 'block';
        setTimeout(() => {
            mensajeExito.style.display = 'none';
        }, 3000);
    });

    // Inicializar la pantalla
    cargarSelectores();
    renderizarTabla();
});