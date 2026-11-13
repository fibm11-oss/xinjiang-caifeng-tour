// 服務工作線程 - PWA 支援
// ⚠️ 重要規矩：靜態資源走「快取優先」(cache-first)，改動 css/*.css 或 js/*.js 後
//    必須 bump 這個 CACHE_NAME，否則線上用戶會繼續拿到舊快取、改動看不到。
//    bump 後 install 會重新快取最新檔案，activate 會清掉舊版本快取。
const CACHE_NAME = 'xjcaifeng-v1.2.11';
const urlsToCache = [
    '/',
    '/index.html',
    '/routes.html',
    '/car-rental.html',
    '/contact.html',
    '/about.html',
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
// 頁面導航（navigate）一律「網路優先」，確保改完頁面直接刷新就能看到最新內容，
// 不再被舊版快取卡住；離線時才回退到已快取的首頁。
// 其餘靜態資源（CSS/JS/圖片）維持快取優先，支援離線瀏覽。
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
        caches.match(event.request)
            .then(function(response) {
                return response || fetch(event.request).catch(function() {
                    return Response.error();
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
