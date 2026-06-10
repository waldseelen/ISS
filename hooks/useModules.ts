'use client';

import type { BaseStyle, ModuleState, TileGroup } from '@/types';
import { useCallback, useState } from 'react';

const DEFAULT_STATE: ModuleState = {
    globe3D: true,
    map2D: false,
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
    iss: true,
    marine: false,
    clouds: false,
    performanceMode: false,
    tileGroup: 'none',
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
            return next;
        });
    }, []);

    return {
        modules,
        toggle,
        baseStyle: baseStyleOf(modules),
        tileGroup: modules.tileGroup,
    };
}
