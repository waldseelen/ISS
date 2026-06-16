'use client';

import { getLanguage, setLanguage, t as translate } from '@/lib/api';
import type { ModuleState } from '@/types';

interface Props {
    modules: ModuleState;
    onToggle: (key: keyof ModuleState) => void;
}

const MODE_TOOLS: { key: keyof ModuleState; icon: string; label: string }[] = [
    { key: 'globe3D', icon: '🌐', label: '3D Küre' },
    { key: 'map2D', icon: '🗺️', label: '2D Harita' },
];

const LAYER_TOOLS: { key: keyof ModuleState; icon: string; label: string }[] = [
    { key: 'weather', icon: '🌤️', label: 'Hava Durumu' },
    { key: 'wind', icon: '💨', label: 'Rüzgar' },
    { key: 'marine', icon: '🌊', label: 'Deniz' },
    { key: 'precipitation', icon: '🌧️', label: 'Yağış' },
    { key: 'temperature', icon: '🌡️', label: 'Sıcaklık' },
    { key: 'nightLights', icon: '🌃', label: 'Gece Işıkları' },
    { key: 'clouds', icon: '☁️', label: 'Bulutlar' },
    { key: 'dayNight', icon: '🌗', label: 'Gündüz/Gece' },
    { key: 'nasaGIBS', icon: '🛸', label: 'NASA GIBS' },
    { key: 'topo', icon: '⛰️', label: 'Topo' },
    { key: 'street', icon: '🛣️', label: 'Yol' },
    { key: 'satellite', icon: '📡', label: 'Uydu' },
    { key: 'performanceMode', icon: '⚡', label: 'Performans Modu' },
];

const getLocalizedLabel = (key: string, defaultLabel: string) => {
    switch (key) {
        case 'globe3D': return getLanguage() === 'tr' ? '3D Küre' : '3D Globe';
        case 'map2D': return getLanguage() === 'tr' ? '2D Harita' : '2D Map';
        case 'weather': return getLanguage() === 'tr' ? 'Hava Durumu' : 'Weather';
        case 'wind': return getLanguage() === 'tr' ? 'Rüzgar' : 'Wind';
        case 'marine': return getLanguage() === 'tr' ? 'Deniz' : 'Marine';
        case 'precipitation': return getLanguage() === 'tr' ? 'Yağış' : 'Precipitation';
        case 'temperature': return getLanguage() === 'tr' ? 'Sıcaklık' : 'Temperature';
        case 'nightLights': return getLanguage() === 'tr' ? 'Gece Işıkları' : 'Night Lights';
        case 'clouds': return getLanguage() === 'tr' ? 'Bulutlar' : 'Clouds';
        case 'dayNight': return getLanguage() === 'tr' ? 'Gündüz/Gece' : 'Day/Night';
        case 'nasaGIBS': return 'NASA GIBS';
        case 'topo': return 'Topo';
        case 'street': return getLanguage() === 'tr' ? 'Yol' : 'Street';
        case 'satellite': return getLanguage() === 'tr' ? 'Uydu' : 'Satellite';
        case 'performanceMode': return translate('performanceMode');
        default: return defaultLabel;
    }
};

/* Visual hint for mutually-exclusive groups */
const getGroupHint = (key: keyof ModuleState, modules: ModuleState): string | null => {
    if (key === 'satellite' && modules.satellite) return '●';
    if (key === 'street' && modules.street) return '●';
    if (key === 'topo' && modules.topo) return '●';
    if (key === 'precipitation' && modules.precipitation) return '●';
    if (key === 'temperature' && modules.temperature) return '●';
    if (key === 'clouds' && modules.clouds) return '●';
    return null;
};

