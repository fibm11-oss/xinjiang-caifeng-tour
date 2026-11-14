// 服務工作線程 - PWA 支援
// 快取策略：所有請求（含 CSS/JS/圖片）一律「網路優先、失敗才回快取」，
//    在線時順手把新版本寫回快取，離線瀏覽仍可用，不會再被舊快取卡住。
//    改動 css/*.css 或 js/*.js 仍建議 bump CACHE_NAME：activate 會清掉舊版本
//    快取桶、避免磁碟上堆積歷代舊檔；但已不影響使用者能否看到新內容。
const CACHE_NAME = 'xjcaifeng-v1.2.31';
const urlsToCache = [
    '/',
    '/index.html',
    '/routes.html',
    '/car-rental.html',
    '/contact.html',
    '/itinerary.html',
    '/manifest.json',
    '/css/style.css',
    '/js/app.js',
    '/js/promotion.js',
    '/js/booking.js',
    '/js/sitemap.js',
    '/js/nav.js',
    '/images/favicon.svg',
    '/images/favicon-192.png',
    '/images/favicon-512.png',
    '/images/icon-192.png',
    '/images/icon-512.png',
    '/images/hero-xinjiang.svg',
    '/images/hero-car.svg',
    '/images/hero-routes.svg',
    '/images/logo.svg',
    '/images/og-image.svg',
    '/images/scenic/sayram-lake.svg',
    '/images/scenic/nalati.svg',
    '/images/scenic/kashgar.svg',
    '/images/scenic/tianchi.svg',
    '/images/scenic/duku.svg',
    '/images/scenic/karakul.svg',
    '/images/scenic/taklamakan.svg',
    '/images/scenic/bazaar.svg',
    '/images/tours/tour1-ili-10days.svg',
    '/images/tours/tour2-grassland.svg',
    '/images/tours/tour3-south-xj.svg',
    '/images/tours/tour4-kanas.svg',
    '/blog/index.html',
    '/blog/xinjiang-four-seasons.html',
    '/blog/xinjiang-travel-guide.html',
    '/blog/beijiang-vs-nanjiang.html',
    '/blog/dubai-gonglu-guide.html',
    '/blog/urumqi-citywalk.html',
    '/blog/yining-citywalk.html',
    '/blog/burqin-citywalk.html',
    '/images/photos/duku-road-winter.webp'
];

// 安裝服務工作線程
self.addEventListener('install', function(event) {
    self.skipWaiting(); // 新版本就緒立即接管，避免舊 SW 繼續服務舊頁面
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                // 容錯：單一資源 404 不應讓整個 SW 安裝失敗
                return Promise.all(urlsToCache.map(function(url) {
                    return cache.add(url).catch(function() { return Promise.resolve(); });
                }));
            })
    );
});

// 攔截網路請求
// 頁面導航一律「網路優先」，確保改完頁面直接刷新就能看到最新內容，
// 不再被舊版快取卡住；離線時才回退到已快取的首頁。
// 其餘靜態資源（CSS/JS/圖片）同樣改為「網路優先、失敗回快取」：
// 已註冊舊 SW 的瀏覽器（尤其本機預覽）不會再長期吃到數月前的舊 JS/CSS，
// 連線時順手把新版本寫回快取，離線瀏覽仍完全可用。
self.addEventListener('fetch', function(event) {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(function() {
                return caches.match('/').then(function(r) {
                    return r || Response.error();
                });
            })
        );
        return;
    }
    event.respondWith(
        fetch(event.request)
            .then(function(response) {
                if (response && response.ok && response.type === 'basic') {
                    var copy = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        return cache.put(event.request, copy);
                    }).catch(function() {});
                }
                return response;
            })
            .catch(function() {
                return caches.match(event.request).then(function(r) {
                    return r || Response.error();
                });
            })
    );
});

// 更新快取
self.addEventListener('activate', function(event) {
    event.waitUntil(
        self.clients.claim().then(function() {
            return caches.keys().then(function(cacheNames) {
                return Promise.all(
                    cacheNames.map(function(cacheName) {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            });
        })
    );
});
