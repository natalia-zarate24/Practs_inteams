<?php

/*  ------------------------------------------------------------
    consultas.php
    Todas las operaciones sobre la tabla `mensajes` (CRUD).
    Las paginas PHP solo llaman a estas funciones, asi el SQL
    vive en un unico lugar.

    Todas usan sentencias preparadas (?), por lo que lo que escriba
    el usuario nunca se concatena al SQL (evita inyeccion SQL).
    ------------------------------------------------------------ */

/**
 * Abre una conexion nueva.
 * Se usa `require` (y no `require_once`) a proposito: cada llamada necesita
 * su propia variable $conn local. Con require_once la segunda funcion que se
 * ejecutara en una misma peticion no tendria $conn.
 */


function conectar(): mysqli
{
  require __DIR__ . '/../DB/conexion.php';
  return $conn;
}

/* ============================================================
   MÓDULO 1: USUARIOS Y EQUIPOS
   ============================================================ */

function listarUsuarios(): array
{
  $conn = conectar();
  $rs = $conn->query("SELECT id_usuario, nombre, correo FROM usuario ORDER BY id_usuario");
  $usuarios = $rs->fetch_all(MYSQLI_ASSOC);
  $conn->close();
  return $usuarios;
}

function registrarUsuario(string $nombre, string $correo): array
{
  $nombre = trim($nombre);
  $correo = trim($correo);

  if ($nombre === '' || mb_strlen($nombre) > 100) {
    return ['ok' => false, 'mensaje' => 'El nombre es obligatorio (máximo 100 caracteres).'];
  }
  if (!filter_var($correo, FILTER_VALIDATE_EMAIL) || mb_strlen($correo) > 150) {
    return ['ok' => false, 'mensaje' => 'El correo electrónico no es válido.'];
  }

  $conn = conectar();
  try {
    $stmt = $conn->prepare("INSERT INTO usuario (nombre, correo) VALUES (?, ?)");
    $stmt->bind_param("ss", $nombre, $correo);
    $stmt->execute();
    $stmt->close();
    return ['ok' => true, 'mensaje' => 'Usuario agregado correctamente'];
  } catch (mysqli_sql_exception $e) {
    if ($e->getCode() === 1062) {   // correo duplicado (uq_usuario_correo)
      return ['ok' => false, 'mensaje' => 'Ya existe un usuario con ese correo.'];
    }
    return ['ok' => false, 'mensaje' => 'No se pudo guardar el usuario.'];
  } finally {
    $conn->close();
  }
}

function listarEquipos(): array
{
  $conn = conectar();
  $rs = $conn->query("SELECT id_equipo, nombre, stock, descripcion FROM equipo ORDER BY id_equipo");
  $equipos = $rs->fetch_all(MYSQLI_ASSOC);
  $conn->close();
  return $equipos;
}

function registrarEquipo(string $nombre, $stock, string $descripcion): array
{
  $nombre = trim($nombre);
  $descripcion = trim($descripcion);
  $stock = filter_var($stock, FILTER_VALIDATE_INT);

  if ($nombre === '' || mb_strlen($nombre) > 100) {
    return ['ok' => false, 'mensaje' => 'El nombre del equipo es obligatorio (máximo 100 caracteres).'];
  }
  if ($stock === false || $stock < 0) {
    return ['ok' => false, 'mensaje' => 'El stock debe ser un número entero mayor o igual a 0.'];
  }
  if ($descripcion === '') {
    return ['ok' => false, 'mensaje' => 'La descripción es obligatoria.'];
  }

  $conn = conectar();
  try {
    $stmt = $conn->prepare("INSERT INTO equipo (nombre, descripcion, stock) VALUES (?, ?, ?)");
    $stmt->bind_param("ssi", $nombre, $descripcion, $stock);
    $stmt->execute();
    $stmt->close();
    return ['ok' => true, 'mensaje' => 'Equipo agregado correctamente'];
  } catch (mysqli_sql_exception $e) {
    return ['ok' => false, 'mensaje' => 'No se pudo guardar el equipo.'];
  } finally {
    $conn->close();
  }
}
/* ============================================================
   MÓDULOS 2 Y 3: SOLICITUDES Y SEGUIMIENTO
   ============================================================ */

/* La BD guarda: Pendiente | En Proceso | Atendido | Cancelado.
   En pantalla se muestra: Pendiente | En proceso | Resuelta | Cancelada. */
function etiquetaEstado(string $estadoBD): string
{
  $etiquetas = [
    'Pendiente'  => 'Pendiente',
    'En Proceso' => 'En proceso',
    'Atendido'   => 'Resuelta',
    'Cancelado'  => 'Cancelada',
  ];
  return $etiquetas[$estadoBD] ?? $estadoBD;
}

/* Lista las solicitudes con el nombre del usuario y del equipo.
   Si se recibe $idUsuario solo devuelve las de ese usuario. */
function listarSolicitudes(?int $idUsuario = null): array
{
  $conn = conectar();
  $sql = "SELECT s.id_solicitud, u.nombre AS usuario, e.nombre AS equipo,
                 s.descripcion, s.estado,
                 DATE_FORMAT(s.fecha_creacion, '%d/%m/%Y') AS fecha
          FROM solicitud s
          INNER JOIN usuario u ON u.id_usuario = s.id_usuario
          INNER JOIN equipo  e ON e.id_equipo  = s.id_equipo";

  if ($idUsuario !== null) {
    $stmt = $conn->prepare($sql . " WHERE s.id_usuario = ? ORDER BY s.id_solicitud DESC");
    $stmt->bind_param("i", $idUsuario);
    $stmt->execute();
    $filas = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
  } else {
    $filas = $conn->query($sql . " ORDER BY s.id_solicitud DESC")->fetch_all(MYSQLI_ASSOC);
  }
  $conn->close();

  foreach ($filas as &$fila) {
    $fila['estado'] = etiquetaEstado($fila['estado']);
  }
  return $filas;
}

