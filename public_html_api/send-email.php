<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL);

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

set_exception_handler(static function (Throwable $exception): void {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unhandled server exception',
        'details' => $exception->getMessage(),
    ]);
    exit;
});

register_shutdown_function(static function (): void {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'success' => false,
            'error' => 'Fatal server error',
            'details' => $error['message'] ?? 'Unknown fatal error',
        ]);
    }
});

function get_env_value(string $key): ?string
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

function load_env_file_if_present(string $path): void
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

        if (get_env_value($name) === null) {
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
            putenv($name . '=' . $value);
        }
    }
}

function sanitize_header_value(string $value): string
{
    return trim(str_replace(["\r", "\n"], '', $value));
}

function sanitize_download_filename(string $fileName): string
{
    $safe = preg_replace('/[^A-Za-z0-9._-]/', '-', $fileName) ?? '';
    $safe = trim($safe, '.- ');

    if ($safe === '') {
        return 'requisicao.pdf';
    }

    if (!str_ends_with(strtolower($safe), '.pdf')) {
        $safe .= '.pdf';
    }

    return $safe;
}

function store_pdf_for_download(string $pdfBase64, string $fileName): ?array
{
    if ($pdfBase64 === '') {
        return null;
    }

    $pdfBinary = base64_decode($pdfBase64, true);
    if ($pdfBinary === false) {
        return null;
    }

    $storageDir = __DIR__ . '/tmp-requisicoes';
    if (!is_dir($storageDir) && !mkdir($storageDir, 0775, true) && !is_dir($storageDir)) {
        return null;
    }

    $token = bin2hex(random_bytes(24));
    $pdfPath = $storageDir . '/' . $token . '.pdf';
    $metaPath = $storageDir . '/' . $token . '.json';
    $safeName = sanitize_download_filename($fileName);

    if (file_put_contents($pdfPath, $pdfBinary) === false) {
        return null;
    }

    $meta = [
        'filename' => $safeName,
        'created_at' => time(),
        'expires_at' => time() + (7 * 24 * 60 * 60),
    ];

    file_put_contents($metaPath, json_encode($meta, JSON_UNESCAPED_SLASHES));

    return [
        'token' => $token,
        'filename' => $safeName,
    ];
}

function build_download_base_url(): string
{
    $envBaseUrl = get_env_value('REQUISICAO_DOWNLOAD_BASE_URL');
    if ($envBaseUrl !== null) {
        return rtrim($envBaseUrl, '/');
    }

    $host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    if ($host !== '' && (str_contains($host, 'localhost') || str_contains($host, '127.0.0.1'))) {
        $isHttps =
            (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
            strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
        $scheme = $isHttps ? 'https' : 'http';
        $scriptDir = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/'))), '/');

        return $scheme . '://' . $host . $scriptDir;
    }

    return 'https://algartempo-frota.com/api';
}

function send_via_native_mail(
    string $to,
    string $subject,
    string $htmlMessage,
    string $fromEmail,
    string $fromName,
    string $numero,
    string $pdfBase64,
    string $pdfFileName,
    string $pdfPath
): array {
    if (!function_exists('mail')) {
        return ['ok' => false, 'error' => 'mail() function is not available in this PHP runtime'];
    }

    $safeTo = sanitize_header_value($to);
    $safeFromEmail = sanitize_header_value($fromEmail);
    $safeFromName = sanitize_header_value($fromName);
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = "From: {$safeFromName} <{$safeFromEmail}>";
    $headers[] = "Reply-To: {$safeFromEmail}";

    $attachmentBinary = null;
    $attachmentName = '';

    if ($pdfPath !== '' && is_file($pdfPath)) {
        $attachmentBinary = file_get_contents($pdfPath);
        $attachmentName = $pdfFileName !== '' ? $pdfFileName : ('requisicao-' . ($numero !== '' ? $numero : 'anexo') . '.pdf');
    } elseif ($pdfBase64 !== '') {
        $decoded = base64_decode($pdfBase64, true);
        if ($decoded !== false) {
            $attachmentBinary = $decoded;
            $attachmentName = $pdfFileName !== '' ? $pdfFileName : ('requisicao-' . ($numero !== '' ? $numero : 'anexo') . '.pdf');
        }
    }

    if ($attachmentBinary !== null) {
        $boundary = '=_Part_' . bin2hex(random_bytes(12));
        $headers[] = "Content-Type: multipart/mixed; boundary=\"{$boundary}\"";

        $body = "--{$boundary}\r\n";
        $body .= "Content-Type: text/html; charset=UTF-8\r\n";
        $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
        $body .= $htmlMessage . "\r\n\r\n";
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Type: application/pdf; name=\"{$attachmentName}\"\r\n";
        $body .= "Content-Transfer-Encoding: base64\r\n";
        $body .= "Content-Disposition: attachment; filename=\"{$attachmentName}\"\r\n\r\n";
        $body .= chunk_split(base64_encode($attachmentBinary));
        $body .= "\r\n--{$boundary}--\r\n";
    } else {
        $headers[] = 'Content-Type: text/html; charset=UTF-8';
        $headers[] = 'Content-Transfer-Encoding: 8bit';
        $body = $htmlMessage;
    }

    $ok = mail($safeTo, $encodedSubject, $body, implode("\r\n", $headers));

    return $ok
        ? ['ok' => true]
        : ['ok' => false, 'error' => 'mail() returned false. Verify server mail configuration.'];
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Prefer Composer autoload (typical in production), then fallback to bundled PHPMailer files.
$autoloadCandidates = [
    __DIR__ . '/vendor/autoload.php',
    dirname(__DIR__) . '/vendor/autoload.php',
    dirname(__DIR__, 2) . '/vendor/autoload.php',
];

$autoloadLoaded = false;
foreach ($autoloadCandidates as $autoloadPath) {
    if (is_file($autoloadPath)) {
        require_once $autoloadPath;
        $autoloadLoaded = true;
        break;
    }
}

if (!$autoloadLoaded) {
    if (
        is_file(__DIR__ . '/PHPMailer/src/PHPMailer.php') &&
        is_file(__DIR__ . '/PHPMailer/src/SMTP.php') &&
        is_file(__DIR__ . '/PHPMailer/src/Exception.php')
    ) {
        require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
        require_once __DIR__ . '/PHPMailer/src/SMTP.php';
        require_once __DIR__ . '/PHPMailer/src/Exception.php';
    }
}

$phpMailerAvailable = class_exists(PHPMailer::class);

$raw = file_get_contents('php://input');
$data = json_decode($raw ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON body']);
    exit;
}

$to = trim((string)($data['to'] ?? ''));
$subject = trim((string)($data['subject'] ?? ''));
$message = (string)($data['message'] ?? '');
$numero = trim((string)($data['numero'] ?? ''));
$pdfBase64 = (string)($data['pdfBase64'] ?? '');
$pdfFileName = trim((string)($data['pdfFileName'] ?? ''));
$pdfPath = trim((string)($data['pdfPath'] ?? ''));
$pdfDownloadOnly = (bool)($data['pdfDownloadOnly'] ?? false);

if ($to === '' || $subject === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing to, subject or message']);
    exit;
}

if ($pdfDownloadOnly) {
    $resolvedPdfName = $pdfFileName !== '' ? $pdfFileName : ('requisicao-' . ($numero !== '' ? $numero : 'anexo') . '.pdf');
    $downloadEntry = store_pdf_for_download($pdfBase64, $resolvedPdfName);

    if ($downloadEntry === null) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Falha ao gerar link de download da requisicao',
        ]);
        exit;
    }

    $downloadUrl = build_download_base_url() . '/download-requisicao.php?token=' . rawurlencode((string)$downloadEntry['token']);
    $message = str_replace('__REQUISICAO_DOWNLOAD_URL__', $downloadUrl, $message);

    // In download-only mode we keep the PDF accessible by link and do not attach it to the email.
    $pdfBase64 = '';
    $pdfPath = '';
}

