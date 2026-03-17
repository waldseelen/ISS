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
import LocationDetailPanel from '@/components/panels/LocationDetailPanel';
import WeatherPanel from '@/components/panels/WeatherPanel';
import CoordDisplay from '@/components/ui/CoordDisplay';
import ScaleBar from '@/components/ui/ScaleBar';
import SearchBar from '@/components/ui/SearchBar';
import TimeLegend from '@/components/ui/TimeLegend';
import Toolbar from '@/components/ui/Toolbar';

/* Dynamic imports – SSR disabled for canvas components */
const GlobeCanvas = dynamic(() => import('@/components/globe/GlobeCanvas'), { ssr: false });
const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), { ssr: false });

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
    const [selectedLocation, setSelectedLocation] = useState<import('@/types').LocationDetail | null>(null);
    const [uiVisible, setUiVisible] = useState(true);
    const [loaded, setLoaded] = useState(false);

    const isGlobe = modules.globe3D;
    const [transitioning, setTransitioning] = useState(false);
    const prevModeRef = useRef(isGlobe);

    /* ─── Loading overlay dismiss ─── */
    useEffect(() => {
        const timer = setTimeout(() => setLoaded(true), 1800);
        return () => clearTimeout(timer);
    }, []);

    /* ─── H key → toggle all UI ─── */
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'h' || e.key === 'H') {
                if (document.activeElement?.tagName === 'INPUT') return;
                setUiVisible(v => !v);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

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
    }, [modules.wind, selectedCoord]);

    /* ─── Map click handler ─── */
    const handleMapClick = useCallback(async (lat: number, lon: number) => {
        loadLocationData(lat, lon);
        try {
            const { fetchLocationDetail } = await import('@/lib/geo');
            const detail = await fetchLocationDetail(lat, lon);
            setSelectedLocation(detail);
        } catch { /* silent */ }
    }, [loadLocationData]);

    /* ─── City search → fly + load data ─── */
    const handleCitySelect = useCallback((city: GeoCity) => {
        const target = { lat: city.latitude, lon: city.longitude };
        setFlyTarget(target);
        loadLocationData(target.lat, target.lon);
    }, [loadLocationData]);

    /* ─── 3D Globe: camera distance change (no auto switch) ─── */
    const handleCameraChange = useCallback((_distance: number) => {
        // Auto-switch deactivated — mode changes only via Toolbar buttons
    }, []);

    /* ─── 2D Map: zoom level change (no auto switch) ─── */
    const handleMapZoomChange = useCallback((_zoom: number) => {
        // Auto-switch deactivated — mode changes only via Toolbar buttons
    }, []);

    /* ─── Globe click → location detail ─── */
    const handleGlobeClick = useCallback(async (lat: number, lon: number) => {
        setSelectedCoord({ lat, lon });
        loadLocationData(lat, lon);
        try {
            const { fetchLocationDetail } = await import('@/lib/geo');
            const detail = await fetchLocationDetail(lat, lon);
            setSelectedLocation(detail);
        } catch { /* silent */ }
    }, [loadLocationData]);

    /* ─── Mode transition animation ─── */
    useEffect(() => {
        if (prevModeRef.current !== isGlobe) {
            setTransitioning(true);
            const t = setTimeout(() => setTransitioning(false), 600);
            prevModeRef.current = isGlobe;
            return () => clearTimeout(t);
        }
    }, [isGlobe]);

    /* ─── Clear fly target after it's consumed (10s persistence) ─── */
    useEffect(() => {
        if (flyTarget) {
            const timer = setTimeout(() => setFlyTarget(null), 10000);
            return () => clearTimeout(timer);
        }
    }, [flyTarget]);

    return (
        <main className={`relative w-screen h-screen overflow-hidden bg-black transition-opacity duration-500 ${transitioning ? 'opacity-0' : 'opacity-100'} ${uiVisible ? '' : 'ui-hidden'}`}>
            {/* Loading Overlay */}
            <div id="app-loader" className={loaded ? 'loaded' : ''}>
                <div className="spinner" />
                <p className="mt-4 text-cyan-400 text-xs font-mono tracking-widest animate-pulse">EARTH TRACKER</p>
            </div>

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
                    onGlobeClick={handleGlobeClick}
                />
            )}

            {/* 2D Map View */}
            {!isGlobe && (
                <MapCanvas
                    modules={modules}
                    iss={iss}
                    trail={trail}
                    flyTarget={flyTarget}
                    wind={wind}
                    onZoomChange={handleMapZoomChange}
                    onMapClick={handleMapClick}
                />
            )}

            {/* Top bar */}
            <header className="fixed top-4 left-4 right-4 z-50 flex items-center gap-3">
                <h1 className="text-lg font-bold text-cyan-400 tracking-wider text-glow-cyan">
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

            {/* Location detail panel */}
            {selectedLocation && (
                <LocationDetailPanel
                    location={selectedLocation}
                    onClose={() => setSelectedLocation(null)}
                />
            )}

            {/* Bottom bar */}
            <CoordDisplay lat={selectedCoord?.lat ?? null} lon={selectedCoord?.lon ?? null} />
            <ScaleBar />
        </main>
    );
}
