/**
 * ============================================
 * GeoMonitor — Utility Module
 * ============================================
 * Data formatting, unit conversions, GeoJSON generators,
 * SunCalc-based day/night terminator, and helpers.
 */

// ─────────────────────────────────────────────
// UNIT CONVERSIONS
// ─────────────────────────────────────────────

/** m/s → knots */
export const msToKnots = (ms) => (ms * 1.94384).toFixed(1);

/** m/s → km/h */
export const msToKmh = (ms) => (ms * 3.6).toFixed(1);

/** Meters → Feet */
export const metersToFeet = (m) => Math.round(m * 3.28084);

/** Wind degree → compass direction (Turkish) */
export function degToCompass(deg) {
    const dirs = ['K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD',
        'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB'];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

/** Format visibility in human-readable form */
export function formatVisibility(meters) {
    if (meters == null) return '—';
    if (meters >= 10000) return `${(meters / 1000).toFixed(0)} km`;
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
}

/** Format pressure (hPa) */
export const formatPressure = (hpa) => hpa != null ? `${Math.round(hpa)} hPa` : '—';

// ─────────────────────────────────────────────
// TIME & DATE
// ─────────────────────────────────────────────

/** ISO string → HH:mm (Turkish locale) */
export function formatTime(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** ISO string → Short date (Pzt, Sal, etc.) */
export function formatShortDay(isoString) {
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return days[new Date(isoString).getDay()];
}

/** Current time as HH:mm:ss */
export function nowTimeString() {
    return new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

// ─────────────────────────────────────────────
// WMO WEATHER CODE DESCRIPTIONS (Turkish)
// ─────────────────────────────────────────────

const WMO_DESCRIPTIONS = {
    0: 'Açık',
    1: 'Çoğunlukla Açık',
    2: 'Parçalı Bulutlu',
    3: 'Kapalı',
    45: 'Sisli',
    48: 'Kırağılı Sis',
    51: 'Hafif Çisenti',
    53: 'Orta Çisenti',
    55: 'Yoğun Çisenti',
    56: 'Dondurucu Çisenti',
    57: 'Yoğun Dondurucu Çisenti',
    61: 'Hafif Yağmur',
    63: 'Orta Yağmur',
    65: 'Şiddetli Yağmur',
    66: 'Dondurucu Yağmur',
    67: 'Yoğun Dondurucu Yağmur',
    71: 'Hafif Kar',
    73: 'Orta Kar',
    75: 'Yoğun Kar',
    77: 'Kar Taneleri',
    80: 'Hafif Sağanak',
    81: 'Orta Sağanak',
    82: 'Şiddetli Sağanak',
    85: 'Hafif Kar Sağanağı',
    86: 'Yoğun Kar Sağanağı',
    95: 'Gök Gürültülü Fırtına',
    96: 'Dolu ile Fırtına',
    99: 'Şiddetli Dolu Fırtınası',
};

/** WMO weather code → Turkish description */
export function getWeatherDescription(code) {
    return WMO_DESCRIPTIONS[code] ?? 'Bilinmiyor';
}

/** WMO weather code → emoji icon */
export function getWeatherIcon(code) {
    if (code === 0) return '☀️';
    if (code <= 2) return '⛅';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 57) return '🌧️';
    if (code <= 65) return '🌧️';
    if (code <= 67) return '🧊';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    if (code <= 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌡️';
}

// ─────────────────────────────────────────────
// AIR QUALITY INDEX HELPERS
// ─────────────────────────────────────────────

/**
 * Get AQI category and CSS class from PM2.5 value (µg/m³).
 * Based on US EPA breakpoints.
 */
export function getAQICategory(pm25) {
    if (pm25 == null) return { label: '—', cls: '' };
    if (pm25 <= 12) return { label: 'İyi', cls: 'aqi-good' };
    if (pm25 <= 35.4) return { label: 'Orta', cls: 'aqi-moderate' };
    if (pm25 <= 55.4) return { label: 'Hassas', cls: 'aqi-unhealthy' };
    if (pm25 <= 150.4) return { label: 'Sağlıksız', cls: 'aqi-bad' };
    return { label: 'Tehlikeli', cls: 'aqi-hazardous' };
}

/** Parameter name → Turkish label */
export function parameterLabel(param) {
    const map = {
        pm25: 'PM2.5', pm10: 'PM10', o3: 'Ozon',
        no2: 'NO₂', so2: 'SO₂', co: 'CO',
    };
    return map[param?.toLowerCase()] ?? param;
}

// ─────────────────────────────────────────────
// DAY/NIGHT TERMINATOR (SunCalc)
// ─────────────────────────────────────────────

/**
 * Compute the sub-solar point (latitude = declination, longitude from time).
 * @param {Date} date
 * @returns {{ lat: number, lon: number }}
 */
function getSubsolarPoint(date) {
    const now = date ?? new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);

    // Solar declination (simplified equation)
    const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));

    // Sub-solar longitude from UTC time
    const hours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const subLon = (12 - hours) * 15;

    return { lat: declination, lon: subLon };
}

/**
 * Compute day/night terminator as GeoJSON polygon.
 * Uses analytical formula for the great circle 90° from subsolar point.
 * The returned polygon covers the NIGHT side of the Earth.
 *
 * @param {Date} [date] - Defaults to now
 * @returns {object} GeoJSON FeatureCollection
 */
