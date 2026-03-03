'use client';

import { useGlobe } from '@/hooks/useGlobe';
import { useISS } from '@/hooks/useISS';
import { useModules } from '@/hooks/useModules';
import { useSun } from '@/hooks/useSun';
import { fetchMarine, fetchWeather, fetchWindGrid } from '@/lib/api';
import type { GeoCity, MarineData, WeatherData, WindPoint } from '@/types';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import ISSPanel from '@/components/panels/ISSPanel';
import WeatherPanel from '@/components/panels/WeatherPanel';
import CoordDisplay from '@/components/ui/CoordDisplay';
import ModulesBar from '@/components/ui/ModulesBar';
import ScaleBar from '@/components/ui/ScaleBar';
import SearchBar from '@/components/ui/SearchBar';
import TimeLegend from '@/components/ui/TimeLegend';
import Toolbar from '@/components/ui/Toolbar';

/* Dynamic imports – SSR disabled for canvas components */
const GlobeCanvas = dynamic(() => import('@/components/globe/GlobeCanvas'), { ssr: false });
const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), { ssr: false });

/* ─── Thresholds for auto mode switching ─── */
const ZOOM_IN_TO_2D_DISTANCE = 9;   // camera distance < 9 → switch to 2D
const ZOOM_OUT_TO_3D_ZOOM = 4;       // map zoom < 4 → switch to 3D

export default function Home() {
    const { modules, toggle, setMode } = useModules();
    const globeAPI = useGlobe();
    const { iss, trail, prediction } = useISS(modules.iss);
    const { sunPos } = useSun();

    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [marine, setMarine] = useState<MarineData | null>(null);
    const [wind, setWind] = useState<WindPoint[]>([]);
    const [selectedCoord, setSelectedCoord] = useState<{ lat: number; lon: number } | null>(null);
    const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number } | null>(null);

    const isGlobe = modules.globe3D;
    const autoSwitchLock = useRef(false);

    /* ─── Fetch weather for location ─── */
    const loadLocationData = useCallback(async (lat: number, lon: number) => {
        setSelectedCoord({ lat, lon });
        try {
            const [w, m] = await Promise.all([
                fetchWeather(lat, lon),
                fetchMarine(lat, lon),
            ]);
            setWeather(w);
            setMarine(m);
        } catch { /* silent */ }
    }, []);

    /* ─── Fetch wind data ─── */
    useEffect(() => {
        if (!modules.wind) return;
        const lat = selectedCoord?.lat ?? 0;
        const lon = selectedCoord?.lon ?? 0;
        fetchWindGrid(lat, lon).then(setWind).catch(() => { });
    }, [modules.wind]);

    /* ─── City search → fly + load data ─── */
    const handleCitySelect = useCallback((city: GeoCity) => {
        const target = { lat: city.latitude, lon: city.longitude };
        setFlyTarget(target);
        loadLocationData(target.lat, target.lon);
    }, [loadLocationData]);

    /* ─── 3D Globe: camera distance change → auto switch to 2D ─── */
    const handleCameraChange = useCallback((distance: number) => {
        if (autoSwitchLock.current) return;
        if (distance < ZOOM_IN_TO_2D_DISTANCE) {
            autoSwitchLock.current = true;
            setMode('map2D');
            setTimeout(() => { autoSwitchLock.current = false; }, 1000);
        }
    }, [setMode]);

    /* ─── 2D Map: zoom level change → auto switch to 3D ─── */
    const handleMapZoomChange = useCallback((zoom: number) => {
        if (autoSwitchLock.current) return;
        if (zoom < ZOOM_OUT_TO_3D_ZOOM) {
            autoSwitchLock.current = true;
            setMode('globe3D');
            setTimeout(() => { autoSwitchLock.current = false; }, 1000);
        }
    }, [setMode]);

    /* ─── Clear fly target after it's consumed ─── */
    useEffect(() => {
        if (flyTarget) {
            const timer = setTimeout(() => setFlyTarget(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [flyTarget]);

    return (
        <main className="relative w-screen h-screen overflow-hidden bg-black">
            {/* 3D Globe View */}
            {isGlobe && (
                <GlobeCanvas
                    globeAPI={globeAPI}
                    sunPos={sunPos}
                    iss={iss}
                    trail={trail}
                    prediction={prediction}
                    wind={wind}
                    modules={modules}
                    flyTarget={flyTarget}
                    onCameraChange={handleCameraChange}
                />
            )}

            {/* 2D Map View */}
            {!isGlobe && (
                <MapCanvas
                    modules={modules}
                    iss={iss}
                    trail={trail}
                    flyTarget={flyTarget}
                    onZoomChange={handleMapZoomChange}
                />
            )}

            {/* Top bar */}
            <header className="fixed top-4 left-4 right-4 z-50 flex items-center gap-3">
                <h1 className="text-lg font-bold text-cyan-400 tracking-wider">
                    Earth Tracker
                </h1>
                <SearchBar onSelect={handleCitySelect} />
            </header>

            {/* Left toolbar */}
            <Toolbar modules={modules} onToggle={toggle} />

            {/* Right panels */}
            <div className="fixed top-16 right-4 z-40 w-64 flex flex-col gap-3">
                {modules.weather && (
                    <WeatherPanel weather={weather} marine={marine} />
                )}
                {modules.iss && (
                    <ISSPanel iss={iss} />
                )}
            </div>

            {/* Legends */}
            <TimeLegend modules={modules} />

            {/* Bottom bar */}
            <CoordDisplay lat={selectedCoord?.lat ?? null} lon={selectedCoord?.lon ?? null} />
            <ScaleBar />
            <ModulesBar modules={modules} onToggle={toggle} />
        </main>
    );
}
