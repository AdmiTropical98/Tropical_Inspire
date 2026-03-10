<?php
declare(strict_types=1);

require_once __DIR__ . '/_requisicoes_supabase.php';

function render_comment_form(string $identifier): void
{
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html>';
    echo '<html lang="pt">';
    echo '<head>';
    echo '<meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>Enviar Comentario</title>';
    echo '<style>';
    echo 'body{background:#0f172a;color:white;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}';
    echo '.card{background:#1e293b;padding:40px;border-radius:10px;text-align:center;max-width:500px;width:100%;}';
    echo 'h1{margin:0 0 12px;font-size:28px;}';
    echo 'p{margin:0 0 20px;color:#dbe7ff;}';
    echo 'textarea{width:100%;min-height:140px;box-sizing:border-box;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#fff;padding:12px;resize:vertical;margin-bottom:14px;}';
    echo 'button{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer;}';
    echo '</style>';
    echo '</head>';
    echo '<body>';
    echo '<section class="card">';
    echo '<h1>Enviar Comentario</h1>';
    echo '<p>Partilhe o seu comentario sobre a requisicao.</p>';
    echo '<form method="post" action="/api/salvar-comentario-requisicao.php">';
    echo '<input type="hidden" name="id" value="' . htmlspecialchars($identifier, ENT_QUOTES, 'UTF-8') . '">';
    echo '<textarea name="comment" required placeholder="Escreva o seu comentario..."></textarea>';
    echo '<button type="submit">Enviar</button>';
    echo '</form>';
    echo '</section>';
    echo '</body>';
    echo '</html>';
    exit;
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$identifier = trim((string)(($method === 'POST' ? $_POST['id'] : $_GET['id']) ?? ''));

if ($identifier === '') {
    http_response_code(400);
    sf_render_html_page('Pedido invalido', 'ID da requisicao em falta.', '#dc3545');
}

if ($method === 'GET') {
    http_response_code(200);
    render_comment_form($identifier);
}

if ($method !== 'POST') {
    http_response_code(405);
    sf_render_html_page('Metodo nao permitido', 'Utilize GET para abrir o formulario ou POST para enviar o comentario.', '#dc3545');
}

$comment = trim((string)($_POST['comment'] ?? ''));

if ($comment === '') {
    http_response_code(400);
    sf_render_html_page('Comentario em falta', 'Escreva um comentario antes de enviar.', '#dc3545');
}

$update = sf_update_requisition($identifier, [
    'supplier_comment' => $comment,
    'supplier_response_date' => gmdate('c'),
]);

if (($update['ok'] ?? false) !== true) {
    $details = sf_format_response_error_details($update);
    error_log('salvar-comentario-requisicao failed: ' . $details);
    http_response_code(500);
    sf_render_html_page('Falha ao guardar', 'Nao foi possivel guardar o comentario.' . "\n" . $details, '#dc3545');
}

$record = sf_extract_requisition_record($update);

$numero = (string)($record['numero'] ?? $identifier);
$reqId = (string)($record['id'] ?? $identifier);
sf_insert_system_alert('Supplier sent comment for requisition ' . $numero, $reqId);

http_response_code(200);
sf_render_html_page('✔ Comentario enviado com sucesso.', 'Obrigado pelo feedback.', '#2563eb');
