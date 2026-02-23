// ui.js
import { calculate, getPrintPricePerSheet, getLaminationPricePerSheet, getMaterialPrice, SRA3, GAP, NON_LAMINATED_MATERIALS, SRA3_PLUS_MATERIALS } from './calc.js';
import { loadData } from './data.js';

let DATA;
const MINIMUM_ORDER_COST = 950;
const DELIVERY_PRODUCT_ID = 5208; // ID товара для доставки

// Функция для получения параметра из URL
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Функция для расчета веса заказа
function calculateOrderWeight(sheetsCount, density) {
    if (!sheetsCount || !density || sheetsCount <= 0 || density <= 0) return 0;
    // Формула: количество листов * плотность * 0.145
    // Результат в граммах
    return sheetsCount * density * 0.145;
}

// Функция для форматирования веса
function formatWeight(grams) {
    if (grams < 1000) {
        return `${Math.round(grams)} г`;
    } else {
        const kg = grams / 1000;
        return `${kg.toFixed(2)} кг`;
    }
}

export async function initUI(data) {
    console.log('initUI вызван');
    DATA = data;
    
    const loadingEl = document.getElementById('loading');
    const resultsEl = document.getElementById('results');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (resultsEl) resultsEl.style.display = 'block';
    
    initSelects();
    initDensityOptions();
    bindUI();
    
    setTimeout(() => {
        const materialSelect = document.getElementById('materialSelect');
        if (materialSelect && materialSelect.options.length > 0) {
            updateDensityOptions(materialSelect.value);
        }
        recalc();
    }, 100);
    
    updateLastUpdateTime();
    
    console.log('Интерфейс инициализирован');
}

function initSelects() {
    const formatSelect = document.getElementById('formatSelect');
    if (formatSelect && DATA.formats) {
        formatSelect.innerHTML = '';
        
        DATA.formats.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.name;
            opt.textContent = f.name;
            formatSelect.appendChild(opt);
        });
        
        const customOpt = document.createElement('option');
        customOpt.value = 'custom';
        customOpt.textContent = 'Свой формат';
        formatSelect.appendChild(customOpt);
        
        if (formatSelect.options.length > 0) formatSelect.selectedIndex = 0;
    }

    // Инициализируем материалы из DATA
    updateMaterialSelect(DATA.materials);

    const lamSelect = document.getElementById('laminationSelect');
    if (lamSelect && DATA.laminationTypes) {
        lamSelect.innerHTML = '';
        DATA.laminationTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            lamSelect.appendChild(opt);
        });
        if (lamSelect.options.length > 0) lamSelect.selectedIndex = 0;
    }
}

// Функция для обновления выпадающего списка материалов
function updateMaterialSelect(materialsArray) {
    const materialSelect = document.getElementById('materialSelect');
    if (!materialSelect) return;
    
    materialSelect.innerHTML = '';
    materialsArray.forEach((m, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = m.name;
        materialSelect.appendChild(opt);
    });
    if (materialSelect.options.length > 0) {
        materialSelect.selectedIndex = 0;
    }
}

function initDensityOptions() {
    const densityContainer = document.getElementById('densityContainer');
    if (densityContainer) {
        densityContainer.innerHTML = '<span style="color: #999; padding: 5px;">Загрузка...</span>';
    }
}

function updateDensityOptions(materialIndex) {
    const densityContainer = document.getElementById('densityContainer');
    if (!densityContainer) return;
    
    // Определяем, какие материалы сейчас используются
    const materialSelect = document.getElementById('materialSelect');
    const currentMaterials = materialSelect._materialsArray || DATA.materials;
    const material = currentMaterials[materialIndex];
    
    if (!material) return;
    
    densityContainer.innerHTML = '';
    
    if (material.densities && material.densities.length > 0) {
        material.densities.forEach((density, idx) => {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'density';
            radio.value = density.value;
            if (idx === 0) radio.checked = true;
            
            label.appendChild(radio);
            label.appendChild(document.createTextNode(` ${density.value} г/м²`));
            densityContainer.appendChild(label);
        });
        
        setTimeout(() => recalc(), 10);
    } else {
        densityContainer.innerHTML = '<span style="color: #999; padding: 5px;">Нет вариантов плотности</span>';
    }
}

