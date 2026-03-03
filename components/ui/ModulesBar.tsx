'use client';

import type { ModuleState } from '@/types';

interface Props {
    modules: ModuleState;
    onToggle: (key: keyof ModuleState) => void;
}

const BUTTONS: { key: keyof ModuleState; icon: string; label: string }[] = [
    { key: 'globe3D', icon: '🌐', label: '3D' },
    { key: 'map2D', icon: '🗺️', label: '2D' },
    { key: 'weather', icon: '🌤️', label: 'Hava' },
    { key: 'wind', icon: '💨', label: 'Rüzgar' },
    { key: 'iss', icon: '🛰️', label: 'ISS' },
    { key: 'marine', icon: '🌊', label: 'Deniz' },
    { key: 'precipitation', icon: '🌧️', label: 'Yağış' },
    { key: 'temperature', icon: '🌡️', label: 'Sıcaklık' },
    { key: 'nightLights', icon: '🌃', label: 'Gece' },
];

export default function ModulesBar({ modules, onToggle }: Props) {
    return (
        <nav
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 bg-black/80 backdrop-blur rounded-full px-3 py-2"
            aria-label="Module toggles"
        >
            {BUTTONS.map(b => {
                const active = modules[b.key];
                const ariaPressedValue = active ? 'true' : 'false';
                return (
                    <button
                        key={b.key}
                        type="button"
                        onClick={() => onToggle(b.key)}
                        className={`flex flex-col items-center px-2 py-1 rounded-lg text-xs transition-colors ${active ? 'bg-cyan-900/60 text-cyan-300' : 'text-gray-500 hover:text-gray-300'
                            }`}
                        aria-pressed={ariaPressedValue}
                        title={b.label}
                    >
                        <span className="text-base">{b.icon}</span>
                        <span className="mt-0.5">{b.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
