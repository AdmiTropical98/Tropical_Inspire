<?php
declare(strict_types=1);

require_once __DIR__ . '/_requisicoes_supabase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    sf_render_html_page('Metodo nao permitido', 'Utilize o link de recusa recebido no email.', '#dc3545');
}

$requisitionId = trim((string)($_GET['id'] ?? ''));
if ($requisitionId === '') {
    http_response_code(400);
    sf_render_html_page('Pedido invalido', 'ID da requisicao em falta.', '#dc3545');
}

$update = sf_update_requisition($requisitionId, [
    'supplier_confirmed' => false,
    'supplier_rejected' => true,
    'supplier_response_date' => gmdate('c'),
]);

if (($update['ok'] ?? false) !== true) {
    http_response_code(500);
    sf_render_html_page('Falha ao recusar', 'Nao foi possivel atualizar a requisicao neste momento.', '#dc3545');
}

$record = null;
if (isset($update['data']) && is_array($update['data']) && isset($update['data'][0]) && is_array($update['data'][0])) {
    $record = $update['data'][0];
}

$numero = (string)($record['numero'] ?? $requisitionId);
sf_insert_system_alert('Supplier rejected requisition ' . $numero, $requisitionId);

http_response_code(200);
sf_render_html_page('Requisicao recusada', 'Requisicao recusada.', '#b91c1c');
