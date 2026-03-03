'use client';

import type { ModuleState } from '@/types';

interface Props {
    modules: ModuleState;
    onToggle: (key: keyof ModuleState) => void;
}

const TOOLS: { key: keyof ModuleState; icon: string; label: string }[] = [
    { key: 'weather', icon: '🌤️', label: 'Hava Durumu' },
    { key: 'wind', icon: '💨', label: 'Rüzgar' },
    { key: 'iss', icon: '🛰️', label: 'ISS' },
    { key: 'marine', icon: '🌊', label: 'Deniz' },
    { key: 'precipitation', icon: '🌧️', label: 'Yağış' },
    { key: 'temperature', icon: '🌡️', label: 'Sıcaklık' },
    { key: 'nightLights', icon: '🌃', label: 'Gece Işıkları' },
];

export default function Toolbar({ modules, onToggle }: Props) {
    return (
        <aside
            className="fixed left-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1 bg-black/70 backdrop-blur rounded-xl p-2"
            aria-label="Toolbar"
        >
            {TOOLS.map(t => {
                const active = modules[t.key];
                const ariaPressedValue = active ? 'true' : 'false';
                return (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onToggle(t.key)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${active ? 'bg-cyan-900/60 text-cyan-300' : 'text-gray-500 hover:text-gray-300'
                            }`}
                        aria-pressed={ariaPressedValue}
                        title={t.label}
                    >
                        <span className="text-base">{t.icon}</span>
                    </button>
                );
            })}
        </aside>
    );
}