export default function Toolbar({ modules, onToggle }: Props) {
    const lang = getLanguage();

    return (
        <aside
            className={[
                'group',
                'fixed left-3 top-1/2 -translate-y-1/2 z-40',
                'flex flex-col gap-0.5',
                'glass rounded-2xl',
                'p-1.5',
                'max-h-[85vh] overflow-y-auto overflow-x-hidden',
                /* pill (dar) → genişlemiş geçiş (hover + focus-within for mobile) */
                'w-11 hover:w-52 focus-within:w-52 transition-[width] duration-300 ease-in-out',
            ].join(' ')}
            aria-label="Toolbar"
        >
            {/* ── Mod seçimi: 3D / 2D ── */}
            <div className="flex flex-col gap-0.5 pb-1 mb-0.5 border-b border-cyan-900/40">
                {MODE_TOOLS.map(t => {
                    const active = Boolean(modules[t.key]);
                    const localizedLabel = getLocalizedLabel(t.key, t.label);
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => onToggle(t.key)}
                            aria-pressed={active}
                            aria-label={localizedLabel}
                            className={[
                                'flex items-center gap-2.5 px-1.5 py-2 rounded-xl',
                                'w-full min-w-0 transition-colors duration-150',
                                'focus:outline-none focus:ring-1 focus:ring-cyan-500',
                                active
                                    ? 'bg-cyan-400/25 text-cyan-200 shadow-inner shadow-cyan-500/30 ring-1 ring-cyan-400/40'
                                    : 'text-cyan-100/50 hover:text-cyan-200 hover:bg-white/5',
                            ].join(' ')}
                            title={localizedLabel}
                        >
                            {/* sabit genişlikte ikon hücresi – pill kararlı kalır */}
                            <span className="text-base shrink-0 w-7 text-center leading-none">
                                {t.icon}
                            </span>
                            {/* etiket: hover'da fade-in */}
                            <span className="whitespace-nowrap overflow-hidden text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {localizedLabel}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Katman toggle'ları ── */}
            {LAYER_TOOLS.map(t => {
                const active = Boolean(modules[t.key]);
                const localizedLabel = getLocalizedLabel(t.key, t.label);
                const hint = getGroupHint(t.key, modules);
                return (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onToggle(t.key)}
                        aria-pressed={active}
                        aria-label={localizedLabel}
                        className={[
                            'flex items-center gap-2.5 px-1.5 py-2 rounded-xl',
                            'w-full min-w-0 transition-colors duration-150',
                            'focus:outline-none focus:ring-1 focus:ring-cyan-500',
                            active
                                ? 'bg-cyan-400/20 text-cyan-200 shadow-inner shadow-cyan-500/20 ring-1 ring-cyan-400/40'
                                : 'text-cyan-100/50 hover:text-cyan-200 hover:bg-white/5',
                        ].join(' ')}
                        title={localizedLabel}
                    >
                        <span className="text-base shrink-0 w-7 text-center leading-none">
                            {t.icon}
                        </span>
                        <span className="whitespace-nowrap overflow-hidden text-[11px] flex-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {localizedLabel}
                        </span>
                        {hint && (
                            <span className="text-cyan-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-200" aria-hidden>
                                {hint}
                            </span>
                        )}
                    </button>
                );
            })}

            {/* ── Dil Seçimi ── */}
            <div className="flex flex-col gap-0.5 pt-1 mt-0.5 border-t border-cyan-900/40">
                <button
                    type="button"
                    onClick={() => {
                        const newLang = lang === 'tr' ? 'en' : 'tr';
                        setLanguage(newLang);
                        if (typeof window !== 'undefined') {
                            window.location.reload();
                        }
                    }}
                    className={[
                        'flex items-center gap-2.5 px-1.5 py-2 rounded-xl',
                        'w-full min-w-0 transition-colors duration-150',
                        'text-cyan-400 hover:text-cyan-300 hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-cyan-500',
                    ].join(' ')}
                    title={lang === 'tr' ? 'Switch to English' : 'Türkçe\'ye Geç'}
                    aria-label="Toggle language"
                >
                    <span className="text-xs shrink-0 w-7 text-center font-bold leading-none font-mono">
                        {lang === 'tr' ? 'EN' : 'TR'}
                    </span>
                    <span className="whitespace-nowrap overflow-hidden text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {lang === 'tr' ? 'English' : 'Türkçe'}
                    </span>
                </button>
            </div>
        </aside>
    );
}
