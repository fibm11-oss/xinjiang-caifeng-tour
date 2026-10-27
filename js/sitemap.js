/* 網站地圖 */
const siteMap = {
    '/': {
        title: '新疆采風 - 首頁',
        description: '專業新疆包車旅遊服務',
        keywords: ['新疆旅遊', '包車', '深度旅遊']
    },
    '/routes.html': {
        title: '推薦行程 - 新疆采風',
        description: '精選新疆最經典路線',
        keywords: ['新疆行程', '旅遊路線', '包車行程']
    },
    '/car-rental.html': {
        title: '包車服務 - 新疆采風',
        description: '專業司機・舒適車輛・全程無憂',
        keywords: ['包車服務', '新疆包車', '旅遊用車']
    },
    '/contact.html': {
        title: '聯絡我們 - 新疆采風',
        description: '有任何問題歡迎聯絡',
        keywords: ['聯絡方式', '諮詢', '新疆旅遊諮詢']
    },
    '/itinerary.html': {
        title: '行程範例 - 新疆采風',
        description: '三個真實行程範例：北疆大環線17日、北疆經典11日、北疆＋伊犁＋獨庫16日，含航班、每日路線與車程統計',
        keywords: ['行程範例', '北疆旅遊', '新疆行程']
    },
    '/itinerary-loop17.html': {
        title: '北疆大環線 17 日（2027/05/29 – 06/14） - 新疆采風',
        description: 'S21沙漠公路、喀納斯三灣、禾木晨霧、魔鬼城、賽里木湖、伊昭與獨庫公路、那拉提、吐魯番，16天環線不回頭',
        keywords: ['北疆大環線', '新疆自駕', '喀納斯', '獨庫公路']
    },
    '/itinerary-classic11.html': {
        title: '北疆經典 11 日（2026/06/21 – 07/01） - 新疆采風',
        description: '阿勒泰、禾木村、喀納斯、伊犁草原、獨庫公路與烏魯木齊，深入北疆的11天完整旅程',
        keywords: ['北疆經典', '北疆深度遊', '新疆包車']
    },
    '/itinerary-selfdrive16.html': {
        title: '北疆＋伊犁＋獨庫 16 日（2027/06/10 – 06/25） - 新疆采風',
        description: 'S21、喀納斯三灣、禾木晨霧、魔鬼城、賽里木湖環湖、伊昭公路、昭蘇天馬、那拉提空中草原、獨庫北段與吐魯番，附避坑指南',
        keywords: ['伊犁', '昭蘇', '那拉提', '賽里木湖', '伊昭公路']
    }
};

/* 動態更新頁面標題和描述 */
function updateMetaTags(path) {
    const page = siteMap[path];
    if (page) {
        document.title = page.title;
        const description = document.querySelector('meta[name="description"]');
        if (description) {
            description.setAttribute('content', page.description);
        }
        const keywords = document.querySelector('meta[name="keywords"]');
        if (keywords) {
            keywords.setAttribute('content', page.keywords.join(', '));
        }
    }
}

/* 預載入重要頁面 */
function preloadCriticalPages() {
    const criticalPages = ['/routes.html', '/contact.html'];
    criticalPages.forEach(page => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = page;
        document.head.appendChild(link);
    });
}

/* 服務工作線程註冊（PWA 支援） */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker 註冊成功');
            })
            .catch(function(error) {
                console.log('ServiceWorker 註冊失敗:', error);
            });
    });
}
