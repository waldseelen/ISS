'use client';

import { getWeatherInfo } from '@/lib/api';
import type { MarineData, WeatherData } from '@/types';
import { useEffect, useState } from 'react';

interface Props {
    weather: WeatherData | null;
    marine: MarineData | null;
}

export default function WeatherPanel({ weather, marine }: Props) {
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
            <div className="glass rounded-xl p-4 text-sm text-cyan-100" role="region" aria-label="Weather panel">
                <p className="text-gray-400">Konum seçin veya haritaya tıklayın</p>
            </div>
        );
    }

    const info = getWeatherInfo(weather.weatherCode);

    return (
        <div className="glass rounded-xl p-4 text-sm text-cyan-100 space-y-3 max-h-[70vh] overflow-y-auto" role="region" aria-label="Weather panel">
            {/* UTC Time */}
            <div className="hud-label hud-label-cyan text-[10px] border-b border-cyan-900/50 pb-2">
                {utcTime}
            </div>

            {/* Weather Header */}
            <div className="flex items-center gap-2">
                <span className="text-2xl">{info.icon}</span>
                <div>
                    <p className="text-lg font-semibold">{weather.temperature}°C</p>
                    <p className="text-xs text-gray-400">{info.label}</p>
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="hud-label">Hissedilen</span>
                <span className="hud-value hud-value-sm">{weather.apparentTemperature}°C</span>
                <span className="hud-label">Nem</span>
                <span className="hud-value hud-value-sm">{weather.humidity}%</span>
                <span className="hud-label">Rüzgar</span>
                <span className="hud-value hud-value-sm">{weather.windSpeed} km/h</span>
                <span className="hud-label">Rüzgar Yönü</span>
                <span className="hud-value hud-value-sm">{weather.windDirection}°</span>
                <span className="hud-label">Yağış</span>
                <span className="hud-value hud-value-sm">{weather.precipitation} mm</span>
            </div>

            {/* Marine */}
            {marine && (
                <div className="border-t border-cyan-900/50 pt-2 space-y-1">
                    <p className="text-xs font-medium text-cyan-400">Deniz Durumu</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span className="text-gray-400">Dalga</span>
                        <span>{marine.waveHeight}m</span>
                        <span className="text-gray-400">Periyot</span>
                        <span>{marine.wavePeriod}s</span>
                        <span className="text-gray-400">Dalga Yönü</span>
                        <span>{marine.waveDirection}°</span>
                        <span className="text-gray-400">Su Sıcaklığı</span>
                        <span>{marine.seaSurfaceTemperature}°C</span>
                    </div>
                </div>
            )}
        </div>
    );
}
