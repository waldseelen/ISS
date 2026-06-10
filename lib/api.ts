import type { GeoCity, ISSData, MarineData, WeatherData, WindPoint } from '@/types';
import { WMO_CODES } from '@/types';

const FETCH_OPTS: RequestInit = { mode: 'cors', credentials: 'omit' };

/* ═══════════════════════════════════════════════════════════════
   WEATHER — Open-Meteo Forecast
   ═══════════════════════════════════════════════════════════════ */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
    try {
        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code`;
        const res = await fetch(url, FETCH_OPTS);
        if (!res.ok) return null;
        const json = await res.json();
        const c = json.current;
        return {
            latitude: json.latitude,
            longitude: json.longitude,
            temperature: c.temperature_2m,
            apparentTemperature: c.apparent_temperature,
            humidity: c.relative_humidity_2m,
            windSpeed: c.wind_speed_10m,
            windDirection: c.wind_direction_10m,
            precipitation: c.precipitation,
            weatherCode: c.weather_code,
        };
    } catch {
        return null;
    }
}

/* ═══════════════════════════════════════════════════════════════
   ISS — wheretheiss.at
   ═══════════════════════════════════════════════════════════════ */
export async function fetchISS(): Promise<ISSData | null> {
    try {
        const res = await fetch(
            'https://api.wheretheiss.at/v1/satellites/25544',
            FETCH_OPTS,
        );
        if (!res.ok) return null;
        const d = await res.json();
        return {
            latitude: d.latitude,
            longitude: d.longitude,
            altitude: d.altitude,
            velocity: d.velocity,
            visibility: d.visibility ?? 'unknown',
            timestamp: d.timestamp,
        };
    } catch {
        return null;
    }
}


/* ═══════════════════════════════════════════════════════════════
   LOCALIZATION & TRANSLATIONS
   ═══════════════════════════════════════════════════════════════ */
export const TRANSLATIONS = {
    tr: {
        windDirs: ['K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD', 'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB'],
        unknownWeather: 'Bilinmiyor',
        offlineMode: 'Çevrimdışı Mod - Son Kaydedilen Veriler',
        connecting: 'Bağlanıyor...',
        noData: 'Konum seçin veya haritaya tıklayın',
        windSpeedUnit: 'km/h',
        humidity: 'Nem',
        wind: 'Rüzgar',
        visibility: 'Görüş',
        pressure: 'Basınç',
        precipitation: 'Yağış',
        apparentTemp: 'Hissedilen',
        localTime: 'Yerel Saat',
        sunset: 'Gün Batımı',
        sunrise: 'Gün Doğumu',
        wave: 'Dalga',
        period: 'Periyot',
        waveDir: 'Dalga Yönü',
        seaTemp: 'Su Sıcaklığı',
        clouds: 'Bulut',
        windGust: 'Hamle',
        uv: 'UV',
        marineState: 'Deniz Durumu',
        forecast5Days: '5 Günlük Tahmin',
        highQuality: 'Yüksek Kalite',
        performanceMode: 'Performans Modu',
        latitude: 'Enlem',
        longitude: 'Boylam',
        altitude: 'Yükseklik',
        velocity: 'Hız',
        orbit: 'Yörünge',
        prediction: 'Tahmin',
        issTracker: 'ISS Takip'
    },
    en: {
        windDirs: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
        unknownWeather: 'Unknown',
        offlineMode: 'Offline Mode - Last Cached Data',
        connecting: 'Connecting...',
        noData: 'Select location or click on map',
        windSpeedUnit: 'km/h',
        humidity: 'Humidity',
        wind: 'Wind',
        visibility: 'Visibility',
        pressure: 'Pressure',
        precipitation: 'Precipitation',
        apparentTemp: 'Apparent Temp',
        localTime: 'Local Time',
        sunset: 'Sunset',
        sunrise: 'Sunrise',
        wave: 'Wave',
        period: 'Period',
        waveDir: 'Wave Dir',
        seaTemp: 'Sea Temp',
        clouds: 'Cloud',
        windGust: 'Wind Gust',
        uv: 'UV',
        marineState: 'Marine Condition',
        forecast5Days: '5-Day Forecast',
        highQuality: 'High Quality',
        performanceMode: 'Performance Mode',
        latitude: 'Latitude',
        longitude: 'Longitude',
        altitude: 'Altitude',
        velocity: 'Velocity',
        orbit: 'Orbit',
        prediction: 'Prediction',
        issTracker: 'ISS Tracker'
    }
};

const WMO_CODES_EN: Record<number, string> = {
    0: 'Clear Sky',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing Rime Fog',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Dense Drizzle',
    61: 'Slight Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    66: 'Freezing Rain (Light)',
    67: 'Freezing Rain (Heavy)',
    71: 'Slight Snow',
    73: 'Moderate Snow',
    75: 'Heavy Snow',
    77: 'Snow Grains',
    80: 'Slight Rain Showers',
    81: 'Moderate Rain Showers',
    82: 'Violent Rain Showers',
    85: 'Slight Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with Hail',
    99: 'Severe Thunderstorm with Hail',
};

let currentLang: 'tr' | 'en' = 'tr';

export function setLanguage(lang: 'tr' | 'en') {
    currentLang = lang;
    if (typeof window !== 'undefined') {
        localStorage.setItem('earth_tracker_lang', lang);
    }
}

export function getLanguage(): 'tr' | 'en' {
    if (currentLang) return currentLang;
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('earth_tracker_lang');
        if (saved === 'en' || saved === 'tr') {
            currentLang = saved;
        }
    }
    return currentLang;
}

export function t(key: Exclude<keyof typeof TRANSLATIONS['tr'], 'windDirs'>): string {
    const lang = getLanguage();
    return (TRANSLATIONS[lang]?.[key] || TRANSLATIONS['tr'][key]) as string;
}

/* ═══════════════════════════════════════════════════════════════
   GEOCODING — Open-Meteo Geocoding
   ═══════════════════════════════════════════════════════════════ */
export async function searchCity(query: string, signal?: AbortSignal): Promise<GeoCity[]> {
    if (!query || query.length < 2) return [];
    try {
        const lang = getLanguage();
        const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${lang}`,
            { ...FETCH_OPTS, signal },
        );
        if (!res.ok) return [];
        const json = await res.json();
        return (json.results ?? []).map((r: Record<string, unknown>) => ({
            id: r.id,
            name: r.name,
            latitude: r.latitude,
            longitude: r.longitude,
            country: r.country ?? '',
            admin1: r.admin1 ?? '',
            population: r.population ?? 0,
        }));
    } catch {
        return [];
    }
}

