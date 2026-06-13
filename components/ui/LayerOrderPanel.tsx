'use client';

import type { LayerOrderKey, ModuleState } from '@/types';
import { getLanguage } from '@/lib/api';

/* ═══════════════════════════════════════════════════════════════
   Faz 3 / Madde 1: Katman Sıralama Paneli
   Kullanıcı yukarı/aşağı butonlarıyla aktif katmanların
   render sırasını (z-order) değiştirebilir.
   ═══════════════════════════════════════════════════════════════ */

const LAYER_LABELS: Record<LayerOrderKey, { tr: string; en: string; icon: string }> = {
    nasaGIBS: { tr: 'NASA GIBS', en: 'NASA GIBS', icon: '🛸' },
    nightLights: { tr: 'Gece Işıkları', en: 'Night Lights', icon: '🌃' },
    temperature: { tr: 'Sıcaklık', en: 'Temperature', icon: '🌡️' },
    precipitation: { tr: 'Yağış', en: 'Precipitation', icon: '🌧️' },
    clouds: { tr: 'Bulutlar', en: 'Clouds', icon: '☁️' },
    dayNight: { tr: 'Gündüz/Gece', en: 'Day/Night', icon: '🌗' },
    wind: { tr: 'Rüzgar', en: 'Wind', icon: '💨' },
    marine: { tr: 'Deniz', en: 'Marine', icon: '🌊' },
    iss: { tr: 'ISS', en: 'ISS', icon: '🛰️' },
};

function isLayerActive(key: LayerOrderKey, modules: ModuleState): boolean {
    switch (key) {
        case 'nasaGIBS': return modules.nasaGIBS;
        case 'nightLights': return modules.nightLights;
        case 'temperature': return modules.tileGroup === 'temperature';
        case 'precipitation': return modules.tileGroup === 'precipitation';
        case 'clouds': return modules.tileGroup === 'clouds';
        case 'dayNight': return modules.dayNight;
        case 'wind': return modules.wind;
        case 'marine': return modules.marine;
        case 'iss': return modules.iss;
    }
}

interface Props {
    modules: ModuleState;
    onReorder: (from: number, to: number) => void;
}

export default function LayerOrderPanel({ modules, onReorder }: Props) {
    const lang = getLanguage();
    const order = modules.layerOrder;

    // Only show active layers
    const activeIndices = order
        .map((key, idx) => ({ key, idx }))
        .filter(({ key }) => isLayerActive(key, modules));

    if (activeIndices.length < 2) return null; // Need 2+ layers to reorder

    return (
        <div className="glass rounded-xl p-3 space-y-1.5">
            <p className="hud-label hud-label-cyan text-[9px] pb-1 border-b border-cyan-900/40">
                {lang === 'tr' ? '⇅ Katman Sırası' : '⇅ Layer Order'}
            </p>
            {activeIndices.map(({ key, idx }, visualIdx) => {
                const info = LAYER_LABELS[key];
                return (
                    <div
                        key={key}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-cyan-900/10 hover:bg-cyan-900/20 transition-colors text-[10px]"
                    >
                        <span className="text-xs shrink-0">{info.icon}</span>
                        <span className="flex-1 font-mono text-cyan-200/80 truncate">
                            {lang === 'tr' ? info.tr : info.en}
                        </span>
                        <button
                            type="button"
                            disabled={visualIdx === 0}
                            onClick={() => {
                                const prevActive = activeIndices[visualIdx - 1];
                                if (prevActive) onReorder(idx, prevActive.idx);
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Move ${info.en} up`}
                        >
                            ▲
                        </button>
                        <button
                            type="button"
                            disabled={visualIdx === activeIndices.length - 1}
                            onClick={() => {
                                const nextActive = activeIndices[visualIdx + 1];
                                if (nextActive) onReorder(idx, nextActive.idx);
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            aria-label={`Move ${info.en} down`}
                        >
                            ▼
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
