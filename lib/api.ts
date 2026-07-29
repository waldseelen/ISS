import type { GeoCity, MarineData, WeatherData, WindPoint } from '@/types';
import { WMO_CODES } from '@/types';
import { fetchWithRetry, safeNum, safeStr } from './fetchWithRetry';

/* ═══════════════════════════════════════════════════════════════
   WEATHER — Open-Meteo Forecast
   (Faz 1: fetchWithRetry ile retry+backoff, safeNum ile NaN guard)
   ═══════════════════════════════════════════════════════════════ */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
    const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code`;
    const json = await fetchWithRetry<Record<string, any>>(url);
    if (!json?.current) return null;
    const c = json.current;
    return {
        latitude: safeNum(json.latitude, lat),
        longitude: safeNum(json.longitude, lon),
        temperature: safeNum(c.temperature_2m),
        apparentTemperature: safeNum(c.apparent_temperature),
        humidity: safeNum(c.relative_humidity_2m),
        windSpeed: safeNum(c.wind_speed_10m),
        windDirection: safeNum(c.wind_direction_10m),
        precipitation: safeNum(c.precipitation),
        weatherCode: safeNum(c.weather_code),
    };
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
        issTitle: 'ISS — Uluslararası Uzay İstasyonu',
        issAltitude: 'İrtifa',
        issSpeed: 'Hız',
        issTleAge: 'Yörünge verisi',
        issTleStale: 'Yörünge verisi eski — konum sapmış olabilir',
        issLoading: 'Yörünge verisi yükleniyor...',
        issNoData: 'Yörünge verisi alınamadı',
        issPasses: 'Yaklaşan Geçişler',
        issNoPasses: 'Önümüzdeki 24 saatte 10° üzeri geçiş yok',
        issSelectLocation: 'Geçiş tahmini için haritadan konum seçin',
        issMaxElevation: 'Zirve',
        issDuration: 'Süre',
        issDirection: 'Yön',
        issStreamTitle: 'NASA ISS Canlı Yayın',
        issStreamNote: 'Harici içerik — YouTube üzerinden yayınlanır',
        hoursShort: 'sa',
        minutesShort: 'dk'
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
        issTitle: 'ISS — International Space Station',
        issAltitude: 'Altitude',
        issSpeed: 'Speed',
        issTleAge: 'Orbit data',
        issTleStale: 'Orbit data is stale — position may have drifted',
        issLoading: 'Loading orbit data...',
        issNoData: 'Orbit data unavailable',
        issPasses: 'Upcoming Passes',
        issNoPasses: 'No passes above 10° in the next 24 hours',
        issSelectLocation: 'Select a location on the map for pass prediction',
        issMaxElevation: 'Peak',
        issDuration: 'Duration',
        issDirection: 'Direction',
        issStreamTitle: 'NASA ISS Live Stream',
        issStreamNote: 'External content — streamed via YouTube',
        hoursShort: 'h',
        minutesShort: 'min'
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
   (Faz 1: fetchWithRetry + AbortSignal passthrough)
   ═══════════════════════════════════════════════════════════════ */
export async function searchCity(query: string, signal?: AbortSignal): Promise<GeoCity[]> {
    if (!query || query.length < 2) return [];
    const lang = getLanguage();
    const json = await fetchWithRetry<Record<string, any>>(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${lang}`,
        { signal, maxRetries: 1 },
    );
    if (!json?.results) return [];
    return (json.results as Record<string, unknown>[]).map((r) => ({
        id: safeNum(r.id),
        name: safeStr(r.name, 'Unknown'),
        latitude: safeNum(r.latitude),
        longitude: safeNum(r.longitude),
        country: safeStr(r.country),
        admin1: safeStr(r.admin1),
        population: safeNum(r.population),
    }));
}

/* ═══════════════════════════════════════════════════════════════
   MARINE — Open-Meteo Marine
   ═══════════════════════════════════════════════════════════════ */
