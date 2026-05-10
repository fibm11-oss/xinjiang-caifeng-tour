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
}</content>
<parameter name="filePath">c:\Users\tivol\Desktop\旅遊網站\js\sitemap.js