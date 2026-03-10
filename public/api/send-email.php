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

if (!class_exists(PHPMailer::class)) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Unable to load PHPMailer class',
        'details' => 'Execute composer install em public/api (ou envie vendor/) para o servidor.',
    ]);
    exit;
}

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

if ($to === '' || $subject === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing to, subject or message']);
    exit;
}

load_env_file_if_present(dirname(__DIR__, 2) . '/.env');
load_env_file_if_present(dirname(__DIR__) . '/.env');

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

    $mail->setFrom('frota@tropicalinspire.pt', 'Miguel Madeira - Tropical Inspire');
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
