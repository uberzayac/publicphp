<?php
require_once (__DIR__.'/crest.php');

// Разрешаем CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Получаем и декодируем параметры размещения
$placement_options = json_decode($_REQUEST['PLACEMENT_OPTIONS'] ?? '{}', true);
$dealId = $placement_options['ID'] ?? '';

// Формируем URL калькулятора
$calculatorUrl = "https://publicfork.vercel.app/?deal_id=" . urlencode($dealId);
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Калькулятор листовок</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #f5f5f5;
        }
        
        .fullscreen {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            overflow: auto; /* Скролл только если нужно */
            background: white;
        }
        
        .loading {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            z-index: 1000;
            font-family: Arial, sans-serif;
        }
        
        .loading.hidden {
            display: none;
        }
        
        .loading-content {
            display: flex;
            align-items: center;
            background: white;
            padding: 20px 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #2196F3;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 15px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .error {
            color: #d32f2f;
            text-align: center;
        }
        
        .error button {
            margin-top: 10px;
            padding: 8px 16px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .error button:hover {
            background: #1976D2;
        }
    </style>
</head>
<body>
    <div id="loading" class="loading">
        <div class="loading-content">
            <div class="spinner"></div>
            <span>Загрузка калькулятора...</span>
        </div>
    </div>

    <div id="calculatorContainer" class="fullscreen" style="display: none;"></div>

    <script>
        const dealId = '<?= $dealId ?>';
        const calculatorUrl = '<?= $calculatorUrl ?>';
        const loadingEl = document.getElementById('loading');
        const containerEl = document.getElementById('calculatorContainer');

        // Функция загрузки стилей и скриптов
        function loadResources(doc) {
            // Копируем стили
            const styles = doc.querySelectorAll('style, link[rel="stylesheet"]');
            styles.forEach(style => {
                document.head.appendChild(style.cloneNode(true));
            });

            // Копируем скрипты (кроме тех, что уже загружены)
            const scripts = doc.querySelectorAll('script[src]');
            scripts.forEach(oldScript => {
                if (!document.querySelector(`script[src="${oldScript.src}"]`)) {
                    const newScript = document.createElement('script');
                    newScript.src = oldScript.src;
                    newScript.async = false;
                    document.body.appendChild(newScript);
                }
            });
        }

        async function loadCalculator() {
            try {
                // Загружаем HTML калькулятора
                const response = await fetch(calculatorUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const html = await response.text();
                
                // Парсим HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Проверяем, что получили валидный HTML
                if (!doc || !doc.body) {
                    throw new Error('Не удалось распарсить HTML калькулятора');
                }
                
                // Получаем содержимое body
                let bodyContent = doc.body.innerHTML;
                
                // Исправляем пути к ресурсам
                // 1. Логотип — переносим из корня publicfork в нашу папку
                bodyContent = bodyContent.replace(
                    'src="logo_new_rgb75.png"', 
                    'src="https://publicfork.vercel.app/logo_new_rgb75.png"'
                );
                
                // 2. Все остальные относительные пути
                bodyContent = bodyContent.replace(
                    /src="(?!https?:\/\/)([^"]+)"/g, 
                    'src="https://publicfork.vercel.app/$1"'
                );
                
                bodyContent = bodyContent.replace(
                    /href="(?!https?:\/\/)([^"]+)"/g, 
                    'href="https://publicfork.vercel.app/$1"'
                );
                
                // Вставляем контент
                containerEl.innerHTML = bodyContent;
                
                // Загружаем ресурсы
                loadResources(doc);
                
                // Прячем загрузку
                loadingEl.classList.add('hidden');
                containerEl.style.display = 'block';
                
                // Сообщаем Битрикс24 о загрузке
                if (typeof BX24 !== 'undefined') {
                    try {
                        BX24.init(function() {
                            BX24.resizeWindow();
                        });
                    } catch (e) {
                        console.warn('BX24 resize error:', e);
                    }
                }
                
            } catch (error) {
                console.error('Ошибка загрузки калькулятора:', error);
                
                loadingEl.innerHTML = `
                    <div class="loading-content error">
                        <div style="text-align: center;">
                            <div style="font-size: 48px; margin-bottom: 10px;">❌</div>
                            <div style="margin-bottom: 10px;">Ошибка загрузки калькулятора</div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 15px;">${error.message}</div>
                            <button onclick="location.reload()">Повторить</button>
                            <button onclick="window.open('${calculatorUrl}', '_blank')" style="margin-left: 10px; background: #4CAF50;">Открыть напрямую</button>
                        </div>
                    </div>
                `;
            }
        }

        // Запускаем загрузку
        loadCalculator();
    </script>
</body>
</html>
