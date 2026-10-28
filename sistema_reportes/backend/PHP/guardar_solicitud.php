<?php
// backend/PHP/guardar_solicitud.php
header("Content-Type: application/json; charset=utf-8");

// Incluimos tu archivo de conexión
require_once "../DB/conexion.php"; // Ajusta el nombre exacto de tu archivo de conexión si es diferente

// Leemos los datos enviados en formato JSON desde JavaScript
$datos = json_decode(file_get_contents("php://input"), true);

if (isset($datos['usuario']) && isset($datos['equipo']) && isset($datos['descripcion'])) {
    $usuario = $datos['usuario'];
    $equipo = $datos['equipo'];
    $descripcion = $datos['descripcion'];
    $estado = 'Pendiente'; // Requerimiento obligatorio: Estado inicial automático

    // Preparamos la consulta SQL utilizando tu variable $conn
    $stmt = $conn->prepare("INSERT INTO solicitudes (usuario, equipo, descripcion, estado) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $usuario, $equipo, $descripcion, $estado);

    if ($stmt->execute()) {
        echo json_encode(["exito" => true, "mensaje" => "Solicitud guardada correctamente"]);
    } else {
        echo json_encode(["exito" => false, "mensaje" => "Error al insertar: " . $stmt->error]);
    }

    $stmt->close();
} else {
    echo json_encode(["exito" => false, "mensaje" => "Faltan datos requeridos"]);
}

$conn->close();
?>