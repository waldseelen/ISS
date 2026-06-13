/* ═══════════════════════════════════════════════════════════════
   Earth Tracker — Progressive Service Worker v3
   Faz 1 / Madde 3: Stale-While-Revalidate Tile & API Caching
   ═══════════════════════════════════════════════════════════════ */

const TILE_CACHE   = 'earth-tracker-tiles-v3';
const API_CACHE    = 'earth-tracker-api-v3';
const TILE_MAX     = 2000;   // Max cached tiles before LRU eviction
const API_MAX      = 200;    // Max cached API responses
const API_TTL_MS   = 120000; // API cache TTL: 2 minutes

const TILE_DOMAINS = [
    'basemaps.cartocdn.com',
    'server.arcgisonline.com',
    'tile.openstreetmap.org',
    'tile.opentopomap.org',
    'tiles.stadiamaps.com',
    'gibs.earthdata.nasa.gov',
    'tilecache.rainviewer.com',
    'api.mapbox.com',
    'api.maptiler.com',
];

const API_DOMAINS = [
    'api.open-meteo.com',
    'marine-api.open-meteo.com',
    'geocoding-api.open-meteo.com',
    'wheretheiss.at',
    'api.rainviewer.com',
    'nominatim.openstreetmap.org',
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        await self.clients.claim();
        // Purge old cache versions
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys
            .filter(k => k !== TILE_CACHE && k !== API_CACHE)
            .map(k => caches.delete(k))
        );
    })());
});

/**
 * LRU-style cache trimming: removes oldest entries when
 * the cache exceeds the specified limit.
 */
async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
        const toDelete = keys.slice(0, keys.length - maxEntries);
        await Promise.all(toDelete.map(key => cache.delete(key)));
    }
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // ─── TILE REQUESTS: Stale-While-Revalidate ───
    const isTile = TILE_DOMAINS.some(d => url.hostname.includes(d)) &&
        (url.pathname.match(/\.(png|jpg|jpeg|pbf|webp)/) || url.pathname.includes('/tile/'));

    if (isTile) {
        event.respondWith(
            caches.open(TILE_CACHE).then(async (cache) => {
                const cached = await cache.match(event.request);

                // Always fire network request to revalidate in background
                const networkPromise = fetch(event.request).then((res) => {
                    if (res.status === 200) {
                        cache.put(event.request, res.clone());
                        // Background trim (non-blocking)
                        trimCache(TILE_CACHE, TILE_MAX).catch(() => {});
                    }
                    return res;
                }).catch(() => cached || new Response('', { status: 503 }));

                // Return cached immediately if available (stale-while-revalidate)
                return cached || networkPromise;
            })
        );
        return;
    }

    // ─── API REQUESTS: Network-first with TTL cache fallback ───
    const isAPI = event.request.destination === '' &&
        API_DOMAINS.some(d => url.hostname.includes(d));

    if (isAPI) {
        event.respondWith(
            caches.open(API_CACHE).then(async (cache) => {
                try {
                    const res = await fetch(event.request);
                    if (res.status === 200) {
                        // Store with timestamp header for TTL checks
                        const cloned = res.clone();
                        const headers = new Headers(cloned.headers);
                        headers.set('x-sw-cached-at', Date.now().toString());
                        const body = await cloned.arrayBuffer();
                        const cachedResponse = new Response(body, {
                            status: cloned.status,
                            statusText: cloned.statusText,
                            headers,
                        });
                        cache.put(event.request, cachedResponse);
                        trimCache(API_CACHE, API_MAX).catch(() => {});
                    }
                    return res;
                } catch {
                    // Network failed → serve from cache if available and not too stale
                    const cached = await cache.match(event.request);
                    if (cached) {
                        const cachedAt = parseInt(cached.headers.get('x-sw-cached-at') || '0');
                        const age = Date.now() - cachedAt;
                        // Allow stale API data up to 10 minutes for offline resilience
                        if (age < 600000) {
                            return cached;
                        }
                    }
                    return new Response(JSON.stringify({ error: 'offline' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
            })
        );
        return;
    }
});
