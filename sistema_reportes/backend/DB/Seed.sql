USE sistemareportes_db;

-- 1. Usuarios
INSERT INTO usuario (nombre, correo, disponibilidad) VALUES
('Juan Pérez', 'juan@correo.com', TRUE),
('María López', 'maria@correo.com', TRUE),
('Carlos Ruiz', 'carlos@correo.com', FALSE);

-- 2. Equipos
INSERT INTO equipo (nombre, descripcion, stock) VALUES
('Laptop', 'Laptop para trabajo administrativo', 5),
('Proyector', 'Proyector para presentaciones', 2),
('Impresora', 'Impresora multifuncional', 3);

-- 3. Solicitudes
INSERT INTO solicitud (id_usuario, id_equipo, descripcion, estado) VALUES
(1, 1, 'Solicitud de laptop para trabajo', 'Pendiente'),
(2, 2, 'Préstamo de proyector para exposición', 'En Proceso'),
(3, 3, 'Solicitud de impresora para oficina', 'Atendido');

-- 4. Comentarios
INSERT INTO comentario (id_solicitud, descripcion) VALUES
(1, 'Solicitud recibida, pendiente de revisión'),
(2, 'El equipo está siendo preparado para su entrega');