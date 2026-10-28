<?php
/* POST actualizar_solicitud.php  (id_solicitud, estado, observacion) */
require_once __DIR__ . '/functions.php';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

header('Content-Type: application/json; charset=utf-8');

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido.']);
    exit;
  }
  $resp = actualizarSolicitud($_POST['id_solicitud'] ?? '', $_POST['estado'] ?? '', $_POST['observacion'] ?? '');
  http_response_code($resp['ok'] ? 200 : 400);
  echo json_encode($resp);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'mensaje' => 'Error del servidor: ' . $e->getMessage()]);
}