/* Devuelve una solicitud con sus observaciones (comentarios), o null si no existe. */
function obtenerSolicitud(int $idSolicitud): ?array
{
  $conn = conectar();
  $stmt = $conn->prepare(
    "SELECT s.id_solicitud, u.nombre AS usuario, e.nombre AS equipo,
            s.descripcion, s.estado,
            DATE_FORMAT(s.fecha_creacion, '%d/%m/%Y') AS fecha
     FROM solicitud s
     INNER JOIN usuario u ON u.id_usuario = s.id_usuario
     INNER JOIN equipo  e ON e.id_equipo  = s.id_equipo
     WHERE s.id_solicitud = ?"
  );
  $stmt->bind_param("i", $idSolicitud);
  $stmt->execute();
  $solicitud = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if ($solicitud === null) {
    $conn->close();
    return null;
  }

  $stmt = $conn->prepare(
    "SELECT descripcion, DATE_FORMAT(fecha_comentario, '%d/%m/%Y %H:%i') AS fecha
     FROM comentario WHERE id_solicitud = ? ORDER BY id_comentario"
  );
  $stmt->bind_param("i", $idSolicitud);
  $stmt->execute();
  $solicitud['comentarios'] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $stmt->close();
  $conn->close();

  $solicitud['estado'] = etiquetaEstado($solicitud['estado']);
  return $solicitud;
}

/* Registra una solicitud; el estado inicial «Pendiente» lo pone la BD (DEFAULT). */
function registrarSolicitud($idUsuario, $idEquipo, string $descripcion): array
{
  $idUsuario = filter_var($idUsuario, FILTER_VALIDATE_INT);
  $idEquipo = filter_var($idEquipo, FILTER_VALIDATE_INT);
  $descripcion = trim($descripcion);

  if ($idUsuario === false || $idUsuario < 1) {
    return ['ok' => false, 'mensaje' => 'Selecciona al solicitante.'];
  }
  if ($idEquipo === false || $idEquipo < 1) {
    return ['ok' => false, 'mensaje' => 'Selecciona un equipo.'];
  }
  if ($descripcion === '') {
    return ['ok' => false, 'mensaje' => 'Describe el problema del equipo.'];
  }

  $conn = conectar();
  try {
    $stmt = $conn->prepare(
      "INSERT INTO solicitud (id_usuario, id_equipo, descripcion, estado) VALUES (?, ?, ?, 'Pendiente')"
    );
    $stmt->bind_param("iis", $idUsuario, $idEquipo, $descripcion);
    $stmt->execute();
    $stmt->close();
    return ['ok' => true, 'mensaje' => 'Solicitud enviada correctamente'];
  } catch (mysqli_sql_exception $e) {
    if ($e->getCode() === 1452) {   // llave foránea: usuario o equipo inexistente
      return ['ok' => false, 'mensaje' => 'El usuario o el equipo seleccionado no existe.'];
    }
    return ['ok' => false, 'mensaje' => 'No se pudo guardar la solicitud.'];
  } finally {
    $conn->close();
  }
}

/* Cambia el estado de una solicitud y, si se escribió, guarda la observación. */
function actualizarSolicitud($idSolicitud, string $estado, string $observacion): array
{
  $idSolicitud = filter_var($idSolicitud, FILTER_VALIDATE_INT);
  $observacion = trim($observacion);

  $estados = [
    'proceso'   => 'En Proceso',
    'resuelto'  => 'Atendido',
    'rechazado' => 'Cancelado',
  ];

  if ($idSolicitud === false || $idSolicitud < 1) {
    return ['ok' => false, 'mensaje' => 'Solicitud no válida.'];
  }
  if (!isset($estados[$estado])) {
    return ['ok' => false, 'mensaje' => 'Selecciona un estado válido.'];
  }
  $estadoBD = $estados[$estado];

  $conn = conectar();
  try {
    $conn->begin_transaction();

    $stmt = $conn->prepare("SELECT id_solicitud FROM solicitud WHERE id_solicitud = ? FOR UPDATE");
    $stmt->bind_param("i", $idSolicitud);
    $stmt->execute();
    $existe = $stmt->get_result()->num_rows > 0;
    $stmt->close();
    if (!$existe) {
      $conn->rollback();
      return ['ok' => false, 'mensaje' => 'La solicitud no existe.'];
    }

    $stmt = $conn->prepare("UPDATE solicitud SET estado = ? WHERE id_solicitud = ?");
    $stmt->bind_param("si", $estadoBD, $idSolicitud);
    $stmt->execute();
    $stmt->close();

    if ($observacion !== '') {
      $stmt = $conn->prepare("INSERT INTO comentario (id_solicitud, descripcion) VALUES (?, ?)");
      $stmt->bind_param("is", $idSolicitud, $observacion);
      $stmt->execute();
      $stmt->close();
    }

    $conn->commit();
    return ['ok' => true, 'mensaje' => 'Cambios guardados. Estado: ' . etiquetaEstado($estadoBD)];
  } catch (mysqli_sql_exception $e) {
    $conn->rollback();
    return ['ok' => false, 'mensaje' => 'No se pudieron guardar los cambios.'];
  } finally {
    $conn->close();
  }
}
