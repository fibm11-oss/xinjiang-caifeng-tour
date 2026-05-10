// 服務工作線程 - PWA 支援
const CACHE_NAME = 'xjcaifeng-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/routes.html',
    '/car-rental.html',
    '/contact.html',
    '/css/style.css',
    '/css/style.min.css',
    '/js/sitemap.js',
    '/images/favicon.svg'
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

// 攔截網路請求
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // 如果在快取中找到，回傳快取版本
                if (response) {
                    return response;
                }
                // 否則從網路獲取
                return fetch(event.request);
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
});</content>
<parameter name="filePath">c:\Users\tivol\Desktop\旅遊網站\sw.js