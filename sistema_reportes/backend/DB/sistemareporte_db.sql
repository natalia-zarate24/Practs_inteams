-- Creación de la base de datos (Opcional)
CREATE DATABASE sistemareportes_db;
use sistemareportes_db;

-- ==========================================
-- 1. TABLA: usuario
-- ==========================================
CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    disponibilidad BOOLEAN DEFAULT TRUE NOT NULL,
    
    -- Restricción de clave candidata (3FN / BCNF)
    CONSTRAINT uq_usuario_correo UNIQUE (correo)
);

-- ==========================================
-- 2. TABLA: equipo
-- ==========================================
CREATE TABLE equipo (
    id_equipo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    stock INT DEFAULT 0 NOT NULL,
    
    -- Validar que el stock no sea negativo
    CONSTRAINT chk_equipo_stock CHECK (stock >= 0)
);

-- ==========================================
-- 3. TABLA: solicitud
-- ==========================================
CREATE TABLE solicitud (
    id_solicitud INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_equipo INT NOT NULL,
    descripcion TEXT NOT NULL,
    estado VARCHAR(30) DEFAULT 'Pendiente' NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Claves Foráneas con reglas de integridad referencial
    CONSTRAINT fk_solicitud_usuario 
        FOREIGN KEY (id_usuario) 
        REFERENCES usuario (id_usuario) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
        
    CONSTRAINT fk_solicitud_equipo 
        FOREIGN KEY (id_equipo) 
        REFERENCES equipo (id_equipo) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
        
    -- Validación de estados permitidos
    CONSTRAINT chk_solicitud_estado 
        CHECK (estado IN ('Pendiente', 'En Proceso', 'Atendido', 'Cancelado'))
);

-- ==========================================
-- 4. TABLA: comentario
-- ==========================================
CREATE TABLE comentario (
    id_comentario INT AUTO_INCREMENT PRIMARY KEY,
    id_solicitud INT NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_comentario TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Integridad referencial: si se elimina la solicitud, se eliminan sus comentarios
    CONSTRAINT fk_comentario_solicitud 
        FOREIGN KEY (id_solicitud) 
        REFERENCES solicitud (id_solicitud) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- ==========================================
-- ÍNDICES RECOMENDADOS PARA OPTIMIZACIÓN (FKs)
-- ==========================================
CREATE INDEX idx_solicitud_usuario ON solicitud(id_usuario);
CREATE INDEX idx_solicitud_equipo ON solicitud(id_equipo);
CREATE INDEX idx_comentario_solicitud ON comentario(id_solicitud);