load_env_file_if_present(dirname(__DIR__, 2) . '/.env');
load_env_file_if_present(dirname(__DIR__) . '/.env');

$fromEmail = get_env_value('SMTP_FROM_EMAIL') ?? 'frota@tropicalinspire.pt';
$fromName = get_env_value('SMTP_FROM_NAME') ?? 'Miguel Madeira - Tropical Inspire';

if (!$phpMailerAvailable) {
    $nativeResult = send_via_native_mail($to, $subject, $message, $fromEmail, $fromName, $numero, $pdfBase64, $pdfFileName, $pdfPath);

    if ($nativeResult['ok'] === true) {
        http_response_code(200);
        echo json_encode(['success' => true, 'transport' => 'php-mail']);
        exit;
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to send email without PHPMailer',
        'details' => $nativeResult['error'] ?? 'Unknown native mail error',
    ]);
    exit;
}

$smtpHost = get_env_value('SMTP_HOST') ?? 'smtp.hostinger.com';
$smtpPort = (int)(get_env_value('SMTP_PORT') ?? '465');
$smtpUsername = get_env_value('SMTP_USER') ?? 'frota@tropicalinspire.pt';
$smtpPassword = get_env_value('SMTP_PASS') ?? '';
$smtpSecure = strtolower(get_env_value('SMTP_SECURE') ?? 'true') === 'true' ? 'ssl' : 'tls';

if ($smtpPassword === '' || $smtpPassword === 'EMAIL_PASSWORD') {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'SMTP not configured',
        'details' => 'Define SMTP_PASS no ambiente do servidor.',
    ]);
    exit;
}

try {
    $smtpDebugLog = [];
    $mail = new PHPMailer(true);
    $mail->SMTPDebug = 0;
    $mail->Debugoutput = function ($str, $level) use (&$smtpDebugLog): void {
        $line = "SMTP DEBUG [{$level}]: {$str}";
        $smtpDebugLog[] = $line;
        error_log($line);
    };

    $mail->isSMTP();
    $mail->Host = $smtpHost;
    $mail->Port = $smtpPort;
    $mail->SMTPAuth = true;
    $mail->SMTPSecure = $smtpSecure;
    $mail->Username = $smtpUsername;
    $mail->Password = $smtpPassword;
    $mail->CharSet = 'UTF-8';

    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($to);
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body = $message;

    if ($pdfPath !== '' && is_file($pdfPath)) {
        $mail->addAttachment($pdfPath, $pdfFileName !== '' ? $pdfFileName : ('requisicao-' . ($numero !== '' ? $numero : 'anexo') . '.pdf'));
    } elseif ($pdfBase64 !== '') {
        $pdfBinary = base64_decode($pdfBase64, true);
        if ($pdfBinary !== false) {
            $attachmentName = $pdfFileName !== '' ? $pdfFileName : ('requisicao-' . ($numero !== '' ? $numero : 'anexo') . '.pdf');
            $mail->addStringAttachment($pdfBinary, $attachmentName, PHPMailer::ENCODING_BASE64, 'application/pdf');
        }
    }

    $mail->send();
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => isset($mail) && $mail->ErrorInfo !== '' ? $mail->ErrorInfo : $e->getMessage(),
        'smtpDebug' => $smtpDebugLog ?? [],
    ]);
    exit;
}
