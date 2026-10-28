<?php
/* POST guardar_solicitud.php  (id_usuario, id_equipo, descripcion)
   El estado inicial «Pendiente» se asigna automáticamente. */
require_once __DIR__ . '/functions.php';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

header('Content-Type: application/json; charset=utf-8');

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);
    exit;
  }
  $resp = registrarSolicitud($_POST['id_usuario'] ?? '', $_POST['id_equipo'] ?? '', $_POST['descripcion'] ?? '');
  http_response_code($resp['ok'] ? 200 : 400);
  echo json_encode($resp);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'mensaje' => 'Error del servidor: ' . $e->getMessage()]);
}
