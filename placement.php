<?php
require_once (__DIR__.'/crest.php');
// Получаем и декодируем параметры размещения (от Битрикс24)
$placement_options = json_decode($_REQUEST['PLACEMENT_OPTIONS'], true);
$dealId = $placement_options['ID']; // ID текущей сделки

// Формируем URL калькулятора с параметрами
$calculatorUrl = "https://publicfork.vercel.app/?deal_id=" . urlencode($dealId);
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Калькулятор листовок</title>
    <style>
        /* Сбрасываем все отступы и скроллы */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden; /* Убираем скроллы у страницы */
            background: #f5f5f5;
        }
        
        /* Контейнер на всю высоту */
        .fullscreen {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: white;
        }
        
        /* Стили для загрузки */
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
            color: #666;
        }
        
        .loading.hidden {
            display: none;
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
        
        .loading-content {
            display: flex;
            align-items: center;
            background: white;
            padding: 20px 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <!-- Индикатор загрузки -->
    <div id="loading" class="loading">
        <div class="loading-content">
            <div class="spinner"></div>
            <span>Загрузка калькулятора...</span>
        </div>
    </div>

    <!-- Контейнер для калькулятора -->
    <div id="calculatorContainer" class="fullscreen" style="display: none;"></div>

    <script>
        // Получаем ID сделки из PHP
        const dealId = '<?= $dealId ?>';
        const calculatorUrl = '<?= $calculatorUrl ?>';
        
        // Функция загрузки калькулятора
        async function loadCalculator() {
            try {
                // Загружаем HTML калькулятора
                const response = await fetch(calculatorUrl);
                const html = await response.text();
                
                // Создаем временный контейнер
                const temp = document.createElement('div');
                temp.innerHTML = html;
                
                // Извлекаем только содержимое body (без оберток)
                const bodyContent = temp.querySelector('body').innerHTML;
                
                // Вставляем в наш контейнер
                document.getElementById('calculatorContainer').innerHTML = bodyContent;
                
                // Копируем все стили из head
                const styles = temp.querySelectorAll('style, link[rel="stylesheet"]');
                styles.forEach(style => {
                    document.head.appendChild(style.cloneNode(true));
                });
                
                // Копируем все скрипты
                const scripts = temp.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    
                    // Копируем атрибуты
                    Array.from(oldScript.attributes).forEach(attr => {
                        newScript.setAttribute(attr.name, attr.value);
                    });
                    
                    // Копируем содержимое для inline-скриптов
                    if (oldScript.src) {
                        newScript.src = oldScript.src;
                    } else {
                        newScript.textContent = oldScript.textContent;
                    }
                    
                    document.body.appendChild(newScript);
                });
                
                // Прячем загрузку и показываем калькулятор
                document.getElementById('loading').classList.add('hidden');
                document.getElementById('calculatorContainer').style.display = 'block';
                
                // Сообщаем Битрикс24 о необходимости подогнать высоту
                if (typeof BX24 !== 'undefined') {
                    BX24.init(function() {
                        BX24.resizeWindow();
                    });
                }
                
            } catch (error) {
                console.error('Ошибка загрузки калькулятора:', error);
                document.getElementById('loading').innerHTML = `
                    <div class="loading-content" style="color: #d32f2f;">
                        <span>Ошибка загрузки калькулятора. <button onclick="location.reload()">Повторить</button></span>
                    </div>
                `;
            }
        }
        
        // Запускаем загрузку
        loadCalculator();
    </script>
</body>
</html>
