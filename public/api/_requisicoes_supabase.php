<?php
declare(strict_types=1);

function sf_get_env_value(string $key): ?string
{
    $value = getenv($key);
    if (is_string($value) && trim($value) !== '') {
        return trim($value);
    }

    if (isset($_ENV[$key]) && trim((string)$_ENV[$key]) !== '') {
        return trim((string)$_ENV[$key]);
    }

    if (isset($_SERVER[$key]) && trim((string)$_SERVER[$key]) !== '') {
        return trim((string)$_SERVER[$key]);
    }

    return null;
}

function sf_load_env_file_if_present(string $path): void
{
    if (!is_file($path) || !is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#') || strpos($trimmed, '=') === false) {
            continue;
        }

        [$name, $value] = explode('=', $trimmed, 2);
        $name = trim($name);
        $value = trim($value);

        if ($name === '') {
            continue;
        }

        if ((str_starts_with($value, '"') && str_ends_with($value, '"')) || (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
            $value = substr($value, 1, -1);
        }

        if (sf_get_env_value($name) === null) {
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
            putenv($name . '=' . $value);
        }
    }
}

function sf_bootstrap_env(): void
{
    sf_load_env_file_if_present(dirname(__DIR__, 2) . '/.env');
    sf_load_env_file_if_present(dirname(__DIR__) . '/.env');
}

function sf_supabase_credentials(): array
{
    sf_bootstrap_env();

    $supabaseUrl = sf_get_env_value('SUPABASE_URL') ?? sf_get_env_value('VITE_SUPABASE_URL');
    $supabaseKey = sf_get_env_value('SUPABASE_SERVICE_ROLE_KEY');

    if ($supabaseUrl === null || $supabaseKey === null) {
        return [
            'ok' => false,
            'error' => 'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
        ];
    }

    return [
        'ok' => true,
        'url' => rtrim($supabaseUrl, '/'),
        'key' => $supabaseKey,
    ];
}

function sf_supabase_request(string $method, string $path, ?array $payload = null, array $extraHeaders = []): array
{
    $credentials = sf_supabase_credentials();
    if (($credentials['ok'] ?? false) !== true) {
        return [
            'ok' => false,
            'status' => 500,
            'error' => $credentials['error'] ?? 'Supabase credentials not configured',
        ];
    }

    $url = $credentials['url'] . '/rest/v1/' . ltrim($path, '/');

    $headers = [
        'apikey: ' . $credentials['key'],
        'Authorization: Bearer ' . $credentials['key'],
        'Content-Type: application/json',
    ];

    foreach ($extraHeaders as $header) {
        $headers[] = $header;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);

    if ($payload !== null) {
        $json = json_encode($payload);
        if ($json === false) {
            curl_close($ch);
            return [
                'ok' => false,
                'status' => 500,
                'error' => 'Unable to encode request payload',
            ];
        }
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
    }

    $responseBody = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($responseBody === false) {
        return [
            'ok' => false,
            'status' => 500,
            'error' => $curlErr !== '' ? $curlErr : 'Unknown cURL error',
        ];
    }

    $decoded = json_decode((string)$responseBody, true);
    $isSuccess = $status >= 200 && $status < 300;

    return [
        'ok' => $isSuccess,
        'status' => $status,
        'data' => $decoded,
        'raw' => (string)$responseBody,
    ];
}

function sf_extract_requisition_record(array $response): ?array
{
    if (!isset($response['data']) || !is_array($response['data'])) {
        return null;
    }

    if (!isset($response['data'][0]) || !is_array($response['data'][0])) {
        return null;
    }

    return $response['data'][0];
}

function sf_update_requisition(string $identifier, array $updates): array
{
    $byIdPath = 'requisicoes?id=eq.' . rawurlencode($identifier) . '&select=id,numero';
    $byIdResponse = sf_supabase_request('PATCH', $byIdPath, $updates, ['Prefer: return=representation']);

    if (($byIdResponse['ok'] ?? false) !== true) {
        return $byIdResponse;
    }

    if (sf_extract_requisition_record($byIdResponse) !== null) {
        return $byIdResponse;
    }

    $byNumeroPath = 'requisicoes?numero=eq.' . rawurlencode($identifier) . '&select=id,numero';
    return sf_supabase_request('PATCH', $byNumeroPath, $updates, ['Prefer: return=representation']);
}

function sf_insert_system_alert(string $message, ?string $requestId = null): void
{
    $payload = [
        'type' => 'system_alert',
        'status' => 'pending',
        'data' => [
            'title' => 'Supplier update',
            'message' => $message,
            'priority' => 'normal',
            'requestId' => $requestId,
        ],
        'timestamp' => gmdate('c'),
    ];

    sf_supabase_request('POST', 'notifications', $payload);
}

function sf_render_html_page(string $title, string $message, string $accentColor): void
{
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html>';
    echo '<html lang="pt">';
    echo '<head>';
    echo '<meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</title>';
    echo '<style>';
    echo 'body{margin:0;font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px;}';
    echo '.card{max-width:500px;width:100%;background:#1e293b;border:1px solid #334155;border-radius:10px;padding:40px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.35);}';
    echo '.badge{display:inline-block;background:' . htmlspecialchars($accentColor, ENT_QUOTES, 'UTF-8') . ';color:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;letter-spacing:.03em;margin-bottom:14px;}';
    echo 'h1{margin:0 0 12px;font-size:28px;line-height:1.2;}';
    echo 'p{margin:0;color:#dbe7ff;line-height:1.6;font-size:16px;}';
    echo '</style>';
    echo '</head>';
    echo '<body>';
    echo '<section class="card">';
    echo '<span class="badge">SmartFleet</span>';
    echo '<h1>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1>';
    echo '<p>' . nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8')) . '</p>';
    echo '</section>';
    echo '</body>';
    echo '</html>';
    exit;
}