function bindUI() {
    const formatSelect = document.getElementById('formatSelect');
    if (formatSelect) {
        formatSelect.removeEventListener('change', handleFormatChange);
        formatSelect.addEventListener('change', handleFormatChange);
    }
    
    const materialSelect = document.getElementById('materialSelect');
    if (materialSelect) {
        materialSelect.removeEventListener('change', handleMaterialChange);
        materialSelect.addEventListener('change', handleMaterialChange);
    }
    
    document.addEventListener('change', function(e) {
        if (e.target.name === 'density' || 
            e.target.name === 'colorMatching' ||
            e.target.id === 'layoutsCount' ||
            e.target.id === 'scoringSelect' ||
            e.target.id === 'foldingSelect' ||
            e.target.id === 'gluingSelect' ||
            e.target.id === 'cuttingSelect' ||
            e.target.id === 'deliveryInput' ||
            e.target.id === 'discountInput') {
            recalc();
        }
    });
    
    document.addEventListener('input', function(e) {
        if (e.target.id === 'layoutsCount' ||
            e.target.id === 'deliveryInput' ||
            e.target.id === 'discountInput') {
            recalc();
        }
    });
    
    const customWidth = document.getElementById('customWidth');
    const customHeight = document.getElementById('customHeight');
    if (customWidth) {
        customWidth.removeEventListener('input', recalc);
        customWidth.addEventListener('input', recalc);
    }
    if (customHeight) {
        customHeight.removeEventListener('input', recalc);
        customHeight.addEventListener('input', recalc);
    }
    
    document.querySelectorAll('input:not(#customWidth):not(#customHeight):not(#layoutsCount):not(#deliveryInput):not(#discountInput), select:not(#formatSelect):not(#materialSelect):not(#cuttingSelect)').forEach(el => {
        el.removeEventListener('change', recalc);
        el.removeEventListener('input', recalc);
        el.addEventListener('change', recalc);
        el.addEventListener('input', recalc);
    });

    const saveLocalBtn = document.getElementById('saveLocalBtn');
    if (saveLocalBtn) {
        saveLocalBtn.removeEventListener('click', handleLocalSave);
        saveLocalBtn.addEventListener('click', handleLocalSave);
    }
    
    const saveBitrixBtn = document.getElementById('saveBitrixBtn');
    if (saveBitrixBtn) {
        saveBitrixBtn.removeEventListener('click', handleBitrixSave);
        saveBitrixBtn.addEventListener('click', handleBitrixSave);
    }
    
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
        addProductBtn.removeEventListener('click', handleAddProduct);
        addProductBtn.addEventListener('click', handleAddProduct);
    }
}

function handleMaterialChange() {
    const materialSelect = document.getElementById('materialSelect');
    updateDensityOptions(materialSelect.value);
    recalc();
}

function handleFormatChange() {
    const formatSelect = document.getElementById('formatSelect');
    const customSizeGroup = document.getElementById('customSizeGroup');
    const fitInfo = document.getElementById('fitInfo');
    const customSizeError = document.getElementById('customSizeError');
    
    if (formatSelect.value === 'custom') {
        customSizeGroup.classList.remove('hidden');
    } else {
        customSizeGroup.classList.add('hidden');
        customSizeError.style.display = 'none';
    }
    
    recalc();
}

