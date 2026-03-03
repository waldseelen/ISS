'use client';

import type { ModuleState } from '@/types';
import { useCallback, useState } from 'react';

const DEFAULT_STATE: ModuleState = {
    globe3D: true,
    map2D: false,
    satellite: true,
    street: false,
    topo: false,
    nasaGIBS: false,
    nightLights: true,
    dayNight: true,
    weather: true,
    wind: false,
    precipitation: false,
    temperature: false,
    iss: true,
    marine: false,
    clouds: false,
};

const TILE_LAYERS = ['weather', 'wind', 'precipitation', 'temperature', 'nightLights'] as const;
const VIEW_MODES = ['globe3D', 'map2D'] as const;

export function useModules() {
    const [modules, setModules] = useState<ModuleState>(DEFAULT_STATE);

    const toggle = useCallback((key: keyof ModuleState) => {
        setModules(prev => {
            const next = { ...prev };

            // View mode toggling – mutually exclusive
            if (VIEW_MODES.includes(key as typeof VIEW_MODES[number])) {
                for (const m of VIEW_MODES) next[m] = m === key;
                return next;
            }

            next[key] = !prev[key];
            return next;
        });
    }, []);

    const setMode = useCallback((mode: 'globe3D' | 'map2D') => {
        setModules(prev => {
            if (prev[mode]) return prev;
            const next = { ...prev };
            for (const m of VIEW_MODES) next[m] = m === mode;
            return next;
        });
    }, []);

    return { modules, toggle, setMode };
}
