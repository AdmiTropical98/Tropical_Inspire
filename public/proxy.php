<?php
// Simple PHP Proxy for Cartrack API to bypass CORS
// Put this in your public/ folder

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$baseUrl = 'https://fleetapi-pt.cartrack.com/rest';
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : '';

// Remove leading slash if present
$endpoint = ltrim($endpoint, '/');

if (empty($endpoint)) {
    http_response_code(400);
    echo json_encode(['error' => 'No endpoint specified']);
    exit;
}

// Reconstruct the full URL
// We need to pass all query params EXCEPT 'endpoint'
$queryParams = $_GET;
unset($queryParams['endpoint']);
$queryString = http_build_query($queryParams);

$targetUrl = $baseUrl . '/' . $endpoint;
if (!empty($queryString)) {
    $targetUrl .= '?' . $queryString;
}

// Initialize cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Optional: if certificates fail

// Forward headers (specifically Authorization)
$headers = [];
foreach (getallheaders() as $name => $value) {
    if (stripos($name, 'Authorization') !== false || stripos($name, 'Content-Type') !== false) {
        $headers[] = "$name: $value";
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(['error' => 'Proxy Error: ' . curl_error($ch)]);
} else {
    http_response_code($httpCode);
    echo $response;
}

curl_close($ch);
?>