async function handleLocalSave() {
    try {
        const totalEl = document.getElementById('totalEl');
        if (!totalEl || totalEl.textContent === '0 руб.') {
            alert('Сначала выполните расчет!');
            recalc();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const screenshotBase64 = await createScreenshot();
        downloadScreenshot(screenshotBase64, getClientName());
        showNotification('Скриншот сохранен на ПК', 'success');
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    }
}

async function handleBitrixSave() {
    try {
        const dealId = await requestDealId();
        if (!dealId) {
            alert('Сохранение отменено: не указан ID сделки');
            return;
        }

        const totalEl = document.getElementById('totalEl');
        if (!totalEl || totalEl.textContent === '0 руб.') {
            alert('Сначала выполните расчет!');
            recalc();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        showLoadingIndicator('Сохранение скриншота в Б24...');
        const screenshotBase64 = await createScreenshot();
        
        const result = await sendToBitrix24(screenshotBase64, dealId);
        
        if (result && result.success) {
            showNotification(`Скриншот отправлен в сделку #${dealId}`, 'success');
        } else {
            throw new Error(result?.error || 'Неизвестная ошибка');
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    } finally {
        hideLoadingIndicator();
    }
}

// Функция для получения ID товара по умолчанию в зависимости от формата
function getDefaultProductId(format) {
    const productIds = {
        'А3': 5206,
        'A3': 5206,
        'А4': 5204,
        'A4': 5204,
        'А5': 5202,
        'A5': 5202,
        'А6': 5200,
        'A6': 5200,
        'custom': 5198
    };
    
    return productIds[format] || 5198;
}

// Функция для добавления товара в сделку
async function handleAddProduct() {
    try {
        const formatSelectEl = document.getElementById('formatSelect');
        const selectedFormat = formatSelectEl.value;
        const deliveryInput = document.getElementById('deliveryInput');
        const deliveryCost = parseFloat(deliveryInput?.value) || 0;
        
        // Запрашиваем ID сделки и ID товара с автоподстановкой
        const { dealId, productId } = await requestDealAndProductId(selectedFormat);
        if (!dealId || !productId) {
            return;
        }

        // Проверяем, есть ли результаты расчета
        const totalEl = document.getElementById('totalEl');
        const perPieceEl = document.getElementById('perPieceEl');
        const circulationInput = document.getElementById('circulationInput');
        
        if (!totalEl || totalEl.textContent === '0 руб.' || !perPieceEl || perPieceEl.textContent === '0.00 руб.') {
            alert('Сначала выполните расчет!');
            recalc();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Получаем результат расчета
        const materialSelect = document.getElementById('materialSelect');
        const laminationSelect = document.getElementById('laminationSelect');
        const cuttingSelect = document.getElementById('cuttingSelect');
        const scoringSelect = document.getElementById('scoringSelect');
        const foldingSelect = document.getElementById('foldingSelect');
        const gluingSelect = document.getElementById('gluingSelect');
        const printTypeRadios = document.querySelectorAll('input[name="printType"]');
        const colorMatchingRadios = document.querySelectorAll('input[name="colorMatching"]');
        const layoutsCountInput = document.getElementById('layoutsCount');
        const customWidth = document.getElementById('customWidth');
        const customHeight = document.getElementById('customHeight');
        const discountInput = document.getElementById('discountInput');
        
        const densityRadios = document.querySelectorAll('input[name="density"]');
        let selectedDensity = null;
        for (let radio of densityRadios) {
            if (radio.checked) {
                selectedDensity = parseFloat(radio.value);
                break;
            }
        }
        
        const materialIndex = materialSelect.value;
        // Используем правильный массив материалов
        const currentMaterials = materialSelect._materialsArray || DATA.materials;
        const material = currentMaterials[materialIndex];
        
        const input = {
            format: formatSelectEl.value,
            customWidth: parseFloat(customWidth?.value) || 0,
            customHeight: parseFloat(customHeight?.value) || 0,
            circulation: parseInt(circulationInput.value) || 1,
            colorMode: Array.from(printTypeRadios).find(r => r.checked)?.value || '40',
            material: material,
            density: selectedDensity,
            lamination: laminationSelect.value,
            cuttingType: cuttingSelect?.value || 'none',
            scoringCount: parseInt(scoringSelect?.value) || 0,
            foldingCount: parseInt(foldingSelect?.value) || 0,
            gluingCount: parseInt(gluingSelect?.value) || 0,
            deliveryCost: deliveryCost,
            discountPercent: parseFloat(discountInput?.value) || 0,
            colorMatching: Array.from(colorMatchingRadios).find(r => r.checked)?.value || 'no',
            layoutsCount: parseInt(layoutsCountInput?.value) || 1,
            prices: DATA.prices,
            laminationPrices: DATA.laminationPrices,
            scoringPrice: DATA.scoringPrice || 10,
            foldingPrice: DATA.foldingPrice || 8
        };

        const result = calculate(input, DATA);
        
        // Получаем цену за штуку БЕЗ доставки (используем discountedTotal)
        const quantity = parseInt(circulationInput.value) || 1;
        const priceWithoutDelivery = result.discountedTotal / quantity;
        
        if (isNaN(priceWithoutDelivery) || priceWithoutDelivery <= 0) {
            throw new Error('Некорректная цена за штуку');
        }

        showLoadingIndicator('Добавление товара в сделку...');
        
        // Добавляем основной товар в сделку (без учета доставки)
        const result1 = await addProductToDeal(dealId, productId, quantity, priceWithoutDelivery);
        
        if (!result1 || !result1.success) {
            throw new Error(result1?.error || 'Ошибка при добавлении основного товара');
        }
        
        // Если есть доставка, добавляем товар доставки
        if (deliveryCost > 0) {
            const result2 = await addProductToDeal(dealId, DELIVERY_PRODUCT_ID, 1, deliveryCost);
            
            if (!result2 || !result2.success) {
                console.warn('Товар добавлен, но не удалось добавить доставку:', result2?.error);
                showNotification(`Товар добавлен в сделку #${dealId}, но доставка не добавилась`, 'warning');
            } else {
                showNotification(`Товар и доставка добавлены в сделку #${dealId}`, 'success');
            }
        } else {
            showNotification(`Товар добавлен в сделку #${dealId}`, 'success');
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification(`Ошибка: ${error.message}`, 'error');
    } finally {
        hideLoadingIndicator();
    }
}

// Функция для запроса ID сделки и ID товара с автоподстановкой из URL
function requestDealAndProductId(selectedFormat) {
    return new Promise((resolve) => {
        const defaultProductId = getDefaultProductId(selectedFormat);
        const urlDealId = getUrlParameter('deal_id'); // Получаем ID из URL
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 20000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                max-width: 400px;
                width: 90%;
            ">
                <h3 style="margin-top: 0; color: #333;">Добавление товара в сделку</h3>
                <p style="color: #666; margin-bottom: 20px;">Введите ID сделки и ID товара:</p>
                
                <label style="display: block; margin-bottom: 5px; color: #555; font-weight: bold;">ID сделки:</label>
                <input type="number" id="dealIdInput" style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #ddd;
                    border-radius: 5px;
                    font-size: 16px;
                    margin-bottom: 15px;
                    box-sizing: border-box;
                " placeholder="Например: 12345" value="${urlDealId || ''}">
                
                <label style="display: block; margin-bottom: 5px; color: #555; font-weight: bold;">ID товара:</label>
                <input type="number" id="productIdInput" style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #ddd;
                    border-radius: 5px;
                    font-size: 16px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                " placeholder="Например: 5204" value="${defaultProductId}">
                
                <div style="display: flex; gap: 10px;">
                    <button id="submitBtn" style="
                        flex: 2;
                        padding: 12px;
                        background: #2196F3;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        font-size: 16px;
                        cursor: pointer;
                    ">Добавить</button>
                    <button id="cancelBtn" style="
                        flex: 1;
                        padding: 12px;
                        background: #f44336;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        font-size: 16px;
                        cursor: pointer;
                    ">Отмена</button>
                </div>
                <p style="color: #999; font-size: 12px; margin-top: 10px;">* ID товара подобран автоматически</p>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        setTimeout(() => {
            const input = document.getElementById('dealIdInput');
            if (input.value) {
                document.getElementById('productIdInput').focus();
            } else {
                input.focus();
            }
        }, 100);
        
        document.getElementById('submitBtn').addEventListener('click', () => {
            const dealInput = document.getElementById('dealIdInput');
            const productInput = document.getElementById('productIdInput');
            const dealId = dealInput.value.trim();
            const productId = productInput.value.trim();
            
            if (dealId && productId) {
                document.body.removeChild(modal);
                resolve({ dealId, productId });
            } else {
                if (!dealId) {
                    dealInput.style.borderColor = '#f44336';
                    setTimeout(() => dealInput.style.borderColor = '#ddd', 300);
                }
                if (!productId) {
                    productInput.style.borderColor = '#f44336';
                    setTimeout(() => productInput.style.borderColor = '#ddd', 300);
                }
            }
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve({ dealId: null, productId: null });
        });
        
        // Обработка Enter
        const dealInput = document.getElementById('dealIdInput');
        const productInput = document.getElementById('productIdInput');
        
        dealInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                productInput.focus();
            }
        });
        
        productInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('submitBtn').click();
            }
        });
    });
}

