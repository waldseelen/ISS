/**
 * ============================================
 * GeoMonitor — API Handler Module
 * ============================================
 * All external data fetch functions.
 * Uses ONLY public, keyless endpoints.
 *
 * Sources:
 *   - Open-Meteo      → Weather forecast, marine data
 *   - OpenSky Network  → Real-time aircraft positions
 *   - OpenAQ (v2)      → Air quality station data
 *   - Open-Elevation   → Terrain elevation
 *   - Sunrise-Sunset   → Solar times
 *   - Nominatim (OSM)  → Geocoding / Reverse geocoding
 */

const API_TIMEOUT = 12000;

/**
 * Fetch with abort timeout wrapper.
 * @param {string} url - API endpoint
 * @param {number} timeout - Max wait (ms)
 * @returns {Promise<object>} Parsed JSON response
 */
async function fetchWithTimeout(url, timeout = API_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return await res.json();
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new Error(`Zaman aşımı: ${url.split('?')[0]}`);
        }
        throw err;
    }
}

// ─────────────────────────────────────────────
// OPEN-METEO — Weather Forecast
// ─────────────────────────────────────────────

/**
 * Fetch current weather + 7-day forecast from Open-Meteo.
 * Includes: temp, humidity, wind, pressure, visibility,
 *           precipitation, weather code, and daily forecast.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<object>} Open-Meteo response
 */
export async function fetchWeather(lat, lon) {
    const params = [
        `latitude=${lat}`,
        `longitude=${lon}`,
        'current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,visibility,cloud_cover',
        'hourly=temperature_2m,precipitation_probability,wind_speed_10m',
        'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset',
        'timezone=auto',
        'forecast_days=7',
    ].join('&');
    return fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${params}`);
}

// ─────────────────────────────────────────────
// OPEN-METEO — Marine / Wave Data
// ─────────────────────────────────────────────

/**
 * Fetch marine wave info (height, direction, period).
 * Returns null if data unavailable (inland location).
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object|null>}
 */
export async function fetchMarine(lat, lon) {
    try {
        return await fetchWithTimeout(
            `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period`
        );
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────
// OPENSKY NETWORK — Aircraft Positions
// ─────────────────────────────────────────────

/**
 * Fetch real-time aircraft state vectors within a bounding box.
 * OpenSky public API: ~10 req/min without authentication.
 *
 * State vector indices:
 *  [0] icao24, [1] callsign, [2] origin_country,
 *  [3] time_position, [4] last_contact,
 *  [5] longitude, [6] latitude, [7] baro_altitude,
 *  [8] on_ground, [9] velocity, [10] true_track,
 *  [11] vertical_rate, [12] sensors,
 *  [13] geo_altitude, [14] squawk, [15] spi,
 *  [16] position_source
 *
 * @param {{ north: number, south: number, east: number, west: number }} bounds
 * @returns {Promise<object>}
 */
export async function fetchAircraft(bounds) {
    const { north, south, east, west } = bounds;
    const url = `https://opensky-network.org/api/states/all?lamin=${south.toFixed(2)}&lomin=${west.toFixed(2)}&lamax=${north.toFixed(2)}&lomax=${east.toFixed(2)}`;
    return fetchWithTimeout(url, 15000);
}

// ─────────────────────────────────────────────
// OPENAQ v2 — Air Quality
// ─────────────────────────────────────────────

/**
 * Fetch latest air quality readings near a coordinate.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radius - Search radius in meters (default 50km)
 * @returns {Promise<object>}
 */
export async function fetchAirQuality(lat, lon, radius = 50000) {
    const url = `https://api.openaq.org/v2/latest?coordinates=${lat},${lon}&radius=${radius}&limit=10&order_by=distance`;
    return fetchWithTimeout(url, 10000);
}

// ─────────────────────────────────────────────
// OPEN-ELEVATION — Terrain Height
// ─────────────────────────────────────────────

/**
 * Get terrain elevation for a coordinate.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object>}
 */
export async function fetchElevation(lat, lon) {
    const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`;
    return fetchWithTimeout(url, 8000);
}

// ─────────────────────────────────────────────
// SUNRISE-SUNSET — Solar Times
// ─────────────────────────────────────────────

/**
 * Get sunrise, sunset, solar noon, and civil twilight times.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object>}
 */
export async function fetchSunTimes(lat, lon) {
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`;
    return fetchWithTimeout(url, 8000);
}

// ─────────────────────────────────────────────
// NOMINATIM — Geocoding (Search)
// ─────────────────────────────────────────────

/**
 * Search for places by name (forward geocoding).
 * Respects Nominatim usage policy (1 req/s).
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function geocodeSearch(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&accept-language=tr`;
    return fetchWithTimeout(url, 8000);
}

// ─────────────────────────────────────────────
// NOMINATIM — Reverse Geocoding
// ─────────────────────────────────────────────

/**
 * Get place name for coordinates (reverse geocoding).
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object>}
 */
export async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&accept-language=tr`;
    return fetchWithTimeout(url, 8000);
}
