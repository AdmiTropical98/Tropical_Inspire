<?php
declare(strict_types=1);

require_once __DIR__ . '/_requisicoes_supabase.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    sf_render_html_page('Metodo nao permitido', 'Utilize o link de confirmacao recebido no email.', '#dc3545');
}

$identifier = trim((string)($_GET['id'] ?? ''));
if ($identifier === '') {
    http_response_code(400);
    sf_render_html_page('Pedido invalido', 'ID da requisicao em falta.', '#dc3545');
}

$now = gmdate('c');
$update = sf_update_requisition($identifier, [
    'supplier_confirmed' => true,
    'supplier_confirmed_at' => $now,
    'supplier_refused' => false,
    'supplier_refused_at' => null,
    'supplier_rejected' => false,
    'supplier_response_date' => $now,
]);

if (($update['ok'] ?? false) !== true) {
    http_response_code(500);
    sf_render_html_page('Falha ao confirmar', 'Nao foi possivel atualizar a requisicao neste momento.', '#dc3545');
}

$record = sf_extract_requisition_record($update);

$numero = (string)($record['numero'] ?? $identifier);
$reqId = (string)($record['id'] ?? $identifier);
sf_insert_system_alert('Supplier confirmed requisition ' . $numero, $reqId);

http_response_code(200);
sf_render_html_page('✔ Rececao confirmada', "A requisicao foi confirmada com sucesso.\nObrigado.", '#16a34a');
