<?php
declare(strict_types=1);

require_once __DIR__ . '/_requisicoes_supabase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    sf_render_html_page('Metodo nao permitido', 'Submeta o comentario atraves do formulario.', '#dc3545');
}

$identifier = trim((string)($_POST['id'] ?? ''));
$comment = trim((string)($_POST['comment'] ?? ''));

if ($identifier === '') {
    http_response_code(400);
    sf_render_html_page('Pedido invalido', 'ID da requisicao em falta.', '#dc3545');
}

if ($comment === '') {
    http_response_code(400);
    sf_render_html_page('Comentario em falta', 'Escreva um comentario antes de enviar.', '#dc3545');
}

$update = sf_update_requisition($identifier, [
    'supplier_comment' => $comment,
    'supplier_response_date' => gmdate('c'),
]);

if (($update['ok'] ?? false) !== true) {
    http_response_code(500);
    sf_render_html_page('Falha ao guardar', 'Nao foi possivel guardar o comentario.', '#dc3545');
}

$record = sf_extract_requisition_record($update);

$numero = (string)($record['numero'] ?? $identifier);
$reqId = (string)($record['id'] ?? $identifier);
sf_insert_system_alert('Supplier sent comment for requisition ' . $numero, $reqId);

http_response_code(200);
sf_render_html_page('✔ Comentario enviado', 'Obrigado pelo feedback.', '#2563eb');
