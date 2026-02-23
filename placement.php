<?php
require_once (__DIR__.'/crest.php');
// Получаем и декодируем параметры размещения (от Битрикс24)
$placement_options = json_decode($_REQUEST['PLACEMENT_OPTIONS'], true);
$dealId = $placement_options['ID']; // ID текущей сделки


?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Калькулятор листовок</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f5f5f5;
        }
        .calculator-container {
            max-width: 1100px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 20px;
        }
        .deal-info {
            background: #e3f2fd;
            padding: 10px 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #2196F3;
        }
        iframe {
            width: 100%;
            height: 700px;
            border: none;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <div class="calculator-container">
        <?php if ($dealId): ?>
        <div class="deal-info">
            📋 Сделка #<?= htmlspecialchars($dealId) ?>: <strong><?= htmlspecialchars($dealTitle) ?></strong>
        </div>
        <?php endif; ?>

        <!-- Загружаем калькулятор из отдельного проекта, передавая ID сделки -->
        <iframe 
            src="https://publicfork.vercel.app/?deal_id=<?= urlencode($dealId) ?>&deal_title=<?= urlencode($dealTitle) ?>" 
            allow="camera; microphone; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
            referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
    </div>

    <script>
        // Сообщаем Битрикс24 о необходимости подогнать высоту iframe
        if (typeof BX24 !== 'undefined') {
            BX24.init(function() {
                BX24.resizeWindow();
            });
        }
    </script>
</body>
</html>