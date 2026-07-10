'use client';

import type { BaseStyle, LayerOrderKey, ModuleState, ParticleSettings, TileGroup } from '@/types';
import { useCallback, useState } from 'react';

/* Faz 2 / Madde 2+3: Varsayılan parçacık ayarları */
const DEFAULT_PARTICLES: ParticleSettings = {
    density: 1.0,
    trailLength: 2.2,
    width: 1.8,
    speedMultiplier: 1.2,
};

const PERF_PARTICLES: ParticleSettings = {
    density: 0.33,
    trailLength: 1.4,
    width: 1.2,
    speedMultiplier: 0.8,
};

/* Kanonik render sırası (düşük index = altta). Zoom Earth mantığı:
   altlık → uydu reflektans → gece ışıkları → gündüz/gece gölgesi →
   sıcaklık → yağış → bulut → (deck) rüzgar → deniz → imleç. */
const DEFAULT_LAYER_ORDER: LayerOrderKey[] = [
    'nasaGIBS', 'nightLights', 'dayNight', 'temperature', 'precipitation', 'clouds', 'wind', 'marine',
];

const DEFAULT_STATE: ModuleState = {
    globe3D: false,
    map2D: true,
    satellite: true,
    street: false,
    topo: false,
    nasaGIBS: false,
    nightLights: false,
    dayNight: true,
    weather: true,
    wind: false,
    precipitation: false,
    temperature: false,
    marine: false,
    clouds: false,
    performanceMode: false,
    tileGroup: 'none',
    particleSettings: DEFAULT_PARTICLES,
    layerOrder: DEFAULT_LAYER_ORDER,
};

const VIEW_MODES = ['globe3D', 'map2D'] as const;
const BASE_STYLE_KEYS: BaseStyle[] = ['satellite', 'street', 'topo'];
const TILE_TOGGLE_KEYS = ['precipitation', 'temperature', 'clouds'] as const;
type TileToggleKey = typeof TILE_TOGGLE_KEYS[number];

function baseStyleOf(m: ModuleState): BaseStyle {
    if (m.satellite) return 'satellite';
    if (m.street) return 'street';
    if (m.topo) return 'topo';
    return 'satellite';
}

function isTileToggleKey(k: keyof ModuleState): k is TileToggleKey {
    return (TILE_TOGGLE_KEYS as readonly string[]).includes(k as string);
}

export function useModules() {
    const [modules, setModules] = useState<ModuleState>(DEFAULT_STATE);

    const toggle = useCallback((key: keyof ModuleState) => {
        setModules(prev => {
            const next = { ...prev };

            if (VIEW_MODES.includes(key as typeof VIEW_MODES[number])) {
                for (const m of VIEW_MODES) next[m] = m === key;
                return next;
            }

            if (BASE_STYLE_KEYS.includes(key as BaseStyle)) {
                for (const k of BASE_STYLE_KEYS) next[k] = k === key;
                return next;
            }

            if (isTileToggleKey(key)) {
                const turningOn = !prev[key];
                for (const k of TILE_TOGGLE_KEYS) {
                    (next as any)[k] = turningOn ? k === key : false;
                }
                next.tileGroup = turningOn ? (key as TileGroup) : 'none';
                return next;
            }

            (next as any)[key] = !prev[key];

            /* Faz 2 / Madde 2: Performans Modu aktif olduğunda
               parçacık ayarlarını otomatik düşür */
            if (key === 'performanceMode') {
                next.particleSettings = next.performanceMode
                    ? PERF_PARTICLES
                    : DEFAULT_PARTICLES;
            }

            return next;
        });
    }, []);

    const updateParticleSettings = useCallback((update: Partial<ParticleSettings>) => {
        setModules(prev => ({
            ...prev,
            particleSettings: { ...prev.particleSettings, ...update },
        }));
    }, []);

    /* Faz 3 / Madde 1: Katman sıralama (swap-based reorder) */
    const reorderLayers = useCallback((from: number, to: number) => {
        setModules(prev => {
            const order = [...prev.layerOrder];
            const [item] = order.splice(from, 1);
            order.splice(to, 0, item);
            return { ...prev, layerOrder: order };
        });
    }, []);

    return {
        modules,
        toggle,
        updateParticleSettings,
        reorderLayers,
        baseStyle: baseStyleOf(modules),
        tileGroup: modules.tileGroup,
    };
}
