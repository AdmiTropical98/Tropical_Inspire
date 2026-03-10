<?php
declare(strict_types=1);

require_once __DIR__ . '/_requisicoes_supabase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    sf_render_html_page('Metodo nao permitido', 'Submeta o comentario atraves do formulario.', '#dc3545');
}

$requisitionId = trim((string)($_POST['id'] ?? ''));
$comment = trim((string)($_POST['comment'] ?? ''));

if ($requisitionId === '') {
    http_response_code(400);
    sf_render_html_page('Pedido invalido', 'ID da requisicao em falta.', '#dc3545');
}

if ($comment === '') {
    http_response_code(400);
    sf_render_html_page('Comentario em falta', 'Escreva um comentario antes de enviar.', '#dc3545');
}

$update = sf_update_requisition($requisitionId, [
    'supplier_comment' => $comment,
    'supplier_response_date' => gmdate('c'),
]);

if (($update['ok'] ?? false) !== true) {
    http_response_code(500);
    sf_render_html_page('Falha ao guardar', 'Nao foi possivel guardar o comentario.', '#dc3545');
}

$record = null;
if (isset($update['data']) && is_array($update['data']) && isset($update['data'][0]) && is_array($update['data'][0])) {
    $record = $update['data'][0];
}

$numero = (string)($record['numero'] ?? $requisitionId);
sf_insert_system_alert('Supplier sent comment for requisition ' . $numero, $requisitionId);

http_response_code(200);
sf_render_html_page('Comentario registado', 'Comentario enviado com sucesso.', '#2563eb');
