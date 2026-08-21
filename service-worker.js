const CACHE_NAME = 'al-fawaz-pharma-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/cards.css',
    '/css/responsive.css',
    '/js/app.js',
    '/js/search.js',
    '/js/manufacturers.js',
    '/js/appsheet-connector.js',
    '/data/medicines.json',
    '/data/manufacturers.json',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    '/images/app-icon.png',
    'https://i.postimg.cc/W40RPcbD/ailled-logo.png',
    'https://i.postimg.cc/BbQRD85K/barakat-logo.png',
    'https://i.postimg.cc/85bqjd6m/celia-logo.png',
    'https://i.postimg.cc/rm9vKGrH/domina-logo.png',
    'https://i.postimg.cc/vTqkvQXN/happy-cur-logo.png',
    'https://i.postimg.cc/zBNsz2Vx/lama-logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Pre-caching Core Static Assets & Logos');
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[Service Worker] Pre-cache warning:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Fetch in background to update cache (stale-while-revalidate)
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                }).catch(() => {/* Ignore background fetch errors */});
                
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Fallback for document requests when offline
                if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
