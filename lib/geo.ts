import type { ForecastDay, LocationDetail } from '@/types';
import { fetchWithRetry, safeNum, safeStr } from './fetchWithRetry';

const FETCH_OPTS: RequestInit = { mode: 'cors', credentials: 'omit' };

// In-memory cache for location detail (5min TTL)
const locationCache = new Map<string, { data: LocationDetail; expiry: number }>();
const CACHE_TTL = 300_000;

function cacheKey(lat: number, lon: number): string {
    return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/**
 * Nominatim ile ters geocode: sadece şehir + ülke döndürür (kasaba/köy yok).
 * zoom=10 → şehir seviyesinde sonuç.
 */
export async function reverseGeocode(
    lat: number,
    lon: number,
): Promise<{ name: string; timezone: string; country: string }> {
    try {
        const [tzJson, nom] = await Promise.all([
            fetchWithRetry<Record<string, any>>(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`,
                { maxRetries: 2 },
            ),
            fetchWithRetry<Record<string, any>>(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
                { maxRetries: 2, baseDelay: 1000 },
            ),
        ]);

        const timezone = safeStr(tzJson?.timezone, 'UTC');

        const addr = (nom?.address ?? {}) as Record<string, string>;
        // Sadece idari şehir birimleri – kasaba/köy/mahalle dâhil değil
        const city =
            addr.city ||
            addr.municipality ||
            addr.county ||
            addr.state_district ||
            addr.state ||
            nom?.name ||
            formatCoordName(lat, lon);
        const country = safeStr(addr.country);

        return { name: city, timezone, country };
    } catch {
        return { name: formatCoordName(lat, lon), timezone: 'UTC', country: '' };
    }
}

function formatCoordName(lat: number, lon: number): string {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

/**
 * Get local time string for a given timezone.
 */
export function getLocalTime(timezone: string): string {
    try {
        return new Date().toLocaleString('tr-TR', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    } catch {
        return new Date().toISOString().slice(11, 19);
    }
}

/**
 * Fetch full location detail for a clicked point.
 * Combines weather data, reverse geocoding, and timezone info.
 */
export async function fetchLocationDetail(lat: number, lon: number): Promise<LocationDetail> {
    const key = cacheKey(lat, lon);
    const cached = locationCache.get(key);
    if (cached && Date.now() < cached.expiry) return cached.data;

    const [geoInfo, weatherData, forecastData] = await Promise.all([
        reverseGeocode(lat, lon),
        fetchDetailedWeather(lat, lon),
        fetchForecast(lat, lon),
    ]);

    const localTime = getLocalTime(geoInfo.timezone);
    const utcTime = new Date().toISOString().slice(11, 19);

    const result: LocationDetail = {
        latitude: lat,
        longitude: lon,
        locationName: geoInfo.country ? `${geoInfo.name}, ${geoInfo.country}` : geoInfo.name,
        utcTime,
        localTime,
        timezone: geoInfo.timezone,
        temperature: weatherData.temperature,
        feelsLike: weatherData.feelsLike,
        humidity: weatherData.humidity,
        precipitation: weatherData.precipitation,
        cloudCover: weatherData.cloudCover,
        windSpeed: weatherData.windSpeed,
        windDirection: weatherData.windDirection,
        windGust: weatherData.windGust,
        pressure: weatherData.pressure,
        visibility: weatherData.visibility,
        uvIndex: weatherData.uvIndex,
        weatherCode: weatherData.weatherCode,
        forecast: forecastData,
    };

    locationCache.set(key, { data: result, expiry: Date.now() + CACHE_TTL });
    return result;
}

/** 5 günlük günlük tahmin – Open-Meteo daily endpoint */
async function fetchForecast(lat: number, lon: number): Promise<ForecastDay[]> {
    const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
        `&timezone=auto&forecast_days=5`;
    const json = await fetchWithRetry<Record<string, any>>(url);
    if (!json?.daily) return [];
    const d = json.daily;
    return ((d?.time ?? []) as string[]).map((date, i) => ({
        date,
        weatherCode: safeNum(d.weather_code?.[i]),
        tempMax: Math.round(safeNum(d.temperature_2m_max?.[i])),
        tempMin: Math.round(safeNum(d.temperature_2m_min?.[i])),
        precipitationSum: Math.round(safeNum(d.precipitation_sum?.[i]) * 10) / 10,
    }));
}

interface DetailedWeather {
    temperature: number;
    feelsLike: number;
    humidity: number;
    precipitation: number;
    cloudCover: number;
    windSpeed: number;
    windDirection: number;
    windGust: number;
    pressure: number;
    visibility: number;
    uvIndex: number;
    weatherCode: number;
}

async function fetchDetailedWeather(lat: number, lon: number): Promise<DetailedWeather> {
    const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,cloud_cover,` +
        `wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,weather_code` +
        `&daily=uv_index_max,visibility_mean&timezone=auto&forecast_days=1`;
    const json = await fetchWithRetry<Record<string, any>>(url);
    if (!json?.current) {
        return {
            temperature: 0, feelsLike: 0, humidity: 0, precipitation: 0,
            cloudCover: 0, windSpeed: 0, windDirection: 0, windGust: 0,
            pressure: 1013, visibility: 10, uvIndex: 0, weatherCode: 0,
        };
    }
    const c = json.current;
    const d = json.daily;
    return {
        temperature: safeNum(c.temperature_2m),
        feelsLike: safeNum(c.apparent_temperature),
        humidity: safeNum(c.relative_humidity_2m),
        precipitation: safeNum(c.precipitation),
        cloudCover: safeNum(c.cloud_cover),
        windSpeed: safeNum(c.wind_speed_10m),
        windDirection: safeNum(c.wind_direction_10m),
        windGust: safeNum(c.wind_gusts_10m),
        pressure: safeNum(c.surface_pressure, 1013),
        visibility: d?.visibility_mean?.[0] ? Math.round(safeNum(d.visibility_mean[0]) / 1000) : 10,
        uvIndex: safeNum(d?.uv_index_max?.[0]),
        weatherCode: safeNum(c.weather_code),
    };
}

export interface ISSUpcomingPass {
    time: string;
    durationSec: number;
    maxElevation: number;
    direction: string;
    hoursFromNow: number;
}

const COMPASS_16 = [
    'K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD',
    'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB',
];
const COMPASS_8 = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];

function azimuthLabel(deg: number, use8: boolean): string {
    const dirs = use8 ? COMPASS_8 : COMPASS_16;
    return dirs[Math.round(((deg % 360) + 360) % 360 / (360 / dirs.length)) % dirs.length];
}

/**
 * Predict ISS overpasses for a given observer lat/lon over the next ~6 hours.
 * Uses the prediction orbit ring + a simple visibility test:
 *   pass ≈ when the satellite track crosses the observer's
 *   horizon (|lat - subSatLat| < 60°).
 * Returns up to `maxPasses` future passes with a duration, peak elevation
 * and a cardinal direction label.
 */
export function predictUpcomingPasses(
    obsLat: number,
    obsLon: number,
    prediction: { lat: number; lon: number }[],
    maxPasses = 3,
    periodMin = 92.68,
): ISSUpcomingPass[] {
    if (prediction.length < 2) return [];

    const passes: ISSUpcomingPass[] = [];
    const stepMin = periodMin / prediction.length;
    let inPass = false;
    let passStartIdx = 0;

    for (let i = 1; i < prediction.length; i++) {
        const a = prediction[i - 1];
        const b = prediction[i];
        const dLat = Math.abs(((b.lat - obsLat + 540) % 360) - 180);
        const dLon = Math.abs(((b.lon - obsLon + 540) % 360) - 180);
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        const visible = dist < 60;

        if (visible && !inPass) {
            inPass = true;
            passStartIdx = i;
        } else if (!visible && inPass) {
            const startMin = passStartIdx * stepMin;
            const endMin = i * stepMin;
            const dur = Math.max(60, (endMin - startMin) * 60);
            const peakIdx = Math.round((passStartIdx + i) / 2);
            const peak = prediction[Math.min(prediction.length - 1, peakIdx)];
            const peakLat = peak?.lat ?? 0;
            const peakLon = peak?.lon ?? 0;
            const elev = Math.round(90 - Math.sqrt(
                Math.pow(peakLat - obsLat, 2) + Math.pow(peakLon - obsLon, 2)
            ));
            const azDeg = (Math.atan2(peakLon - obsLon, peakLat - obsLat) * 180) / Math.PI;
            passes.push({
                time: new Date(Date.now() + startMin * 60_000).toLocaleTimeString('tr-TR', {
                    hour: '2-digit', minute: '2-digit',
                }),
                durationSec: Math.round(dur),
                maxElevation: Math.max(10, Math.min(90, elev)),
                direction: `${azimuthLabel(azDeg - 180, true)} → ${azimuthLabel(azDeg, true)}`,
                hoursFromNow: startMin / 60,
            });
            inPass = false;
            if (passes.length >= maxPasses) break;
        }
    }

    if (passes.length === 0) {
        const minByIdx = prediction
            .map((p, i) => ({ i, d: Math.sqrt(((p.lat - obsLat) ** 2) + (((p.lon - obsLon + 540) % 360) - 180) ** 2) }))
            .sort((a, b) => a.d - b.d)[0];
        if (minByIdx) {
            const peak = prediction[minByIdx.i];
            const azDeg = (Math.atan2(peak.lon - obsLon, peak.lat - obsLat) * 180) / Math.PI;
            passes.push({
                time: new Date(Date.now() + minByIdx.i * stepMin * 60_000).toLocaleTimeString('tr-TR', {
                    hour: '2-digit', minute: '2-digit',
                }),
                durationSec: 0,
                maxElevation: Math.max(10, 90 - Math.round(minByIdx.d)),
                direction: `${azimuthLabel(azDeg - 180, true)} → ${azimuthLabel(azDeg, true)}`,
                hoursFromNow: (minByIdx.i * stepMin) / 60,
            });
        }
    }
    return passes;
}
