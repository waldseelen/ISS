'use client';

import type { ParticleSettings } from '@/types';
import { getLanguage } from '@/lib/api';
import { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   Faz 2 / Madde 3: Parçacık Vektör Alanı Özelleştirme Paneli
   Windy-benzeri kontrol paneli: yoğunluk, kuyruk, kalınlık, hız
   ═══════════════════════════════════════════════════════════════ */

interface Props {
    settings: ParticleSettings;
    onChange: (update: Partial<ParticleSettings>) => void;
}

interface SliderConfig {
    key: keyof ParticleSettings;
    labelTR: string;
    labelEN: string;
    min: number;
    max: number;
    step: number;
    icon: string;
}

const SLIDERS: SliderConfig[] = [
    { key: 'density', labelTR: 'Yoğunluk', labelEN: 'Density', min: 0.1, max: 1.0, step: 0.05, icon: '◉' },
    { key: 'trailLength', labelTR: 'Kuyruk', labelEN: 'Trail', min: 0.5, max: 5.0, step: 0.1, icon: '〰' },
    { key: 'width', labelTR: 'Kalınlık', labelEN: 'Width', min: 0.5, max: 4.0, step: 0.1, icon: '━' },
    { key: 'speedMultiplier', labelTR: 'Hız', labelEN: 'Speed', min: 0.3, max: 3.0, step: 0.1, icon: '▸' },
];

export default function ParticleSettingsPanel({ settings, onChange }: Props) {
    const [collapsed, setCollapsed] = useState(true);
    const lang = getLanguage();

    return (
        <div className="glass rounded-xl overflow-hidden transition-all duration-300">
            {/* Toggle Header */}
            <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-cyan-500/5 transition-colors"
            >
                <span className="text-sm">🎛️</span>
                <span className="text-[11px] font-mono font-medium text-cyan-300/80 flex-1">
                    {lang === 'tr' ? 'Parçacık Ayarları' : 'Particle Settings'}
                </span>
                <span className={`text-[10px] text-cyan-500/60 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}>
                    ▼
                </span>
            </button>

            {/* Expandable Content */}
            {!collapsed && (
                <div className="px-3 pb-3 space-y-2.5 animate-slide-down">
                    {SLIDERS.map(({ key, labelTR, labelEN, min, max, step, icon }) => {
                        const value = settings[key];
                        const pct = ((value - min) / (max - min)) * 100;
                        return (
                            <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="hud-label flex items-center gap-1.5">
                                        <span className="text-cyan-500/70">{icon}</span>
                                        {lang === 'tr' ? labelTR : labelEN}
                                    </label>
                                    <span className="text-[10px] font-mono text-cyan-400/80 tabular-nums">
                                        {value.toFixed(key === 'density' ? 2 : 1)}
                                    </span>
                                </div>
                                <div className="relative h-5 flex items-center">
                                    {/* Track background */}
                                    <div className="absolute inset-x-0 h-1 rounded-full bg-cyan-900/40" />
                                    {/* Active track */}
                                    <div
                                        className="absolute left-0 h-1 rounded-full bg-gradient-to-r from-cyan-600/60 to-cyan-400/80"
                                        style={{ width: `${pct}%` }}
                                    />
                                    {/* Native range input (transparent, sits on top) */}
                                    <input
                                        type="range"
                                        min={min}
                                        max={max}
                                        step={step}
                                        value={value}
                                        onChange={(e) => onChange({ [key]: parseFloat(e.target.value) })}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        aria-label={lang === 'tr' ? labelTR : labelEN}
                                    />
                                    {/* Thumb indicator */}
                                    <div
                                        className="absolute w-3 h-3 rounded-full bg-cyan-400 border-2 border-cyan-800 shadow-lg shadow-cyan-500/30 pointer-events-none"
                                        style={{ left: `calc(${pct}% - 6px)` }}
                                    />
                                </div>
                            </div>
                        );
                    })}

                    {/* Reset button */}
                    <button
                        type="button"
                        onClick={() => onChange({ density: 1.0, trailLength: 2.2, width: 1.8, speedMultiplier: 1.2 })}
                        className="w-full mt-1 py-1.5 text-[9px] font-mono text-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5 rounded-lg transition-colors uppercase tracking-widest"
                    >
                        {lang === 'tr' ? '↺ Varsayılana Sıfırla' : '↺ Reset to Default'}
                    </button>
                </div>
            )}
        </div>
    );
}
