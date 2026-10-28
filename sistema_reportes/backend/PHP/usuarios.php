<?php
require_once __DIR__ . '/functions.php';

// Que los errores de MySQL se lancen como excepciones
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

header('Content-Type: application/json; charset=utf-8');

try {
  if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $resp = registrarUsuario($_POST['nombre'] ?? '', $_POST['correo'] ?? '');
    http_response_code($resp['ok'] ? 200 : 400);
    echo json_encode($resp);
  } else {
    echo json_encode(['ok' => true, 'datos' => listarUsuarios()]);
  }
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'mensaje' => 'Error del servidor: ' . $e->getMessage()]);
}