// Функция для запроса ID сделки с автоподстановкой из URL
function requestDealId() {
    return new Promise((resolve) => {
        const urlDealId = getUrlParameter('deal_id'); // Получаем ID из URL
        
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 20000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                max-width: 400px;
                width: 90%;
            ">
                <h3 style="margin-top: 0; color: #333;">Сохранение скриншота в Б24</h3>
                <p style="color: #666; margin-bottom: 20px;">Введите ID сделки:</p>
                <input type="number" id="dealIdInput" style="
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #ddd;
                    border-radius: 5px;
                    font-size: 16px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                " placeholder="Например: 12345" value="${urlDealId || ''}">
                <div style="display: flex; gap: 10px;">
                    <button id="submitDealId" style="
                        flex: 2;
                        padding: 12px;
                        background: #2196F3;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        font-size: 16px;
                        cursor: pointer;
                    ">Отправить</button>
                    <button id="cancelDealId" style="
                        flex: 1;
                        padding: 12px;
                        background: #f44336;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        font-size: 16px;
                        cursor: pointer;
                    ">Отмена</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        setTimeout(() => {
            const input = document.getElementById('dealIdInput');
            if (input.value) {
                document.getElementById('submitDealId').focus();
            } else {
                input.focus();
            }
        }, 100);
        
        document.getElementById('submitDealId').addEventListener('click', () => {
            const input = document.getElementById('dealIdInput');
            const dealId = input.value.trim();
            if (dealId) {
                document.body.removeChild(modal);
                resolve(dealId);
            } else {
                input.style.borderColor = '#f44336';
                setTimeout(() => input.style.borderColor = '#ddd', 300);
            }
        });
        
        document.getElementById('cancelDealId').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(null);
        });
        
        const input = document.getElementById('dealIdInput');
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('submitDealId').click();
            }
        });
    });
}

