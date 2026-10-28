<?php

$host = "localhost";
$user = "root";
$pass = "";
$dbname = "sistemareportes_db";

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Acentos y ñ correctos al guardar y leer (coincide con utf8mb4 de la BD)
$conn->set_charset("utf8mb4");

// echo "Connected successfully";
