'use client';

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
    { key: 'iss', icon: '🛰️', label: 'ISS' },
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
];

export default function Toolbar({ modules, onToggle }: Props) {
    return (
        <aside
            className={[
                'group',
                'fixed left-3 top-1/2 -translate-y-1/2 z-40',
                'flex flex-col gap-0.5',
                'glass rounded-2xl',
                'p-1.5',
                'max-h-[85vh] overflow-y-auto overflow-x-hidden',
                /* pill (dar) → genişlemiş geçiş */
                'w-11 hover:w-52 transition-[width] duration-300 ease-in-out',
            ].join(' ')}
            aria-label="Toolbar"
        >
            {/* ── Mod seçimi: 3D / 2D ── */}
            <div className="flex flex-col gap-0.5 pb-1 mb-0.5 border-b border-cyan-900/40">
                {MODE_TOOLS.map(t => {
                    const active = modules[t.key];
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => onToggle(t.key)}
                            className={[
                                'flex items-center gap-2.5 px-1.5 py-2 rounded-xl',
                                'w-full min-w-0 transition-colors duration-150',
                                active
                                    ? 'bg-cyan-700/70 text-white shadow-inner shadow-cyan-500/30'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5',
                            ].join(' ')}
                            title={t.label}
                        >
                            {/* sabit genişlikte ikon hücresi – pill kararlı kalır */}
                            <span className="text-base shrink-0 w-7 text-center leading-none">
                                {t.icon}
                            </span>
                            {/* etiket: hover'da fade-in */}
                            <span className="whitespace-nowrap overflow-hidden text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {t.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Katman toggle'ları ── */}
            {LAYER_TOOLS.map(t => {
                const active = modules[t.key];
                return (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onToggle(t.key)}
                        className={[
                            'flex items-center gap-2.5 px-1.5 py-2 rounded-xl',
                            'w-full min-w-0 transition-colors duration-150',
                            active
                                ? 'bg-cyan-900/60 text-cyan-300 shadow-inner shadow-cyan-500/20'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5',
                        ].join(' ')}
                        title={t.label}
                    >
                        <span className="text-base shrink-0 w-7 text-center leading-none">
                            {t.icon}
                        </span>
                        <span className="whitespace-nowrap overflow-hidden text-[11px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {t.label}
                        </span>
                    </button>
                );
            })}
        </aside>
    );
}
