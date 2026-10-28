<?php
/* GET  obtener_solicitudes.php                -> todas las solicitudes
   GET  obtener_solicitudes.php?id_usuario=N   -> solicitudes de un usuario
   GET  obtener_solicitudes.php?id=N           -> una solicitud con sus observaciones */
require_once __DIR__ . '/functions.php';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

header('Content-Type: application/json; charset=utf-8');

try {
  if (isset($_GET['id'])) {
    $id = filter_var($_GET['id'], FILTER_VALIDATE_INT);
    $solicitud = ($id === false) ? null : obtenerSolicitud($id);
    if ($solicitud === null) {
      http_response_code(404);
      echo json_encode(['ok' => false, 'mensaje' => 'La solicitud no existe.']);
    } else {
      echo json_encode(['ok' => true, 'datos' => $solicitud]);
    }
  } else {
    $idUsuario = null;
    if (isset($_GET['id_usuario'])) {
      $idUsuario = filter_var($_GET['id_usuario'], FILTER_VALIDATE_INT);
      if ($idUsuario === false) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Usuario no válido.']);
        exit;
      }
    }
    echo json_encode(['ok' => true, 'datos' => listarSolicitudes($idUsuario)]);
  }
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'mensaje' => 'Error del servidor: ' . $e->getMessage()]);
}
