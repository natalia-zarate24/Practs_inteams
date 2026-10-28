<?php
// backend/PHP/obtener_solicitudes.php
header("Content-Type: application/json; charset=utf-8");
require_once "../DB/conexion.php"; // O la ruta a tu conexion.php

$sql = "SELECT id, usuario, equipo, descripcion, estado FROM solicitudes ORDER BY id DESC";
$resultado = $conn->query($sql);

$solicitudes = [];

if ($resultado && $resultado->num_rows > 0) {
    while ($fila = $resultado->fetch_assoc()) {
        $solicitudes[] = $fila;
    }
}

echo json_encode($solicitudes, JSON_UNESCAPED_UNICODE);
$conn->close();
?>