// Функция для добавления товара в сделку через Битрикс24 (crm.item.productrow.add)
async function addProductToDeal(dealId, productId, quantity, price) {
    try {
        const webhookUrl = "https://gvprint.bitrix24.ru/rest/10/33sjwnbap09wrl0j/";
        
        // Формируем данные для добавления товарной позиции
        const requestData = {
            fields: {
                ownerId: parseInt(dealId),
                ownerType: 'D',
                productId: parseInt(productId),
                price: price,
                quantity: quantity,
                currencyId: 'RUB'
            }
        };
        
        console.log('Отправка товарной позиции (crm.item.productrow.add):', requestData);
        
        const response = await fetch(webhookUrl + 'crm.item.productrow.add.json', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Ответ от Битрикс24:', result);
        
        if (result.error) {
            throw new Error(result.error_description || result.error);
        }
        
        return { success: true, result };
        
    } catch (error) {
        console.error('Ошибка добавления товара:', error);
        throw error;
    }
}

// Функция для проверки, используется ли увеличенный формат
async function checkIfSRA3PlusUsed(input) {
    try {
        // Временный расчет для проверки формата
        const result = await calculate(input, DATA);
        return result.isSRA3Plus;
    } catch (error) {
        return false;
    }
}

function recalc() {
    try {
        const formatSelect = document.getElementById('formatSelect');
        const materialSelect = document.getElementById('materialSelect');
        const laminationSelect = document.getElementById('laminationSelect');
        const cuttingSelect = document.getElementById('cuttingSelect');
        const circulationInput = document.getElementById('circulationInput');
        const scoringSelect = document.getElementById('scoringSelect');
        const foldingSelect = document.getElementById('foldingSelect');
        const gluingSelect = document.getElementById('gluingSelect');
        const deliveryInput = document.getElementById('deliveryInput');
        const discountInput = document.getElementById('discountInput');
        const printTypeRadios = document.querySelectorAll('input[name="printType"]');
        const colorMatchingRadios = document.querySelectorAll('input[name="colorMatching"]');
        const layoutsCountInput = document.getElementById('layoutsCount');
        const customWidth = document.getElementById('customWidth');
        const customHeight = document.getElementById('customHeight');
        const fitInfo = document.getElementById('fitInfo');
        const customSizeError = document.getElementById('customSizeError');
        
        const densityRadios = document.querySelectorAll('input[name="density"]');
        let selectedDensity = null;
        for (let radio of densityRadios) {
            if (radio.checked) {
                selectedDensity = parseFloat(radio.value);
                break;
            }
        }
        
        if (!formatSelect || !materialSelect || !laminationSelect || !circulationInput) {
            console.error('Не найдены необходимые элементы формы');
            return;
        }
        
        if (!DATA || !DATA.materials) {
            console.error('Данные не загружены');
            return;
        }
        
        const materialIndex = materialSelect.value;
        const material = DATA.materials[materialIndex];
        
        if (!material) {
            console.error('Материал не найден');
            return;
        }
        
        // Скрываем ошибки по умолчанию
        if (customSizeError) customSizeError.style.display = 'none';
        
        const input = {
            format: formatSelect.value,
            customWidth: parseFloat(customWidth?.value) || 0,
            customHeight: parseFloat(customHeight?.value) || 0,
            circulation: parseInt(circulationInput.value) || 1,
            colorMode: Array.from(printTypeRadios).find(r => r.checked)?.value || '40',
            material: material,
            density: selectedDensity,
            lamination: laminationSelect.value,
            cuttingType: cuttingSelect?.value || 'none',
            scoringCount: parseInt(scoringSelect?.value) || 0,
            foldingCount: parseInt(foldingSelect?.value) || 0,
            gluingCount: parseInt(gluingSelect?.value) || 0,
            deliveryCost: parseFloat(deliveryInput?.value) || 0,
            discountPercent: parseFloat(discountInput?.value) || 0,
            colorMatching: Array.from(colorMatchingRadios).find(r => r.checked)?.value || 'no',
            layoutsCount: parseInt(layoutsCountInput?.value) || 1,
            prices: DATA.prices,
            laminationPrices: DATA.laminationPrices,
            scoringPrice: DATA.scoringPrice || 10,
            foldingPrice: DATA.foldingPrice || 8
        };

        const result = calculate(input, DATA);
        
        // Проверка на совместимость материала и ламинации (после расчета, чтобы получить isSRA3Plus)
        const isNonLaminated = NON_LAMINATED_MATERIALS.includes(material.name);
        const hasLamination = laminationSelect.value && !laminationSelect.value.toLowerCase().includes('без ламинации');
        
        if (isNonLaminated && hasLamination && !result.isSRA3Plus) {
            const errorMessage = `Материал "${material.name}" нельзя ламинировать`;
            if (customSizeError) {
                customSizeError.textContent = errorMessage;
                customSizeError.style.display = 'block';
            }
            if (fitInfo) fitInfo.style.display = 'none';
            clearResults();
            return;
        }
        
        // Если используется увеличенный формат, обновляем список материалов
        if (result.isSRA3Plus) {
            // Сохраняем текущий выбранный материал
            const currentMaterialIndex = materialSelect.value;
            
            // Обновляем select только для мелованной бумаги
            if (!materialSelect._isSRA3Plus) {
                materialSelect._materialsArray = SRA3_PLUS_MATERIALS;
                updateMaterialSelect(SRA3_PLUS_MATERIALS);
                materialSelect._isSRA3Plus = true;
                
                // Обновляем плотности для нового материала
                setTimeout(() => {
                    updateDensityOptions(0);
                }, 10);
            }
        } else {
            // Возвращаем стандартные материалы
            if (materialSelect._isSRA3Plus) {
                materialSelect._materialsArray = DATA.materials;
                updateMaterialSelect(DATA.materials);
                materialSelect._isSRA3Plus = false;
                
                // Восстанавливаем выбранный материал
                setTimeout(() => {
                    const savedIndex = DATA.materials.findIndex(m => m.name === material.name);
                    if (savedIndex >= 0) {
                        materialSelect.value = savedIndex;
                    }
                    updateDensityOptions(materialSelect.value);
                }, 10);
            }
        }
        
        // Обновляем информацию о размещении с учетом формата листа
        if (fitInfo && result.fitDetails && result.fitDetails.count > 0) {
            const sheetsNeeded = Math.ceil(input.circulation / result.fitDetails.count);
            fitInfo.innerHTML = `${result.fitDetails.cols} (по кор.) x ${result.fitDetails.rows} (по дл.) = ${result.fitDetails.count} на лист ${result.sheetSizeForDisplay} мм, ${sheetsNeeded} л.`;
            fitInfo.style.display = 'block';
        } else {
            fitInfo.style.display = 'none';
        }
        
        displayResults(result, input);
        
    } catch (error) {
        console.error('Ошибка расчета:', error);
        
        const customSizeError = document.getElementById('customSizeError');
        if (customSizeError) {
            customSizeError.textContent = error.message;
            customSizeError.style.display = 'block';
        }
        
        clearResults();
    }
}

function clearResults() {
    const elements = ['totalEl', 'perPieceEl', 'printCost', 'materialCost', 'laminationCost', 'cuttingCost', 'scoringCost', 'foldingCost', 'gluingCost', 'colorMatchingCost', 'layoutsCost', 'deliveryCost', 'discountAmount', 'weightValue'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'perPieceEl') el.textContent = '0.00 руб.';
            else if (id === 'weightValue') el.textContent = '0 г';
            else el.textContent = '0 руб.';
        }
    });
    
    const colorMatchingRow = document.getElementById('colorMatchingRow');
    if (colorMatchingRow) colorMatchingRow.style.display = 'none';
    
    const layoutsRow = document.getElementById('layoutsRow');
    if (layoutsRow) layoutsRow.style.display = 'none';
    
    const discountRow = document.getElementById('discountRow');
    if (discountRow) discountRow.style.display = 'none';
    
    const details = document.getElementById('details');
    if (details) details.innerHTML = '';
    
    const minimumCostMessage = document.getElementById('minimumCostMessage');
    if (minimumCostMessage) minimumCostMessage.style.display = 'none';
}

