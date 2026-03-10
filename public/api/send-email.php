<?php
declare(strict_types=1);

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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

if (
    !is_file(__DIR__ . '/PHPMailer/src/PHPMailer.php') ||
    !is_file(__DIR__ . '/PHPMailer/src/SMTP.php') ||
    !is_file(__DIR__ . '/PHPMailer/src/Exception.php')
) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'PHPMailer files not found in /api/PHPMailer/src',
    ]);
    exit;
}

require __DIR__ . '/PHPMailer/src/PHPMailer.php';
require __DIR__ . '/PHPMailer/src/SMTP.php';
require __DIR__ . '/PHPMailer/src/Exception.php';

if (!class_exists(PHPMailer::class)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to load PHPMailer class']);
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

$smtpHost = 'smtp.hostinger.com';
$smtpPort = 465;
$smtpUsername = 'frota@tropicalinspire.pt';
$smtpPassword = getenv('SMTP_PASS') ?: 'EMAIL_PASSWORD';

try {
    $smtpDebugLog = [];
    $mail = new PHPMailer(true);
    $mail->SMTPDebug = 2;
    $mail->Debugoutput = function ($str, $level) use (&$smtpDebugLog): void {
        $line = "SMTP DEBUG [{$level}]: {$str}";
        $smtpDebugLog[] = $line;
        error_log($line);
    };

    $mail->isSMTP();
    $mail->Host = $smtpHost;
    $mail->Port = $smtpPort;
    $mail->SMTPAuth = true;
    $mail->SMTPSecure = 'ssl';
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
