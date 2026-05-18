<?php
declare(strict_types=1);

$token = trim((string)($_GET['token'] ?? ''));
if (!preg_match('/^[a-f0-9]{48}$/', $token)) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Token invalido.';
    exit;
}

$storageDir = __DIR__ . '/tmp-requisicoes';
$pdfPath = $storageDir . '/' . $token . '.pdf';
$metaPath = $storageDir . '/' . $token . '.json';

if (!is_file($pdfPath)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Ficheiro nao encontrado.';
    exit;
}

$defaultName = 'requisicao.pdf';
$fileName = $defaultName;
$expiresAt = 0;

if (is_file($metaPath)) {
    $metaRaw = file_get_contents($metaPath);
    $meta = json_decode($metaRaw ?: '', true);

    if (is_array($meta)) {
        $candidateName = (string)($meta['filename'] ?? '');
        if ($candidateName !== '') {
            $safeName = preg_replace('/[^A-Za-z0-9._-]/', '-', $candidateName) ?? '';
            $safeName = trim($safeName, '.- ');
            if ($safeName !== '') {
                $fileName = str_ends_with(strtolower($safeName), '.pdf') ? $safeName : ($safeName . '.pdf');
            }
        }

        $expiresAt = (int)($meta['expires_at'] ?? 0);
    }
}

if ($expiresAt > 0 && time() > $expiresAt) {
    @unlink($pdfPath);
    @unlink($metaPath);

    http_response_code(410);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Link expirado.';
    exit;
}

$size = filesize($pdfPath);

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $fileName . '"; filename*=UTF-8\'\'' . rawurlencode($fileName));
header('Content-Transfer-Encoding: binary');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
if ($size !== false) {
    header('Content-Length: ' . (string)$size);
}

readfile($pdfPath);
