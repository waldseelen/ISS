'use client';

import { getWeatherInfo, windDirLabel } from '@/lib/api';
import type { ForecastDay, LocationDetail } from '@/types';
import { WMO_CODES } from '@/types';

interface Props {
    location: LocationDetail;
    onClose: () => void;
}

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function ForecastCard({ day }: { day: ForecastDay }) {
    const d = new Date(day.date + 'T12:00:00');
    const dayName = DAYS_TR[d.getDay()];
    const info = WMO_CODES[day.weatherCode] ?? { label: '', icon: '☁️' };
    return (
        <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl bg-white/5 min-w-[54px]">
            <span className="text-[10px] text-gray-400 font-medium">{dayName}</span>
            <span className="text-base leading-tight">{info.icon}</span>
            <span className="text-xs font-semibold text-cyan-200">{day.tempMax}°</span>
            <span className="text-[10px] text-gray-500">{day.tempMin}°</span>
            {day.precipitationSum > 0 && (
                <span className="text-[9px] text-blue-400">{day.precipitationSum}mm</span>
            )}
        </div>
    );
}

export default function LocationDetailPanel({ location, onClose }: Props) {
    const info = getWeatherInfo(location.weatherCode);
    const ns = location.latitude >= 0 ? 'N' : 'S';
    const ew = location.longitude >= 0 ? 'E' : 'W';
    const tzCity = location.timezone.split('/').pop()?.replace('_', ' ') ?? location.timezone;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[380px] max-w-[calc(100vw-2rem)] glass-elevated rounded-2xl p-4 text-sm text-cyan-100 animate-fade-in">
            {/* ── Başlık: şehir + ülke ── */}
            <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                    <p className="font-bold text-cyan-300 text-base leading-snug truncate">
                        {location.locationName}
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {Math.abs(location.latitude).toFixed(3)}°{ns}
                        {Math.abs(location.longitude).toFixed(3)}°{ew}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="ml-3 shrink-0 text-gray-500 hover:text-cyan-400 transition-colors text-xl leading-none"
                    aria-label="Kapat"
                >
                    ×
                </button>
            </div>

            {/* ── Yerel saat ── */}
            <div className="flex items-center justify-between bg-cyan-950/40 rounded-xl px-3 py-2 mb-3">
                <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Yerel Saat – {tzCity}</p>
                    <p className="text-xl font-mono font-bold text-cyan-300">{location.localTime}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">UTC</p>
                    <p className="text-sm font-mono text-gray-300">{location.utcTime}</p>
                </div>
            </div>

            {/* ── Mevcut hava ── */}
            <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">{info.icon}</span>
                <div>
                    <p className="text-2xl font-bold">{location.temperature}°C</p>
                    <p className="text-xs text-gray-400">
                        Hissedilen {location.feelsLike}°C • {info.label}
                    </p>
                </div>
            </div>

            {/* ── Detay ızgara ── */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs border-b border-cyan-900/30 pb-3 mb-3">
                <span className="text-gray-400">💧 Nem</span>         <span>{location.humidity}%</span>
                <span className="text-gray-400">🌧️ Yağış</span>      <span>{location.precipitation} mm</span>
                <span className="text-gray-400">☁️ Bulut</span>       <span>{location.cloudCover}%</span>
                <span className="text-gray-400">💨 Rüzgar</span>     <span>{location.windSpeed} km/h {windDirLabel(location.windDirection)}</span>
                <span className="text-gray-400">🌪️ Hamle</span>       <span>{location.windGust} km/h</span>
                <span className="text-gray-400">🔽 Basınç</span>      <span>{Math.round(location.pressure)} hPa</span>
                <span className="text-gray-400">👁️ Görüş</span>       <span>{location.visibility} km</span>
                <span className="text-gray-400">☀️ UV</span>           <span>{location.uvIndex}</span>
            </div>

            {/* ── 5 Günlük Tahmin ── */}
            {location.forecast && location.forecast.length > 0 && (
                <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">5 Günlük Tahmin</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {location.forecast.map(day => (
                            <ForecastCard key={day.date} day={day} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
