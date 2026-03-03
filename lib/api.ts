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
   GEOCODING — Open-Meteo Geocoding
   ═══════════════════════════════════════════════════════════════ */
export async function searchCity(query: string): Promise<GeoCity[]> {
    if (!query || query.length < 2) return [];
    try {
        const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=tr`,
            FETCH_OPTS,
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
   WIND GRID — Open-Meteo (simplified grid)
   ═══════════════════════════════════════════════════════════════ */
export async function fetchWindGrid(
    lat: number,
    lon: number,
    gridSize = 5,
): Promise<WindPoint[]> {
    const points: WindPoint[] = [];
    const step = 10;
    const promises: Promise<void>[] = [];

    for (let dlat = -gridSize; dlat <= gridSize; dlat++) {
        for (let dlon = -gridSize; dlon <= gridSize; dlon++) {
            const la = Math.round(lat + dlat * step);
            const lo = Math.round(lon + dlon * step);
            if (la < -90 || la > 90) continue;
            const cLon = ((lo + 180) % 360) - 180;
            promises.push(
                fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${cLon}&current=wind_speed_10m,wind_direction_10m`,
                    FETCH_OPTS,
                )
                    .then((r) => r.json())
                    .then((j) => {
                        if (j.current) {
                            points.push({
                                lat: j.latitude,
                                lon: j.longitude,
                                speed: j.current.wind_speed_10m ?? 0,
                                direction: j.current.wind_direction_10m ?? 0,
                            });
                        }
                    })
                    .catch(() => { }),
            );
        }
    }
    await Promise.all(promises);
    return points;
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
export function windDirLabel(deg: number): string {
    const dirs = ['K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD', 'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB'];
    return dirs[Math.round(deg / 22.5) % 16];
}

export function getWeatherInfo(code: number): { label: string; icon: string } {
    return WMO_CODES[code] ?? { label: 'Bilinmiyor', icon: '❓' };
}
