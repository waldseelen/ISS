/* ─── Earth Tracker — Progressive Service Worker for Map Tile + API Caching ─── */

const TILE_CACHE = 'earth-tracker-tiles-v2';
const API_CACHE = 'earth-tracker-api-v2';
const GIBS_DOMAINS = ['gibs.earthdata.nasa.gov', 'gibs.earthsdata.nasa.gov'];

const TILE_DOMAINS = [
    'basemaps.cartocdn.com',
    'server.arcgisonline.com',
    'tile.openstreetmap.org',
    'tiles.stadiamaps.com',
    ...GIBS_DOMAINS,
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        await self.clients.claim();
        // Clean old caches
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys
            .filter(k => k !== TILE_CACHE && k !== API_CACHE)
            .map(k => caches.delete(k))
        );
    })());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isTile = TILE_DOMAINS.some(d => url.hostname.includes(d)) &&
        (url.pathname.includes('.png') || url.pathname.includes('.jpg') || url.pathname.includes('/tile/'));

    if (isTile) {
        event.respondWith(
            caches.open(TILE_CACHE).then((cache) => {
                return cache.match(event.request).then((cached) => {
                    const fetchPromise = fetch(event.request).then((res) => {
                        if (res.status === 200) cache.put(event.request, res.clone());
                        return res;
                    }).catch(() => cached);
                    return cached || fetchPromise;
                });
            })
        );
        return;
    }

    // Cache API responses (weather, ISS, etc.)
    const isAPI = event.request.destination === '' &&
        (url.hostname.includes('api.open-meteo.com') || url.hostname.includes('wheretheiss.at'));
    if (isAPI) {
        event.respondWith(
            caches.open(API_CACHE).then((cache) => {
                return cache.match(event.request).then((cached) => {
                    const fetchPromise = fetch(event.request).then((res) => {
                        if (res.status === 200) cache.put(event.request, res.clone());
                        return res;
                    }).catch(() => cached);
                    return cached || fetchPromise;
                });
            })
        );
    }
});
