<?php
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

if (
    !is_file(__DIR__ . '/PHPMailer/src/PHPMailer.php') ||
    !is_file(__DIR__ . '/PHPMailer/src/SMTP.php') ||
    !is_file(__DIR__ . '/PHPMailer/src/Exception.php')
) {
    http_response_code(500);
    echo 'PHPMailer files missing in /api/PHPMailer/src';
    exit;
}

require __DIR__ . '/PHPMailer/src/PHPMailer.php';
require __DIR__ . '/PHPMailer/src/SMTP.php';
require __DIR__ . '/PHPMailer/src/Exception.php';

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

try {
    $mail = new PHPMailer(true);
    $mail->SMTPDebug = 2;
    $mail->Debugoutput = function ($str, $level): void {
        error_log("SMTP DEBUG [{$level}]: {$str}");
    };

    $mail->isSMTP();
    $mail->Host = 'smtp.hostinger.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'frota@tropicalinspire.pt';
    $mail->Password = getenv('SMTP_PASS') ?: 'EMAIL_PASSWORD';
    $mail->SMTPSecure = 'ssl';
    $mail->Port = 465;
    $mail->CharSet = 'UTF-8';

    $mail->setFrom('frota@tropicalinspire.pt', 'Miguel Madeira');
    $mail->addAddress(getenv('SMTP_TEST_TO') ?: 'TEST_EMAIL_HERE');

    $mail->Subject = 'SMTP Test';
    $mail->Body = 'SMTP connection working';

    if ($mail->send()) {
        echo 'EMAIL SENT';
    } else {
        echo $mail->ErrorInfo;
    }
} catch (Exception $e) {
    echo $mail->ErrorInfo ?: $e->getMessage();
}
