<?php
declare(strict_types=1);

$requisitionId = trim((string)($_GET['id'] ?? ''));
if ($requisitionId === '') {
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pedido invalido</title></head><body><p>ID da requisicao em falta.</p></body></html>';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="pt">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Enviar Comentario</title>
    <style>
        body {
            margin: 0;
            font-family: Segoe UI, Arial, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            width: 100%;
            max-width: 620px;
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, .35);
        }
        h1 {
            margin: 0 0 8px;
            font-size: 24px;
        }
        p {
            margin: 0 0 18px;
            color: #cbd5e1;
        }
        textarea {
            width: 100%;
            min-height: 140px;
            border-radius: 10px;
            border: 1px solid #334155;
            background: #020617;
            color: #e2e8f0;
            padding: 12px;
            resize: vertical;
            box-sizing: border-box;
            margin-bottom: 14px;
        }
        button {
            border: 0;
            background: #2563eb;
            color: #fff;
            border-radius: 10px;
            padding: 10px 16px;
            font-weight: 700;
            cursor: pointer;
        }
        button:hover {
            background: #1d4ed8;
        }
    </style>
</head>
<body>
<section class="card">
    <h1>Enviar Comentario</h1>
    <p>Partilhe uma observacao sobre a requisicao.</p>
    <form method="post" action="/api/salvar-comentario-requisicao.php">
        <input type="hidden" name="id" value="<?= htmlspecialchars($requisitionId, ENT_QUOTES, 'UTF-8') ?>">
        <textarea name="comment" required placeholder="Escreva o seu comentario..."></textarea>
        <button type="submit">Enviar Comentario</button>
    </form>
</section>
</body>
</html>