/* ═══════════════════════════════════════════════════════════════
   MARINE — Open-Meteo Marine
   ═══════════════════════════════════════════════════════════════ */
export async function fetchMarine(lat: number, lon: number): Promise<MarineData | null> {
    try {
        const url =
            `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
            `&current=wave_height,wave_direction,wave_period,sea_surface_temperature`;
        const res = await fetch(url, FETCH_OPTS);
        if (!res.ok) return null;
        const json = await res.json();
        const c = json.current;
        return {
            latitude: json.latitude,
            longitude: json.longitude,
            waveHeight: c.wave_height ?? 0,
            waveDirection: c.wave_direction ?? 0,
            wavePeriod: c.wave_period ?? 0,
            seaSurfaceTemperature: c.sea_surface_temperature ?? 0,
        };
    } catch {
        return null;
    }
}

/* ═══════════════════════════════════════════════════════════════
   WIND GRID — Open-Meteo (optimized grid)
   ═══════════════════════════════════════════════════════════════ */
export async function fetchWindGrid(
    lat: number,
    lon: number,
    gridSize = 3,
): Promise<WindPoint[]> {
    const lats: number[] = [];
    const lons: number[] = [];
    const step = 10;

    for (let dlat = -gridSize; dlat <= gridSize; dlat++) {
        for (let dlon = -gridSize; dlon <= gridSize; dlon++) {
            const la = Math.round(lat + dlat * step);
            const lo = Math.round(lon + dlon * step);
            if (la < -90 || la > 90) continue;
            const cLon = ((lo + 180) % 360) - 180;
            lats.push(la);
            lons.push(cLon);
        }
    }

    if (lats.length === 0) return [];

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&current=wind_speed_10m,wind_direction_10m`;
        const res = await fetch(url, FETCH_OPTS);
        if (!res.ok) return [];
        const json = await res.json();

        if (Array.isArray(json)) {
            return json.map(j => ({
                lat: j.latitude,
                lon: j.longitude,
                speed: j.current?.wind_speed_10m ?? 0,
                direction: j.current?.wind_direction_10m ?? 0,
            }));
        } else if (json.current) {
            return [{
                lat: json.latitude,
                lon: json.longitude,
                speed: json.current.wind_speed_10m ?? 0,
                direction: json.current.wind_direction_10m ?? 0,
            }];
        }
        return [];
    } catch {
        return [];
    }
}

/* ═══════════════════════════════════════════════════════════════
   ELEVATION PROFILE — Open-Meteo Elevation
   ═══════════════════════════════════════════════════════════════ */
export async function fetchElevationProfile(lat: number, lon: number): Promise<number[]> {
    try {
        const points = [
            { lat, lon: lon - 0.04 },
            { lat, lon: lon - 0.02 },
            { lat, lon },
            { lat, lon: lon + 0.02 },
            { lat, lon: lon + 0.04 }
        ];
        const latsStr = points.map(p => p.lat).join(',');
        const lonsStr = points.map(p => p.lon).join(',');
        const url = `https://api.open-meteo.com/v1/elevation?latitude=${latsStr}&longitude=${lonsStr}`;
        const res = await fetch(url, FETCH_OPTS);
        if (!res.ok) return [120, 310, 450, 220, 80];
        const json = await res.json();
        return json.elevation ?? [120, 310, 450, 220, 80];
    } catch {
        return [120, 310, 450, 220, 80];
    }
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
export function windDirLabel(deg: number): string {
    const lang = getLanguage();
    const dirs = TRANSLATIONS[lang]?.windDirs || TRANSLATIONS['tr'].windDirs;
    return dirs[Math.round(deg / 22.5) % 16];
}

export function getWeatherInfo(code: number): { label: string; icon: string } {
    const info = WMO_CODES[code];
    if (!info) return { label: t('unknownWeather'), icon: '❓' };
    const lang = getLanguage();
    if (lang === 'en' && WMO_CODES_EN[code]) {
        return { label: WMO_CODES_EN[code], icon: info.icon };
    }
    return info;
}
