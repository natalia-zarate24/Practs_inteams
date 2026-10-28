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
