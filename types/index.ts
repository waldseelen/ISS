/* ─── Earth Tracker — Global Type Definitions ─── */

export interface ModuleState {
    globe3D: boolean;
    map2D: boolean;
    satellite: boolean;
    street: boolean;
    topo: boolean;
    nasaGIBS: boolean;
    nightLights: boolean;
    dayNight: boolean;
    weather: boolean;
    wind: boolean;
    precipitation: boolean;
    temperature: boolean;
    iss: boolean;
    marine: boolean;
    clouds: boolean;
}

export type ModuleKey = keyof ModuleState;

export interface WeatherData {
    latitude: number;
    longitude: number;
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    precipitation: number;
    weatherCode: number;
}

export interface ISSData {
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
    visibility: string;
    timestamp: number;
}

export interface ISSTrailPoint {
    lat: number;
    lon: number;
    alt: number;
    time: number;
}

export interface MarineData {
    latitude: number;
    longitude: number;
    waveHeight: number;
    waveDirection: number;
    wavePeriod: number;
    seaSurfaceTemperature: number;
}

export interface GeoCity {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
    population?: number;
}

export interface SunPosition {
    azimuth: number;
    altitude: number;
    declination: number;
    rightAscension: number;
    lat: number;
    lon: number;
}

export interface SunTimes {
    sunrise: Date;
    sunset: Date;
    solarNoon: Date;
    dawn: Date;
    dusk: Date;
}

export interface WindPoint {
    lat: number;
    lon: number;
    speed: number;
    direction: number;
}

export const WMO_CODES: Record<number, { label: string; icon: string }> = {
    0: { label: 'Açık', icon: '☀️' },
    1: { label: 'Genellikle Açık', icon: '🌤️' },
    2: { label: 'Parçalı Bulutlu', icon: '⛅' },
    3: { label: 'Kapalı', icon: '☁️' },
    45: { label: 'Sisli', icon: '🌫️' },
    48: { label: 'Kırağılı Sis', icon: '🌫️' },
    51: { label: 'Hafif Çisenti', icon: '🌦️' },
    53: { label: 'Orta Çisenti', icon: '🌦️' },
    55: { label: 'Yoğun Çisenti', icon: '🌧️' },
    61: { label: 'Hafif Yağmur', icon: '🌧️' },
    63: { label: 'Orta Yağmur', icon: '🌧️' },
    65: { label: 'Şiddetli Yağmur', icon: '🌧️' },
    66: { label: 'Dondurucu Yağmur (H)', icon: '🌨️' },
    67: { label: 'Dondurucu Yağmur (Ş)', icon: '🌨️' },
    71: { label: 'Hafif Kar', icon: '🌨️' },
    73: { label: 'Orta Kar', icon: '❄️' },
    75: { label: 'Yoğun Kar', icon: '❄️' },
    77: { label: 'Kar Taneleri', icon: '❄️' },
    80: { label: 'Hafif Sağanak', icon: '🌦️' },
    81: { label: 'Orta Sağanak', icon: '🌧️' },
    82: { label: 'Şiddetli Sağanak', icon: '🌧️' },
    85: { label: 'Hafif Kar Sağanağı', icon: '🌨️' },
    86: { label: 'Şiddetli Kar Sağanağı', icon: '❄️' },
    95: { label: 'Gök Gürültülü Fırtına', icon: '⛈️' },
    96: { label: 'Dolu ile Fırtına', icon: '⛈️' },
    99: { label: 'Şiddetli Dolu Fırtınası', icon: '⛈️' },
};
