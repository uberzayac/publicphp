// data.js
const API_URL = 'https://script.google.com/macros/s/AKfycbxFdnzxe6BGlbNFj6KG71gG8XVie6rdAzx45IJ59IqDlvXLTclXjJGRy6qI8mBZ421UAA/exec';

const CACHE_KEY = 'print_calc_cache';
const CACHE_TTL = 1 * 60 * 1000; // 1 час

// Полная база материалов с ценами за лист А3 в зависимости от плотности
export const MATERIALS_DB = [
    { 
        id: 'offset', 
        name: 'Офсет бумага', 
        densities: [
            { value: 80, price: 6.32 },
            { value: 160, price: 10.00 }
        ]
    },
    { 
        id: 'coated', 
        name: 'Мелованная бумага', 
        densities: [
            { value: 125, price: 11.20 },
            { value: 150, price: 12.48 },
            { value: 200, price: 16.67 },
            { value: 250, price: 21.22 },
            { value: 300, price: 23.47 },
            { value: 350, price: 26.11 }
        ]
    },
    { 
        id: 'cardboard', 
        name: 'Картон мелованный', 
        densities: [
            { value: 300, price: 43.42 }
        ]
    },
    { 
        id: 'linen', 
        name: 'Лён', 
        densities: [
            { value: 300, price: 61.69 }
        ]
    },
    { 
        id: 'majestic', 
        name: 'Majestic светлый', 
        densities: [
            { value: 290, price: 92.15 }
        ]
    },
    { 
        id: 'touch', 
        name: 'Touch cover светлый (plike)', 
        densities: [
            { value: 301, price: 132.10 }
        ]
    },
    { 
        id: 'kraft', 
        name: 'Крафт', 
        densities: [
            { value: 350, price: 62.50 }
        ]
    },
    { 
        id: 'colorcopy', 
        name: 'Колор копи', 
        densities: [
            { value: 90, price: 7.31 },
            { value: 300, price: 30.07 },
            { value: 350, price: 32.06 },
            { value: 400, price: 36.55 }
        ]
    }
];

export async function loadData() {
    console.log('loadData вызван');
    
    try {
        // Пытаемся загрузить данные из Google Sheets
        console.log('Запрос к API:', API_URL);
        
        const res = await fetch(API_URL);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const json = await res.json();
        
        if (!json.success) {
            throw new Error(json.error || 'Ошибка загрузки данных');
        }

        // Сортировка по убыванию min
        if (json.prices && json.prices.length) {
            json.prices.sort((a, b) => b.min - a.min);
        }
        
        if (json.laminationPrices && json.laminationPrices.length) {
            json.laminationPrices.sort((a, b) => b.min - a.min);
        }

        // Используем нашу базу материалов с ценами
        json.materials = MATERIALS_DB;

        console.log('Данные успешно загружены с сервера');
        return json;
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        
        // В случае ошибки возвращаем минимальные данные для работы
        return {
            success: true,
            formats: [
                { name: 'А3' },
                { name: 'А4' },
                { name: 'А5' },
                { name: 'А6' }
            ],
            materials: MATERIALS_DB,
            laminationTypes: [
                'без ламинации',
                'глянцевая 32',
                'матовая 32',
                'глянцевая 75',
                'матовая 75',
                'глянцевая 125',
                'матовая 125',
                'soft touch'
            ],
            laminationPrices: json?.laminationPrices || [],
            prices: json?.prices || [],
            scoringPrice: json?.scoringPrice || 10,
            foldingPrice: json?.foldingPrice || 8
        };
    }
}