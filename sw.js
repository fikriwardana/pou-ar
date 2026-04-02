/**
 * POU AR SOLO - Service Worker
 * Caches core files for offline support
 */

const CACHE_NAME = 'pou-ar-solo-v1';
const STATIC_ASSETS = [
    { url: '/', hash: '' }, // Root doesn't need strict content hash
    { url: '/index.html', hash: '5ef33122119542c310614c71d203be66c54ee4afd6079e9f7e66937cdc02da3b6a4efa89dbf71a46713b1f5b76e8cc1f' },
    { url: '/style.css', hash: '8a796a6408cb18694680a73f2bddaeae3173454aa52967bfcdfd59dacdeaa29b4b0a0775053902d6519ce7c422bc2cb6' },
    { url: '/engine.js', hash: 'a445a25e8f24d6a99e75b5fdb729bf82fd3b3b188c94f39b4a94f47ff86c7d5741499956d1c1de09ba7c98454ea8aba2' },
    { url: '/minigames.js', hash: '390404d01b04a753a1f296140c4957531dc7f63dd8fa69941d16000873e63dca624852c2aa5b922a0bf51f1d61334619' },
    { url: '/game.js', hash: 'fb54446e09daaf9ad920b7040d3ed694cea879d2c206c08b0170d32bdd6af48b175caa7328a4834665eaca9bca039e94' },
    { url: '/manifest.json', hash: 'f3b17d28d9e3041ca7f125990dc4a110f21cc803c37042d3490bcafa10e099ca34731989c171207b01f910f3a718620f' }
];

const STATIC_URLS = STATIC_ASSETS.map(a => a.url);

const CDN_ASSETS = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

async function verifyAndCache(cache, asset) {
    if (!asset.hash) {
        return fetch(asset.url).then(response => cache.put(asset.url, response));
    }

    const response = await fetch(asset.url);
    const buffer = await response.clone().arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-384', buffer);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    if (hashHex !== asset.hash) {
        throw new Error(`Integrity check failed for ${asset.url}`);
    }

    return cache.put(asset.url, response);
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets with SRI validation');
                return Promise.all(STATIC_ASSETS.map(asset => verifyAndCache(cache, asset)));
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
    if (STATIC_URLS.includes(url.pathname) || CDN_ASSETS.includes(request.url)) {
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
