import { getWeatherInfo, t } from '@/lib/api';
import type { MarineData, WeatherData } from '@/types';
import { useEffect, useState } from 'react';

interface Props {
    weather: WeatherData | null;
    marine: MarineData | null;
    isFetching?: boolean;
}

export default function WeatherPanel({ weather, marine, isFetching = false }: Props) {
    const [utcTime, setUtcTime] = useState('');

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setUtcTime(
                now.toUTCString().replace('GMT', 'UTC')
            );
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, []);

    if (!weather) {
        return (
            <div className="glass rounded-xl p-4 text-sm text-cyan-100 relative overflow-hidden" role="region" aria-label="Weather panel">
                {isFetching && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-50">
                        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                <p className="text-gray-400">{t('noData')}</p>
            </div>
        );
    }

    const info = getWeatherInfo(weather.weatherCode);

    return (
        <div className="glass rounded-xl p-4 text-sm text-cyan-100 space-y-3 max-h-[70vh] overflow-y-auto relative overflow-hidden" role="region" aria-label="Weather panel">
            {/* Critique #5: Smooth visual loading indicator overlay */}
            {isFetching && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-50">
                    <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* UTC Time */}
            <div className="hud-label hud-label-cyan text-[10px] border-b border-cyan-900/50 pb-2">
                {utcTime}
            </div>

            {/* Weather Header */}
            <div className="flex items-center gap-2">
                <span className="text-2xl">{info.icon}</span>
                <div>
                    <p className="hud-value-xl">{weather.temperature}°C</p>
                    <p className="text-xs text-cyan-100/50">{info.label}</p>
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="hud-label">{t('apparentTemp')}</span>
                <span className="hud-value hud-value-sm">{weather.apparentTemperature}°C</span>
                <span className="hud-label">{t('humidity')}</span>
                <span className="hud-value hud-value-sm">{weather.humidity}%</span>
                <span className="hud-label">{t('wind')}</span>
                <span className="hud-value hud-value-sm">{weather.windSpeed} km/h</span>
                <span className="hud-label">{t('waveDir')}</span>
                <span className="hud-value hud-value-sm">{weather.windDirection}°</span>
                <span className="hud-label">{t('precipitation')}</span>
                <span className="hud-value hud-value-sm">{weather.precipitation} mm</span>
            </div>

            {/* Marine */}
            {marine && (
                <div className="border-t border-cyan-900/50 pt-2 space-y-1">
                    <p className="text-xs font-medium text-cyan-400">{t('marineState')}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span className="text-cyan-100/50">{t('wave')}</span>
                        <span>{marine.waveHeight}m</span>
                        <span className="text-cyan-100/50">{t('period')}</span>
                        <span>{marine.wavePeriod}s</span>
                        <span className="text-cyan-100/50">{t('waveDir')}</span>
                        <span>{marine.waveDirection}°</span>
                        <span className="text-cyan-100/50">{t('seaTemp')}</span>
                        <span>{marine.seaSurfaceTemperature}°C</span>
                    </div>
                </div>
            )}
        </div>
    );
}
