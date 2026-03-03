/* ─── Tile URL Templates ─── */

export function todayISO(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

export const TILES = {
    esriSatellite:
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    osm:
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    openTopo:
        'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    nasaGIBS: (date?: string) =>
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date ?? todayISO()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    nightLights:
        'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
};
