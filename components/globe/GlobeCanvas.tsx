'use client';

import { vector3ToLatLon } from '@/lib/globe';
import type { ISSData, ModuleState, SunPosition, WindPoint } from '@/types';
import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';

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
        getCamera: () => THREE.PerspectiveCamera | null;
    };
    sunPos: SunPosition;
    iss: ISSData | null;
    trail: { lat: number; lon: number }[];
    prediction: { lat: number; lon: number }[];
    wind: WindPoint[];
    modules: ModuleState;
    flyTarget: { lat: number; lon: number } | null;
    onCameraChange?: (distance: number) => void;
    onGlobeClick?: (lat: number, lon: number) => void;
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
    onGlobeClick,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mountedRef = useRef(false);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());

    const {
        mount,
        unmount,
        updateSun,
        updateISS,
        updateWind,
        updateModules,
        flyTo,
        onCameraChange: registerCameraChange,
        getCamera,
    } = globeAPI;

    /* Globe click → lat/lon via raycaster */
    const handleClick = useCallback((e: MouseEvent) => {
        if (!onGlobeClick || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const camera = getCamera();
        if (!camera) return;

        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        // Create a temp sphere for intersection
        const sphereGeo = new THREE.SphereGeometry(5, 64, 64);
        const sphereMat = new THREE.MeshBasicMaterial();
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        const intersects = raycasterRef.current.intersectObject(sphere);
        sphereGeo.dispose();
        sphereMat.dispose();

        if (intersects.length > 0) {
            const point = intersects[0].point;
            const { lat, lon } = vector3ToLatLon(point);
            onGlobeClick(lat, lon);
        }
    }, [getCamera, onGlobeClick]);

    /* Mount / Unmount */
    useEffect(() => {
        if (!containerRef.current || mountedRef.current) return;
        mountedRef.current = true;
        mount(containerRef.current);

        const el = containerRef.current;
        el.addEventListener('click', handleClick);

        return () => {
            el.removeEventListener('click', handleClick);
            unmount();
            mountedRef.current = false;
        };
    }, [mount, unmount, handleClick]);

    /* Camera change listener */
    useEffect(() => {
        if (onCameraChange) {
            registerCameraChange(onCameraChange);
        }
    }, [registerCameraChange, onCameraChange]);

    /* Sun */
    useEffect(() => {
        updateSun(sunPos);
    }, [updateSun, sunPos]);

    /* ISS */
    useEffect(() => {
        updateISS(iss, trail, prediction);
    }, [updateISS, iss, trail, prediction]);

    /* Wind */
    useEffect(() => {
        updateWind(wind);
    }, [updateWind, wind]);

    /* Modules visibility */
    useEffect(() => {
        updateModules(modules);
    }, [updateModules, modules]);

    /* Fly to target */
    useEffect(() => {
        if (flyTarget) {
            flyTo(flyTarget.lat, flyTarget.lon);
        }
    }, [flyTo, flyTarget]);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full"
            aria-label="3D Globe view"
        />
    );
}
