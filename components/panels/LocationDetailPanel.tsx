'use client';

import { getWeatherInfo, windDirLabel, t, fetchElevationProfile, fetchClimatology, getLanguage } from '@/lib/api';
import type { ForecastDay, LocationDetail } from '@/types';
import { useState, useEffect } from 'react';
import { playBeep } from '@/lib/audio';

interface Props {
    location: LocationDetail;
    isFetching?: boolean;
    onClose: () => void;
    onBookmarkChange?: () => void;
}

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ForecastCard({ day }: { day: ForecastDay }) {
    const d = new Date(day.date + 'T12:00:00');
    const lang = typeof window !== 'undefined' ? localStorage.getItem('earth_tracker_lang') : 'tr';
    const dayName = lang === 'en' ? DAYS_EN[d.getDay()] : DAYS_TR[d.getDay()];
    const info = getWeatherInfo(day.weatherCode);
    return (
        <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl bg-white/5 min-w-[54px] border border-white/5 forecast-card-glow">
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

export default function LocationDetailPanel({ location, isFetching = false, onClose, onBookmarkChange }: Props) {
    const info = getWeatherInfo(location.weatherCode);
    const ns = location.latitude >= 0 ? 'N' : 'S';
    const ew = location.longitude >= 0 ? 'E' : 'W';
    const tzCity = location.timezone.split('/').pop()?.replace('_', ' ') ?? location.timezone;

    const [elevations, setElevations] = useState<number[] | null>(null);
    const [loadingElev, setLoadingElev] = useState(false);
    
    // Faz 4 / Madde 3: Real climatology data from Open-Meteo Archive
    const [climatology, setClimatology] = useState<{ monthlyAvg: number; history: number[] } | null>(null);
    const [loadingClim, setLoadingClim] = useState(false);

    // Yer İmleri State ve Kontrolleri
    const [isBookmarked, setIsBookmarked] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const saved = localStorage.getItem('earth_tracker_bookmarks');
            if (saved) {
                const list = JSON.parse(saved);
                const found = list.some((b: any) => 
                    Math.abs(b.latitude - location.latitude) < 0.0001 && 
                    Math.abs(b.longitude - location.longitude) < 0.0001
                );
                setIsBookmarked(found);
            } else {
                setIsBookmarked(false);
            }
        } catch {
            setIsBookmarked(false);
        }
    }, [location.latitude, location.longitude]);

    const toggleBookmark = () => {
        if (typeof window === 'undefined') return;
        playBeep('click');
        try {
            const saved = localStorage.getItem('earth_tracker_bookmarks');
            let list = saved ? JSON.parse(saved) : [];
            const idx = list.findIndex((b: any) => 
                Math.abs(b.latitude - location.latitude) < 0.0001 && 
                Math.abs(b.longitude - location.longitude) < 0.0001
            );
            
            if (idx > -1) {
                list.splice(idx, 1);
                setIsBookmarked(false);
            } else {
                const bookmarkId = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
                list.push({
                    id: bookmarkId,
                    name: location.locationName,
                    latitude: location.latitude,
                    longitude: location.longitude
                });
                setIsBookmarked(true);
            }
            localStorage.setItem('earth_tracker_bookmarks', JSON.stringify(list));
            if (onBookmarkChange) {
                onBookmarkChange();
            }
        } catch {}
    };

    // ── Load Elevation Profile slice for terrain profiling (15 points) ──
    useEffect(() => {
        setLoadingElev(true);
        fetchElevationProfile(location.latitude, location.longitude)
            .then(data => {
                setElevations(data);
            })
            .catch(() => {})
            .finally(() => setLoadingElev(false));
    }, [location.latitude, location.longitude]);

    // ── Load Climatology Anomaly from Open-Meteo Archive ──
    useEffect(() => {
        setLoadingClim(true);
        fetchClimatology(location.latitude, location.longitude)
            .then(data => {
                setClimatology(data);
            })
            .catch(() => {})
            .finally(() => setLoadingClim(false));
    }, [location.latitude, location.longitude]);

    // Play subtle high-tech click sound when panel mounts
    useEffect(() => {
        playBeep('radar');
    }, [location.locationName]);

    const currentMonthIndex = new Date().getMonth();
    const monthsTR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const monthsEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const lang = getLanguage();
    const activeMonthLabel = lang === 'tr' ? monthsTR[currentMonthIndex] : monthsEN[currentMonthIndex];

    // SVG scaling helper for terrain chart (dynamic 15 points center)
    const renderElevationSVG = () => {
        if (!elevations || elevations.length === 0) return null;
        const width = 310;
        const height = 45;
        const max = Math.max(...elevations, 100);
        const min = Math.min(...elevations, 0);
        const range = max - min || 1;

        const points = elevations.map((h, i) => {
            const x = (i * width) / (elevations.length - 1);
            const y = height - ((h - min) / range) * (height - 8) - 2;
            return { x, y, h };
        });

        const pathD = `M 0,${height} ` + points.map(p => `L ${p.x},${p.y}`).join(' ') + ` L ${width},${height} Z`;
        const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

        // The middle point (index 7 for 15 points) is the exact clicked coordinate
        const centerPin = points[Math.floor(points.length / 2)];

        return (
            <div className="relative border border-cyan-900/30 rounded-xl p-2 bg-cyan-950/20">
                <p className="text-[9px] text-gray-500 font-mono flex justify-between uppercase tracking-wider mb-1">
                    <span>🗻 TOPOGRAFİK YÜKSEKLİK PROFİLİ</span>
                    <span className="text-cyan-400 font-semibold">{centerPin.h}m</span>
                </p>
                <div className="relative h-[45px] w-[310px]">
                    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
                        <defs>
                            <linearGradient id={`terrainGrad-${centerPin.h.toFixed(0)}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <path d={pathD} fill={`url(#terrainGrad-${centerPin.h.toFixed(0)})`} />
                        <path d={lineD} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                        <circle cx={centerPin.x} cy={centerPin.y} r="3" fill="#ff007f" className="animate-pulse" />
                        <circle cx={centerPin.x} cy={centerPin.y} r="5" fill="none" stroke="#ff007f" strokeWidth="1" className="animate-ping" />
                    </svg>
                </div>
                <div className="flex justify-between text-[8px] text-gray-500 font-mono mt-1">
                    <span>-10km (Batı)</span>
                    <span className="text-cyan-400 font-semibold">{centerPin.h}m (Merkez)</span>
                    <span>+10km (Doğu)</span>
                </div>
            </div>
        );
    };

    // SVG scaling helper for Climatology anomaly chart using real archive data
    const renderClimatologySVG = () => {
        if (!climatology) return null;
        
        const width = 310;
        const height = 45;
        const temps = climatology.history;
        const max = Math.max(...temps, location.temperature) + 3;
        const min = Math.min(...temps, location.temperature) - 3;
        const range = max - min || 1;

        const points = temps.map((val, i) => {
            const x = (i * width) / (temps.length - 1);
            const y = height - ((val - min) / range) * (height - 8) - 2;
            return { x, y, temp: val };
        });

        const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

        // Current day active comparison point (middle point representing current timeline offset)
        const activePoint = points[Math.floor(points.length / 2)];
        const currentY = height - ((location.temperature - min) / range) * (height - 8) - 2;

        const anomaly = Math.round((location.temperature - climatology.monthlyAvg) * 10) / 10;
        const isAnomalyHot = anomaly >= 0;

        return (
            <div className="relative border border-cyan-900/30 rounded-xl p-2 bg-cyan-950/20 mt-2">
                <div className="text-[9px] font-mono flex justify-between uppercase tracking-wider mb-1">
                    <span className="text-gray-500">📊 TARİHSEL İKLİM ANOMALİSİ</span>
                    <span className={`font-semibold ${isAnomalyHot ? 'text-red-400' : 'text-blue-400'}`}>
                        {activeMonthLabel} Ort: {climatology.monthlyAvg}°C ({anomaly >= 0 ? `+${anomaly}` : anomaly}°C)
                    </span>
                </div>
                <div className="relative h-[45px] w-[310px]">
                    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
                        {/* Climatology seasonal stroke curve */}
                        <path d={lineD} fill="none" stroke="#0891b2" strokeWidth="1.2" strokeDasharray="3,3" />
                        {/* Climatology seasonal normal dot */}
                        <circle cx={activePoint.x} cy={activePoint.y} r="2.5" fill="#0891b2" />
                        {/* Actual current temperature dot */}
                        <circle cx={activePoint.x} cy={currentY} r="3.5" fill={isAnomalyHot ? '#f87171' : '#60a5fa'} />
                        <line x1={activePoint.x} y1={activePoint.y} x2={activePoint.x} y2={currentY} stroke={isAnomalyHot ? '#f87171' : '#60a5fa'} strokeWidth="1" strokeDasharray="1,2" />
                    </svg>
                </div>
                <p className="text-[8px] text-gray-500 font-mono mt-1 text-center">
                    Kesik çizgiler son 3 yılın {activeMonthLabel} ayı ortalamasını, renkli nokta güncel ölçümü gösterir.
                </p>
            </div>
        );
    };

    return (
        <div className="glass-elevated rounded-2xl p-4 text-sm text-cyan-100 animate-fade-in relative overflow-hidden w-full border border-cyan-500/20 backdrop-blur-xl" role="region" aria-label="Location detailed weather panel">
            {/* Smooth loading overlay */}
            {(isFetching || loadingElev) && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] rounded-2xl flex items-center justify-center z-50 transition-all duration-300">
                    <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* ── Başlık: şehir + ülke ── */}
            <div className="flex items-start justify-between mb-2.5">
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-cyan-300 text-base leading-snug truncate font-sans-token">
                        {location.locationName}
                    </p>
                    <p className="text-[10px] text-cyan-100/50 font-mono mt-0.5">
                        {Math.abs(location.latitude).toFixed(3)}°{ns}
                        {Math.abs(location.longitude).toFixed(3)}°{ew}
                    </p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                    <button
                        onClick={toggleBookmark}
                        className={`text-lg transition-colors leading-none ${isBookmarked ? 'text-amber-400 hover:text-amber-500' : 'text-cyan-100/40 hover:text-cyan-200'}`}
                        aria-label={isBookmarked ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                    >
                        {isBookmarked ? '★' : '☆'}
                    </button>
                    <button
                        onClick={onClose}
                        className="text-cyan-100/40 hover:text-cyan-200 transition-colors text-xl leading-none"
                        aria-label="Close panel"
                    >
                        ×
                    </button>
                </div>
            </div>

            {/* ── Yerel saat ── */}
            <div className="flex items-center justify-between bg-cyan-950/40 rounded-xl px-3 py-1.5 mb-2.5 border border-cyan-950/60">
                <div>
                    <p className="text-[9px] text-cyan-100/50 uppercase tracking-wider font-mono">{t('localTime')} – {tzCity}</p>
                    <p className="text-base font-mono font-bold text-cyan-300">{location.localTime}</p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] text-cyan-100/50 uppercase tracking-wider font-mono">UTC</p>
                    <p className="text-xs font-mono text-cyan-100/70">{location.utcTime}</p>
                </div>
            </div>

            {/* ── Mevcut hava durumu ── */}
            <div className="flex items-center gap-3 mb-2.5 bg-white/5 rounded-xl p-2 border border-white/5">
                <span className="text-3.5xl leading-none">{info.icon}</span>
                <div>
                    <p className="hud-value-xl">{location.temperature}°C</p>
                    <p className="text-[11px] text-cyan-100/50 mt-0.5">
                        {t('apparentTemp')} {location.feelsLike}°C • {info.label}
                    </p>
                </div>
            </div>

            {/* ── Detay ızgarası ── */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs border-b border-cyan-900/30 pb-2.5 mb-2.5">
                <span className="text-cyan-100/50">💧 {t('humidity')}</span>         <span className="text-right text-cyan-100/90 font-semibold">{location.humidity}%</span>
                <span className="text-cyan-100/50">🌧️ {t('precipitation')}</span>      <span className="text-right text-cyan-100/90 font-semibold">{location.precipitation} mm</span>
                <span className="text-cyan-100/50">☁️ {t('clouds')}</span>       <span className="text-right text-cyan-100/90 font-semibold">{location.cloudCover}%</span>
                <span className="text-cyan-100/50">💨 {t('wind')}</span>     <span className="text-right text-cyan-100/90 font-semibold">{location.windSpeed} km/h {windDirLabel(location.windDirection)}</span>
                <span className="text-cyan-100/50">🌪️ {t('windGust')}</span>       <span className="text-right text-cyan-100/90 font-semibold">{location.windGust} km/h</span>
                <span className="text-cyan-100/50">🔽 {t('pressure')}</span>      <span className="text-right text-cyan-100/90 font-semibold">{Math.round(location.pressure)} hPa</span>
                <span className="text-cyan-100/50">👁️ {t('visibility')}</span>       <span className="text-right text-cyan-100/90 font-semibold">{location.visibility} km</span>
                <span className="text-cyan-100/50">☀️ {t('uv')}</span>           <span className="text-right text-cyan-100/90 font-semibold">{location.uvIndex}</span>
            </div>

            {/* ── SVG Topografik Yükseklik Profili & İklim Anomalisi ── */}
            {elevations && elevations.length > 0 && renderElevationSVG()}
            {renderClimatologySVG()}

            {/* ── 5 Günlük Tahmin ── */}
            {location.forecast && location.forecast.length > 0 && (
                <div className="mt-3">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider font-mono mb-1.5">{t('forecast5Days')}</p>
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