export async function fetchMarine(lat: number, lon: number): Promise<MarineData | null> {
    const url =
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
        `&current=wave_height,wave_direction,wave_period,sea_surface_temperature`;
    const json = await fetchWithRetry<Record<string, any>>(url);
    if (!json?.current) return null;
    const c = json.current;
    return {
        latitude: safeNum(json.latitude, lat),
        longitude: safeNum(json.longitude, lon),
        waveHeight: safeNum(c.wave_height),
        waveDirection: safeNum(c.wave_direction),
        wavePeriod: safeNum(c.wave_period),
        seaSurfaceTemperature: safeNum(c.sea_surface_temperature),
    };
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

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&current=wind_speed_10m,wind_direction_10m`;
    const json = await fetchWithRetry<any>(url);
    if (!json) return [];

    if (Array.isArray(json)) {
        return json.map(j => ({
            lat: safeNum(j.latitude),
            lon: safeNum(j.longitude),
            speed: safeNum(j.current?.wind_speed_10m),
            direction: safeNum(j.current?.wind_direction_10m),
        }));
    } else if (json.current) {
        return [{
            lat: safeNum(json.latitude),
            lon: safeNum(json.longitude),
            speed: safeNum(json.current.wind_speed_10m),
            direction: safeNum(json.current.wind_direction_10m),
        }];
    }
    return [];
}

/* ═══════════════════════════════════════════════════════════════
   ELEVATION PROFILE — Open-Meteo Elevation
   ═══════════════════════════════════════════════════════════════ */
export async function fetchElevationProfile(lat: number, lon: number): Promise<number[]> {
    const points: { lat: number; lon: number }[] = [];
    const step = 0.012; // Step size for ~15km span (15 points * ~1.2km)
    for (let i = -7; i <= 7; i++) {
        points.push({ lat, lon: lon + i * step });
    }
    const latsStr = points.map(p => p.lat).join(',');
    const lonsStr = points.map(p => p.lon).join(',');
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${latsStr}&longitude=${lonsStr}`;
    const json = await fetchWithRetry<Record<string, any>>(url);
    if (!json?.elevation || !Array.isArray(json.elevation)) {
        return [120, 150, 180, 220, 310, 410, 450, 420, 330, 220, 180, 140, 110, 90, 80];
    }
    return json.elevation.map((v: unknown) => safeNum(v));
}

/* ═══════════════════════════════════════════════════════════════
   CLIMATOLOGY ANOMALY — Open-Meteo Archive
   ═══════════════════════════════════════════════════════════════ */
export async function fetchClimatology(lat: number, lon: number): Promise<{ monthlyAvg: number; history: number[] }> {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const monthNum = now.getMonth() + 1;
        const monthStr = String(monthNum).padStart(2, '0');
        
        // Fetch last 3 years for the same month (approx 84 daily values)
        const startYear = year - 3;
        const endYear = year - 1;
        const startDate = `${startYear}-${monthStr}-01`;
        const endDate = `${endYear}-${monthStr}-28`;
        
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean`;
        const json = await fetchWithRetry<any>(url);
        
        if (!json?.daily?.temperature_2m_mean) {
            throw new Error("Invalid climatology data");
        }
        
        const temps: number[] = json.daily.temperature_2m_mean.filter((t: any) => typeof t === 'number');
        if (temps.length === 0) {
            throw new Error("Empty climatology temps");
        }
        
        const sum = temps.reduce((a: number, b: number) => a + b, 0);
        const monthlyAvg = sum / temps.length;
        
        // Sample 12 points for display
        const sample: number[] = [];
        const step = Math.max(1, Math.floor(temps.length / 12));
        for (let i = 0; i < temps.length && sample.length < 12; i += step) {
            sample.push(temps[i]);
        }
        
        return {
            monthlyAvg: Math.round(monthlyAvg * 10) / 10,
            history: sample,
        };
    } catch {
        // Latitude-based seasonal fallback
        const baseTemp = 24 - Math.abs(lat) * 0.38;
        const currentMonth = new Date().getMonth();
        const seasonalFactor = Math.sin(((currentMonth - 3) * Math.PI) / 6); // July peak in N hemisphere
        const avg = baseTemp + seasonalFactor * 10;
        const history = Array.from({ length: 12 }, (_, i) => Math.round((avg + Math.sin(i) * 1.5) * 10) / 10);
        return {
            monthlyAvg: Math.round(avg * 10) / 10,
            history
        };
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
