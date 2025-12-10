// public/sw.js (Service Worker)

const CACHE_NAME = 'couplechat-v1';
const urlsToCache = [
    '/',
    '/style.css',
    '/login-modal.css',
    '/scripts/ui.js',
    '/scripts/socketClient.js',
    '/images/app-icon-192.png',
    // Add other necessary assets (like gift images) here
];

// Install Event: Cache all necessary assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache and added URLs');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch Event: Serve from cache first, then network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // No cache hit - go to network
                return fetch(event.request);
            })
    );
});
                  
