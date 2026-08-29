// 服務工作線程 - PWA 支援
const CACHE_NAME = 'xjcaifeng-v1.1.0';
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
    '/js/quote.js',
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
    '/images/photos/anjihai-canyon.webp',
    '/images/photos/duku-road-summer.webp',
    '/images/photos/duku-road-winter.webp',
    '/images/photos/hemu-starry-night.webp'
];

// 安裝服務工作線程
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                return cache.addAll(urlsToCache);
            })
    );
});

// 攔截網路請求（快取優先，離線回退）
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                if (response) {
                    return response;
                }
                return fetch(event.request).catch(function() {
                    // 離線時回退到首頁
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                });
            }
        )
    );
});

// 更新快取
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
