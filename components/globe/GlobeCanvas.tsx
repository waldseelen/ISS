'use client';

import type { ISSData, ModuleState, SunPosition, WindPoint } from '@/types';
import { useEffect, useRef } from 'react';

interface Props {
    globeAPI: {
        mount: (el: HTMLDivElement) => void;
        unmount: () => void;
        updateSun: (pos: SunPosition) => void;
        updateISS: (data: ISSData | null, trail: { lat: number; lon: number }[], prediction: { lat: number; lon: number }[]) => void;
        updateWind: (data: WindPoint[]) => void;
        updateModules: (m: ModuleState) => void;
        flyTo: (lat: number, lon: number) => void;
        onCameraChange: (cb: (distance: number) => void) => void;
    };
    sunPos: SunPosition;
    iss: ISSData | null;
    trail: { lat: number; lon: number }[];
    prediction: { lat: number; lon: number }[];
    wind: WindPoint[];
    modules: ModuleState;
    flyTarget: { lat: number; lon: number } | null;
    onCameraChange?: (distance: number) => void;
}

export default function GlobeCanvas({
    globeAPI,
    sunPos,
    iss,
    trail,
    prediction,
    wind,
    modules,
    flyTarget,
    onCameraChange,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mountedRef = useRef(false);

    /* Mount / Unmount */
    useEffect(() => {
        if (!containerRef.current || mountedRef.current) return;
        mountedRef.current = true;
        globeAPI.mount(containerRef.current);
        return () => {
            globeAPI.unmount();
            mountedRef.current = false;
        };
    }, [globeAPI]);

    /* Camera change listener */
    useEffect(() => {
        if (onCameraChange) {
            globeAPI.onCameraChange(onCameraChange);
        }
    }, [globeAPI, onCameraChange]);

    /* Sun */
    useEffect(() => {
        globeAPI.updateSun(sunPos);
    }, [globeAPI, sunPos]);

    /* ISS */
    useEffect(() => {
        globeAPI.updateISS(iss, trail, prediction);
    }, [globeAPI, iss, trail, prediction]);

    /* Wind */
    useEffect(() => {
        globeAPI.updateWind(wind);
    }, [globeAPI, wind]);

    /* Modules visibility */
    useEffect(() => {
        globeAPI.updateModules(modules);
    }, [globeAPI, modules]);

    /* Fly to target */
    useEffect(() => {
        if (flyTarget) {
            globeAPI.flyTo(flyTarget.lat, flyTarget.lon);
        }
    }, [globeAPI, flyTarget]);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full"
            aria-label="3D Globe view"
        />
    );
}
