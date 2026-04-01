/**
 * POU AR SOLO - Service Worker
 * Caches core files for offline support
 */

const CACHE_NAME = 'pou-ar-solo-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/engine.js',
    '/minigames.js',
    '/game.js',
    '/manifest.json'
];

const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Try to cache CDN assets (may fail due to CORS)
                return caches.open(CACHE_NAME + '-cdn')
                    .then((cdnCache) => {
                        console.log('[SW] Caching CDN assets');
                        return Promise.allSettled(
                            CDN_ASSETS.map(url => 
                                fetch(url, { mode: 'no-cors' })
                                    .then(response => cdnCache.put(url, response))
                                    .catch(err => console.log('[SW] Failed to cache:', url))
                            )
                        );
                    });
            })
            .then(() => self.skipWaiting())
            .catch((err) => console.error('[SW] Cache failed:', err))
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name.startsWith('pou-ar-solo-') && name !== CACHE_NAME && name !== CACHE_NAME + '-cdn')
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') return;
    
    // Skip chrome-extension requests
    if (url.protocol === 'chrome-extension:') return;
    
    // Strategy: Cache First for static assets, Network First for API calls
    if (STATIC_ASSETS.includes(url.pathname) || CDN_ASSETS.includes(request.url)) {
        // Cache First
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached response and update in background
                        fetch(request)
                            .then((networkResponse) => {
                                if (networkResponse.ok) {
                                    caches.open(CACHE_NAME)
                                        .then((cache) => cache.put(request, networkResponse));
                                }
                            })
                            .catch(() => {});
                        
                        return cachedResponse;
                    }
                    
                    // Not in cache, fetch from network
                    return fetch(request)
                        .then((networkResponse) => {
                            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                                return networkResponse;
                            }
                            
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(request, responseToCache));
                            
                            return networkResponse;
                        });
                })
                .catch(() => {
                    // Network failed, try to return fallback
                    if (request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                })
        );
    } else {
        // Network First for other requests
        event.respondWith(
            fetch(request)
                .catch(() => caches.match(request))
        );
    }
});

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
