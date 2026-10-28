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


function checkSols()
{

  $conn = conectar();

  $rs = $conn->query(
    "Select * from ``;"
  );

  $conn -> close();
}


function checkUsr()
{
  $conn = conectar();

  $rs = $conn->query(
    "Select * from ``;"
  );

  $conn -> close();
}

function checkDsp()
{
  $conn = conectar();

  $rs = $conn->query(
    "Select * from ``;"
  );

  $conn -> close();
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