<?php
declare(strict_types=1);

require_once __DIR__ . '/_requisicoes_supabase.php';

function render_simple_notice(string $message, string $accentColor): void
{
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html>';
    echo '<html lang="pt">';
    echo '<head>';
    echo '<meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>Confirmacao</title>';
    echo '<style>';
    echo 'body{background:#0f172a;color:white;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;}';
    echo '.msg{max-width:620px;text-align:center;font-size:20px;line-height:1.5;font-weight:700;color:' . htmlspecialchars($accentColor, ENT_QUOTES, 'UTF-8') . ';}';
    echo '</style>';
    echo '</head>';
    echo '<body>';
    echo '<p class="msg">' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p>';
    echo '</body>';
    echo '</html>';
    exit;
}

function render_comment_form(string $identifier): void
{
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html>';
    echo '<html lang="pt">';
    echo '<head>';
    echo '<meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>Enviar comentario</title>';
    echo '<style>';
    echo 'body{background:#0f172a;color:white;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;}';
    echo '.card{background:#1e293b;padding:40px;border-radius:10px;text-align:center;max-width:500px;width:100%;}';
    echo 'h1{margin:0 0 12px;font-size:28px;}';
    echo 'p{margin:0 0 20px;color:#dbe7ff;line-height:1.5;}';
    echo 'textarea{width:100%;min-height:140px;box-sizing:border-box;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#fff;padding:12px;resize:vertical;margin-bottom:14px;}';
    echo 'button{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer;}';
    echo '</style>';
    echo '</head>';
    echo '<body>';
    echo '<section class="card">';
    echo '<h1>Enviar comentario</h1>';
    echo '<p>Partilhe o seu comentario sobre a requisicao.</p>';
    echo '<form method="post" action="action.php">';
    echo '<input type="hidden" name="action" value="comment">';
    echo '<input type="hidden" name="id" value="' . htmlspecialchars($identifier, ENT_QUOTES, 'UTF-8') . '">';
    echo '<textarea name="comment" required placeholder="Escreva o seu comentario..."></textarea>';
    echo '<button type="submit">Enviar comentario</button>';
    echo '</form>';
    echo '</section>';
    echo '</body>';
    echo '</html>';
    exit;
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$request = $method === 'POST' ? $_POST : $_GET;
$action = strtolower(trim((string)($request['action'] ?? '')));
$identifier = trim((string)($request['id'] ?? ''));

if ($identifier === '') {
    http_response_code(400);
    sf_render_html_page('Pedido invalido', 'ID da requisicao em falta.', '#dc3545');
}

if (!in_array($action, ['confirm', 'reject', 'comment'], true)) {
    http_response_code(400);
    sf_render_html_page('Acao invalida', 'Use action=confirm, action=reject ou action=comment.', '#dc3545');
}

if ($action === 'comment') {
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
        error_log('action comment failed: ' . $details);
        http_response_code(500);
        sf_render_html_page('Falha ao guardar', 'Nao foi possivel guardar o comentario.' . "\n" . $details, '#dc3545');
    }

    $record = sf_extract_requisition_record($update);
    $numero = (string)($record['numero'] ?? $identifier);
    $reqId = (string)($record['id'] ?? $identifier);
    sf_insert_system_alert('Supplier sent comment for requisition ' . $numero, $reqId);

    http_response_code(200);
    render_simple_notice('Comentario enviado com sucesso.', '#2563eb');
}

if ($method !== 'GET') {
    http_response_code(405);
    sf_render_html_page('Metodo nao permitido', 'Utilize o link recebido no email.', '#dc3545');
}

$now = gmdate('c');

if ($action === 'confirm') {
    $update = sf_update_requisition($identifier, [
        'supplier_confirmed' => true,
        'supplier_confirmed_at' => $now,
        'supplier_refused' => false,
        'supplier_refused_at' => null,
        'supplier_rejected' => false,
        'supplier_response_date' => $now,
    ]);

    if (($update['ok'] ?? false) !== true) {
        $details = sf_format_response_error_details($update);
        error_log('action confirm failed: ' . $details);
        http_response_code(500);
        sf_render_html_page('Falha ao confirmar', 'Nao foi possivel atualizar a requisicao.' . "\n" . $details, '#dc3545');
    }

    $record = sf_extract_requisition_record($update);
    $numero = (string)($record['numero'] ?? $identifier);
    $reqId = (string)($record['id'] ?? $identifier);
    sf_insert_system_alert('Supplier confirmed requisition ' . $numero, $reqId);

    http_response_code(200);
    sf_render_html_page('Rececao confirmada', 'Obrigado pela confirmacao.', '#16a34a');
}

$update = sf_update_requisition($identifier, [
    'supplier_confirmed' => false,
    'supplier_confirmed_at' => null,
    'supplier_refused' => true,
    'supplier_refused_at' => $now,
    'supplier_rejected' => true,
    'supplier_rejected_at' => $now,
    'supplier_response_date' => $now,
]);

if (($update['ok'] ?? false) !== true) {
    $details = sf_format_response_error_details($update);
    error_log('action reject failed: ' . $details);
    http_response_code(500);
    sf_render_html_page('Falha ao recusar', 'Nao foi possivel atualizar a requisicao.' . "\n" . $details, '#dc3545');
}

$record = sf_extract_requisition_record($update);
$numero = (string)($record['numero'] ?? $identifier);
$reqId = (string)($record['id'] ?? $identifier);
sf_insert_system_alert('Supplier rejected requisition ' . $numero, $reqId);

http_response_code(200);
render_simple_notice('Recusa confirmada com sucesso.', '#b91c1c');
