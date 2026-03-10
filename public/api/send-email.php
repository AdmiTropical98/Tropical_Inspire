<?php
declare(strict_types=1);

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

if ($to === '' || $subject === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing to, subject or message']);
    exit;
}

$fromEmail = 'frota@tropicalinspire.pt';
$fromName = 'Miguel Madeira - Tropical Inspire';

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$headers = [
    'MIME-Version: 1.0',
    'Content-type: text/html; charset=UTF-8',
    'From: ' . $fromName . ' <' . $fromEmail . '>',
    'Reply-To: ' . $fromEmail,
    'X-Mailer: PHP/' . phpversion(),
];

$sent = mail($to, $encodedSubject, $message, implode("\r\n", $headers));

if ($sent) {
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(500);
echo json_encode(['success' => false]);
