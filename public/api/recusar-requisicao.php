<?php
declare(strict_types=1);

require_once __DIR__ . '/_requisicoes_supabase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    sf_render_html_page('Metodo nao permitido', 'Utilize o link de recusa recebido no email.', '#dc3545');
}

$identifier = trim((string)($_GET['id'] ?? ''));
if ($identifier === '') {
    http_response_code(400);
    sf_render_html_page('Pedido invalido', 'ID da requisicao em falta.', '#dc3545');
}

$now = gmdate('c');
$update = sf_update_requisition($identifier, [
    'supplier_confirmed' => false,
    'supplier_confirmed_at' => null,
    'supplier_refused' => true,
    'supplier_refused_at' => $now,
    'supplier_rejected' => true,
    'supplier_response_date' => $now,
]);

if (($update['ok'] ?? false) !== true) {
    $details = sf_format_response_error_details($update);
    error_log('recusar-requisicao failed: ' . $details);
    http_response_code(500);
    sf_render_html_page('Falha ao recusar', 'Nao foi possivel atualizar a requisicao neste momento.' . "\n" . $details, '#dc3545');
}

$record = sf_extract_requisition_record($update);

$numero = (string)($record['numero'] ?? $identifier);
$reqId = (string)($record['id'] ?? $identifier);
sf_insert_system_alert('Supplier rejected requisition ' . $numero, $reqId);

http_response_code(200);
sf_render_html_page('✖ Requisicao Recusada', "A requisicao foi recusada.\nO sistema foi atualizado.", '#b91c1c');
