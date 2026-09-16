const CACHE_NAME = 'codemini-static-v1.24.113.1';
const DYNAMIC_CACHE = 'codemini-dynamic-v1.23.46.1';


const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/themes.css',
    '/app.js',
    '/up-down.js',
    '/media.js',
    '/archive.js',
    '/docs.js',
    '/editor.js',
    '/search.js',
    '/stacks.js',
    '/now-island.js',
    '/notebook-kernels.js',
    '/notebook-ui.js',
    '/environments.js',
    '/preview.js',
    '/pdf-viewer.js',
    '/script.js',
    '/help-feedback.js',
    '/settings-profile.js',
    '/terminal-commands.js',
    '/terminal-window.js',
    '/console.js',
    '/preloader.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. External CDNs (Monaco, Pyodide, Fonts, Icons) -> CACHE FIRST, fallback to network
    if (url.origin !== location.origin) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                
                return fetch(event.request).then((networkResponse) => {
                    // Only cache valid, successful responses
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                }).catch(() => {
                    // Fail silently for offline
                });
            })
        );
        return;
    }

    // 2. Local Files -> NETWORK FIRST (cache: 'no-cache' forces revalidation with
    // the server on every request - a 304 lets the browser serve its own cached
    // copy efficiently if unchanged, a 200 delivers the fresh file if it has
    // changed. Deliberately NOT 'no-store', which is more aggressive than needed
    // here and more likely to cause edge-case failures on requests this same
    // origin-wide handler also intercepts.
    event.respondWith(
        fetch(event.request, { cache: 'no-cache' }).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache).catch(() => {});
                }).catch(() => {});
            }
            return networkResponse;
        }).catch(() => {
            return caches.match(event.request).then((cached) => {
                return cached || Response.error();
            });
        })
    );
});