function displayResults(result, input) {
    const totalEl = document.getElementById('totalEl');
    const perPieceEl = document.getElementById('perPieceEl');
    const printCost = document.getElementById('printCost');
    const materialCost = document.getElementById('materialCost');
    const laminationCost = document.getElementById('laminationCost');
    const cuttingCost = document.getElementById('cuttingCost');
    const scoringCost = document.getElementById('scoringCost');
    const foldingCost = document.getElementById('foldingCost');
    const gluingCost = document.getElementById('gluingCost');
    const colorMatchingCost = document.getElementById('colorMatchingCost');
    const layoutsCost = document.getElementById('layoutsCost');
    const deliveryCost = document.getElementById('deliveryCost');
    const discountAmount = document.getElementById('discountAmount');
    const colorMatchingRow = document.getElementById('colorMatchingRow');
    const layoutsRow = document.getElementById('layoutsRow');
    const discountRow = document.getElementById('discountRow');
    const details = document.getElementById('details');
    const minimumCostMessage = document.getElementById('minimumCostMessage');
    const minimumCostValue = document.getElementById('minimumCostValue');
    const weightValue = document.getElementById('weightValue');
    
    // Расчет веса заказа - используем количество листов из результата
    const orderWeight = calculateOrderWeight(result.breakdown.sheets, input.density);
    const formattedWeight = formatWeight(orderWeight);
    
    if (totalEl) totalEl.textContent = formatCurrency(result.total);
    if (perPieceEl) perPieceEl.textContent = formatCurrencyWithCents(result.perPiece);
    
    if (printCost) printCost.textContent = formatCurrency(result.breakdown.printPrice);
    if (materialCost) materialCost.textContent = formatCurrency(result.breakdown.materialPrice);
    if (laminationCost) laminationCost.textContent = formatCurrency(result.breakdown.laminationPrice);
    if (cuttingCost) cuttingCost.textContent = formatCurrency(result.cuttingPrice);
    if (scoringCost) scoringCost.textContent = formatCurrency(result.scoringPrice);
    if (foldingCost) foldingCost.textContent = formatCurrency(result.foldingPrice);
    if (gluingCost) gluingCost.textContent = formatCurrency(result.gluingPrice);
    if (deliveryCost) deliveryCost.textContent = formatCurrency(result.deliveryCost);
    if (weightValue) weightValue.textContent = formattedWeight;
    
    if (colorMatchingCost) {
        if (result.colorMatchingPrice > 0) {
            colorMatchingCost.textContent = formatCurrency(result.colorMatchingPrice);
            if (colorMatchingRow) colorMatchingRow.style.display = 'flex';
        } else {
            if (colorMatchingRow) colorMatchingRow.style.display = 'none';
        }
    }
    
    if (layoutsCost) {
        if (result.layoutsPrice > 0) {
            layoutsCost.textContent = formatCurrency(result.layoutsPrice);
            if (layoutsRow) layoutsRow.style.display = 'flex';
        } else {
            if (layoutsRow) layoutsRow.style.display = 'none';
        }
    }
    
    if (discountAmount && discountRow) {
        if (input.discountPercent > 0) {
            discountAmount.textContent = formatCurrency(result.discountAmount);
            discountRow.style.display = 'flex';
        } else {
            discountRow.style.display = 'none';
        }
    }
    
    const printPlusMaterial = result.breakdown.printPrice + result.breakdown.materialPrice;
    const isMinimumApplied = printPlusMaterial < MINIMUM_ORDER_COST;
    
    if (minimumCostMessage && minimumCostValue) {
        if (isMinimumApplied) {
            minimumCostValue.textContent = formatCurrency(MINIMUM_ORDER_COST);
            minimumCostMessage.style.display = 'flex';
        } else {
            minimumCostMessage.style.display = 'none';
        }
    }
    
    if (details) {
        const material = input.material;
        const printTypeText = input.colorMode === '40' ? 'Односторонняя (4+0)' : 'Двусторонняя (4+4)';
        
        const printPricePerSheet = getPrintPricePerSheet(input.circulation, input.colorMode, input.prices);
        const laminationPricePerSheet = getLaminationPricePerSheet(input.circulation, input.lamination, input.laminationPrices);
        
        let detailsHTML = '';
        
        detailsHTML += `<p><strong>Тираж:</strong> ${input.circulation} шт.</p>`;
        detailsHTML += `<p><strong>Формат:</strong> ${escapeHtml(input.format === 'custom' ? 
            `${input.customWidth}×${input.customHeight} мм (свой)` : 
            input.format)}</p>`;
        
        if (result.isSRA3Plus) {
            detailsHTML += `<p><strong>Формат листа:</strong> 330×488 мм</p>`;
        }
        
        if (result.fitDetails && result.fitDetails.count > 0) {
            detailsHTML += `<p><strong>Размещение на листе:</strong> ${result.fitDetails.cols}×${result.fitDetails.rows} = ${result.fitDetails.count} шт.</p>`;
        }
        
        detailsHTML += `<p><strong>Количество листов:</strong> ${result.breakdown.sheets}</p>`;
        detailsHTML += `<p><strong>Вид печати:</strong> ${printTypeText}</p>`;
        
        // Отображаем информацию о материале (с учетом возможной смены для увеличенного формата)
        const displayMaterial = result.actualMaterial || material;
        detailsHTML += `<p><strong>Материал:</strong> ${escapeHtml(displayMaterial?.name || '—')} ${input.density ? `(${input.density} г/м²)` : ''}</p>`;
        
        detailsHTML += `<p><strong>Стоимость материала:</strong> ${formatCurrency(result.materialPricePerSheet)} × ${result.breakdown.sheets} = ${formatCurrency(result.breakdown.materialPrice)}</p>`;
        detailsHTML += `<p><strong>Стоимость печати:</strong> ${formatCurrency(printPricePerSheet)} × ${result.breakdown.sheets} = ${formatCurrency(result.breakdown.printPrice)}</p>`;
        
        if (input.lamination && !input.lamination.toLowerCase().includes('без ламинации') && result.breakdown.laminationPrice > 0) {
            detailsHTML += `<p><strong>Ламинация:</strong> ${escapeHtml(input.lamination)}</p>`;
            detailsHTML += `<p><strong>Стоимость ламинации:</strong> ${formatCurrency(laminationPricePerSheet)} × ${result.breakdown.sheets} = ${formatCurrency(result.breakdown.laminationPrice)}</p>`;
        } else {
            detailsHTML += `<p><strong>Ламинация:</strong> без ламинации</p>`;
        }
        
        // Информация о резке
        if (input.cuttingType !== 'none' && input.cuttingType !== 'plotter') {
            let cuttingDescription = '';
            if (input.cuttingType === 'guillotine_percent') {
                cuttingDescription = 'гильотина (10% от печати)';
            }
            detailsHTML += `<p><strong>Резка:</strong> ${cuttingDescription} = ${formatCurrency(result.cuttingPrice)}</p>`;
        }
        
        if (input.scoringCount > 0) {
            detailsHTML += `<p><strong>Биговка/Фальцовка:</strong> ${input.scoringCount} × ${input.circulation} × ${formatCurrency(result.scoringPricePerUnit)} = ${formatCurrency(result.scoringPrice)}</p>`;
        }
        
        if (input.foldingCount > 0) {
            detailsHTML += `<p><strong>Перфорация:</strong> ${input.foldingCount} × ${input.circulation} × ${formatCurrency(result.foldingPricePerUnit)} = ${formatCurrency(result.foldingPrice)}</p>`;
        }
        
        if (input.gluingCount > 0) {
            detailsHTML += `<p><strong>Склейка:</strong> ${input.gluingCount} × ${input.circulation} × ${formatCurrency(result.gluingPricePerUnit)} = ${formatCurrency(result.gluingPrice)}</p>`;
        }
        
        if (input.colorMatching === 'yes') {
            detailsHTML += `<p><strong>Подбор цвета:</strong> ${formatCurrency(result.colorMatchingPrice)}</p>`;
        }
        
        if (input.layoutsCount > 1) {
            detailsHTML += `<p><strong>Доплата за макеты:</strong> ${input.layoutsCount} × 145 = ${formatCurrency(result.layoutsPrice)}</p>`;
        }
        
        if (input.discountPercent > 0) {
            detailsHTML += `<p><strong>Скидка:</strong> ${input.discountPercent}% = ${formatCurrency(result.discountAmount)}</p>`;
        }
        
        if (input.deliveryCost > 0) {
            detailsHTML += `<p><strong>Доставка:</strong> ${formatCurrency(input.deliveryCost)}</p>`;
        }
        
        // Добавляем вес заказа в детали
        detailsHTML += `<p><strong>Вес заказа:</strong> ${formattedWeight}</p>`;
        
        if (isMinimumApplied) {
            detailsHTML += `<p style="color: #dc3545; font-style: italic; margin-top: 10px;">Минимальная стоимость печати: ${formatCurrency(MINIMUM_ORDER_COST)}</p>`;
        }
        
        details.innerHTML = detailsHTML;
    }
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С БИТРИКС24 ==========

function createScreenshot() {
    return new Promise((resolve, reject) => {
        const target = document.getElementById('calculator');
        
        if (!target) {
            reject(new Error('Не найден элемент для скриншота'));
            return;
        }
        
        html2canvas(target, { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: false
        })
        .then(canvas => {
            const base64 = canvas.toDataURL('image/png');
            resolve(base64);
        })
        .catch(error => {
            reject(new Error('Не удалось создать скриншот: ' + error.message));
        });
    });
}

async function sendToBitrix24(base64Image, dealId) {
    try {
        const response = await fetch('upload.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64Image,
                deal_id: dealId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Ответ от сервера:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Неизвестная ошибка');
        }
        
        return result;
        
    } catch (error) {
        console.error('Ошибка отправки:', error);
        throw error;
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function downloadScreenshot(base64Image, clientName) {
    const link = document.createElement('a');
    link.download = buildFileName(clientName);
    link.href = base64Image;
    link.click();
}

function getClientName() {
    return document.getElementById('clientInput')?.value.trim() || '';
}

function showLoadingIndicator(message = 'Загрузка...') {
    const indicator = document.createElement('div');
    indicator.id = 'bitrixLoadingIndicator';
    indicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255,255,255,0.9);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 30000;
    `;
    
    indicator.innerHTML = `
        <div style="
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #2196F3;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        "></div>
        <div style="color: #333; font-size: 18px;">${message}</div>
    `;
    
    document.body.appendChild(indicator);
}

function hideLoadingIndicator() {
    const indicator = document.getElementById('bitrixLoadingIndicator');
    if (indicator) {
        document.body.removeChild(indicator);
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    let bgColor = type === 'success' ? '#4CAF50' : '#f44336';
    if (type === 'warning') bgColor = '#FF9800';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 40000;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
        word-wrap: break-word;
    `;
    
    notification.innerHTML = `<strong>${message}</strong>`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

function buildFileName(clientName) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');

    if (clientName && clientName.trim() !== '') {
        const safeClient = clientName
            .trim()
            .replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return `${date}_${time}_${safeClient}.png`;
    } else {
        return `${date}_${time}.png`;
    }
}

function updateLastUpdateTime() {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        const now = new Date();
        lastUpdateEl.textContent = 'Данные обновлены: ' + now.toLocaleString('ru-RU');
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatCurrencyWithCents(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('ui.js загружен');

// Автоматическая инициализация
(async function() {
    try {
        console.log('Загрузка данных...');
        const data = await loadData();
        await initUI(data);
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        const loadingEl = document.getElementById('loading');
        const errorEl = document.getElementById('error');
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = 'Ошибка загрузки данных: ' + error.message;
        }
    }
})();