export function computeTerminatorGeoJSON(date) {
    const subsolar = getSubsolarPoint(date ?? new Date());
    const decRad = (subsolar.lat * Math.PI) / 180;
    const lonRad = (subsolar.lon * Math.PI) / 180;

    // Compute terminator latitude for each longitude
    const terminatorCoords = [];
    for (let i = -180; i <= 180; i += 1) {
        const lonDiff = (i * Math.PI) / 180 - lonRad;
        const lat = Math.atan2(-Math.cos(lonDiff), Math.tan(decRad)) * (180 / Math.PI);
        terminatorCoords.push([i, lat]);
    }

    // Determine which pole is in darkness
    // Check if south pole gets sun (southern summer → subsolar lat < 0 → north pole is darker)
    const nightPoleY = subsolar.lat > 0 ? -90 : 90;

    // Build polygon: terminator line → extend to dark pole → close
    const polygonCoords = [...terminatorCoords];

    // Close along the dark pole edge
    polygonCoords.push([180, nightPoleY]);
    polygonCoords.push([-180, nightPoleY]);
    polygonCoords.push(terminatorCoords[0]); // close ring

    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [polygonCoords],
            },
            properties: { type: 'night' },
        }],
    };
}

// ─────────────────────────────────────────────
// AIRCRAFT → GeoJSON
// ─────────────────────────────────────────────

/**
 * Convert OpenSky state vectors to GeoJSON FeatureCollection.
 * @param {Array<Array>} states - OpenSky state vector array
 * @returns {object} GeoJSON FeatureCollection
 */
export function aircraftToGeoJSON(states) {
    const features = (states ?? [])
        .filter((s) => s[5] != null && s[6] != null) // Must have lon/lat
        .map((s) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [s[5], s[6]],
            },
            properties: {
                icao24: s[0],
                callsign: (s[1] ?? '').trim(),
                origin: s[2] ?? '',
                altitude: s[7] != null ? Math.round(s[7]) : null,
                velocity: s[9] != null ? Math.round(s[9]) : null,
                heading: s[10] ?? 0,
                verticalRate: s[11] ?? 0,
                onGround: !!s[8],
            },
        }));

    return { type: 'FeatureCollection', features };
}

// ─────────────────────────────────────────────
// AIRCRAFT ICON (Canvas-generated)
// ─────────────────────────────────────────────

/**
 * Create an aircraft icon as ImageData for MapLibre `map.addImage()`.
 * Returns a 32×32 upward-pointing plane shape.
 * @param {string} color - Fill color
 * @returns {{ width: number, height: number, data: Uint8Array }}
 */
export function createAircraftIcon(color = '#06b6d4') {
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw plane shape (pointing UP — MapLibre will rotate via icon-rotate)
    const cx = size / 2;
    const cy = size / 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    // Fuselage / arrow
    ctx.moveTo(cx, cy - 18); // nose
    ctx.lineTo(cx + 5, cy - 4);
    ctx.lineTo(cx + 16, cy + 2); // right wing tip
    ctx.lineTo(cx + 5, cy + 1);
    ctx.lineTo(cx + 6, cy + 12); // right tail
    ctx.lineTo(cx + 2, cy + 8);
    ctx.lineTo(cx, cy + 14); // tail end
    ctx.lineTo(cx - 2, cy + 8);
    ctx.lineTo(cx - 6, cy + 12);
    ctx.lineTo(cx - 5, cy + 1);
    ctx.lineTo(cx - 16, cy + 2); // left wing tip
    ctx.lineTo(cx - 5, cy - 4);
    ctx.closePath();
    ctx.fill();

    // Add glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fill();

    return ctx.getImageData(0, 0, size, size);
}

// ─────────────────────────────────────────────
// GIBS DATE HELPER
// ─────────────────────────────────────────────

/**
 * Get a valid NASA GIBS date string (usually 2 days ago).
 * GIBS satellite data has ~1-2 day latency.
 * @returns {string} YYYY-MM-DD format
 */
export function getGIBSDate() {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().split('T')[0];
}

/**
 * Get NDVI period start date (MODIS 8-day composites).
 * @returns {string} YYYY-MM-DD format
 */
export function getNDVIDate() {
    const d = new Date();
    d.setDate(d.getDate() - 12); // Go back enough to ensure a complete period
    const year = d.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((d - startOfYear) / 86400000) + 1;
    const periodStart = Math.floor((dayOfYear - 1) / 8) * 8 + 1;
    const result = new Date(year, 0, periodStart);
    return result.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────
// CSV EXPORT HELPER
// ─────────────────────────────────────────────

/**
 * Generate and download a CSV file from data object.
 * @param {object} data - Key-value pairs to export
 * @param {string} filename
 */
export function downloadCSV(data, filename = 'geomonitor-export.csv') {
    const rows = [['Alan', 'Değer']];
    for (const [key, value] of Object.entries(data)) {
        rows.push([key, String(value ?? '—')]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Download the map canvas as PNG.
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 */
export function downloadPNG(canvas, filename = 'geomonitor-map.png') {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}

// ─────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {number} duration - Duration in ms
 */
export function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('toast-out');
        setTimeout(() => el.remove(), 300);
    }, duration);
}

// ─────────────────────────────────────────────
// DEBOUNCE
// ─────────────────────────────────────────────

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} delay - Delay in ms
 * @returns {Function}
 */
export function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ─────────────────────────────────────────────
// COORDINATE FORMATTING
// ─────────────────────────────────────────────

/**
 * Format latitude and longitude to display string.
 * @param {number} lat
 * @param {number} lon
 * @returns {string} e.g. "41.0082°N, 28.9784°E"
 */
export function formatCoords(lat, lon) {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}
