/* ─── Tile URL Templates ─── */

export function yesterdayISO(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

export const TILES = {
    /* ── Base layers (used by GlobeCanvas — MapCanvas uses MapLibre styles) ── */
    esriSatellite:
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    osm:
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    openTopo:
        'https://tile.opentopomap.org/{z}/{x}/{y}.png',

    /* ── NASA GIBS (free, no key) ── */
    nasaGIBS: (date?: string) =>
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date ?? 'default'}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    nightLights:
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    nasaClouds: (date?: string) =>
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_Bands367/default/${date ?? 'default'}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,

    /* ── RainViewer (free, no key) ── */
    rainViewer: (timestamp: number) =>
        `https://tilecache.rainviewer.com/v2/radar/${timestamp}/512/{z}/{x}/{y}/6/1_1.png`,
};

/* ── RainViewer latest timestamp fetcher ── */
let cachedRainTimestamp: number | null = null;
let rainFetchTime = 0;

export async function getRainViewerTimestamp(): Promise<number | null> {
    if (cachedRainTimestamp && Date.now() - rainFetchTime < 300_000) return cachedRainTimestamp;
    try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await res.json();
        const past = data?.radar?.past;
        if (past && past.length > 0) {
            cachedRainTimestamp = past[past.length - 1].time;
            rainFetchTime = Date.now();
            return cachedRainTimestamp;
        }
    } catch { /* silent */ }
    return null;
}
