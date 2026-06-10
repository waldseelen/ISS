'use client';

import { useISS } from '@/hooks/useISS';
import { useModules } from '@/hooks/useModules';
import { useSun } from '@/hooks/useSun';
import { AUTO_SWITCH_GLOBE_MIN_ZOOM, AUTO_SWITCH_MAP_MAX_ZOOM } from '@/lib/canvasStyle';
import { fetchMarine, fetchWeather, fetchWindGrid } from '@/lib/api';
import type { GeoCity, MarineData, WeatherData, WindPoint } from '@/types';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { playBeep } from '@/lib/audio';

import CoordDisplay from '@/components/ui/CoordDisplay';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ScaleBar from '@/components/ui/ScaleBar';
import SearchBar from '@/components/ui/SearchBar';
import TimeLegend from '@/components/ui/TimeLegend';
import Toolbar from '@/components/ui/Toolbar';
import { useToast } from '@/components/ui/Toast';

const GlobeCanvas = dynamic(() => import('@/components/globe/GlobeCanvas'), { ssr: false });
const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), { ssr: false });
const LazyISSPanel = dynamic(() => import('@/components/panels/ISSPanel'), { ssr: false });
const LazyLocationDetailPanel = dynamic(() => import('@/components/panels/LocationDetailPanel'), { ssr: false });
const LazyWeatherPanel = dynamic(() => import('@/components/panels/WeatherPanel'), { ssr: false });

export default function Home() {
    const { modules, toggle, baseStyle } = useModules();
    const { iss, trail, prediction } = useISS(modules.iss);
    const { terminator } = useSun();
    const { addToast } = useToast();

    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [marine, setMarine] = useState<MarineData | null>(null);
    const [wind, setWind] = useState<WindPoint[]>([]);
    const [selectedCoord, setSelectedCoord] = useState<{ lat: number; lon: number } | null>(null);
    const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number } | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<import('@/types').LocationDetail | null>(null);
    const [uiVisible, setUiVisible] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(false);

    const isGlobe = modules.globe3D;
    const [transitioning, setTransitioning] = useState(false);
    const prevModeRef = useRef(isGlobe);
    const autoSwitchLockRef = useRef(0);
    const lastSelectedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
        const onReady = () => setLoaded(true);
        if (document.readyState === 'complete') {
            requestAnimationFrame(onReady);
        } else {
            window.addEventListener('load', () => requestAnimationFrame(onReady), { once: true });
        }
    }, []);

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

    const loadLocationData = useCallback(async (lat: number, lon: number) => {
        const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
        if (key === lastSelectedKeyRef.current) return;
        lastSelectedKeyRef.current = key;
        setSelectedCoord({ lat, lon });
        setIsFetchingData(true);
        try {
            const [w, m] = await Promise.all([
                fetchWeather(lat, lon),
                fetchMarine(lat, lon),
            ]);
            setWeather(w);
            setMarine(m);
        } catch {
            addToast('Hava durumu verisi alınamadı', 'error');
        } finally {
            setIsFetchingData(false);
        }
    }, [addToast]);

    useEffect(() => {
        const needWind = modules.wind || modules.tileGroup === 'precipitation';
        if (!needWind) return;
        const lat = selectedCoord?.lat ?? 0;
        const lon = selectedCoord?.lon ?? 0;
        fetchWindGrid(lat, lon).then(setWind).catch(() => {
            addToast('Rüzgar verisi alınamadı', 'error');
        });
    }, [modules.wind, modules.tileGroup, selectedCoord, addToast]);

    const handleLocationSelect = useCallback(async (lat: number, lon: number) => {
        playBeep('click');
        setSelectedCoord({ lat, lon });
        loadLocationData(lat, lon);
        try {
            const { fetchLocationDetail } = await import('@/lib/geo');
            const detail = await fetchLocationDetail(lat, lon);
            setSelectedLocation(detail);
        } catch {
            addToast('Konum detayları alınamadı', 'error');
        }
    }, [loadLocationData, addToast]);

    const handleCitySelect = useCallback((city: GeoCity) => {
        playBeep('search');
        const target = { lat: city.latitude, lon: city.longitude };
        setFlyTarget(target);
        loadLocationData(target.lat, target.lon);
    }, [loadLocationData]);

    const handleCameraChange = useCallback((zoom: number) => {
        if (!isGlobe) return;
        if (Date.now() < autoSwitchLockRef.current) return;
        if (zoom > AUTO_SWITCH_GLOBE_MIN_ZOOM) {
            autoSwitchLockRef.current = Date.now() + 1200;
            toggle('map2D');
        }
    }, [isGlobe, toggle]);

    const handleMapZoomChange = useCallback((zoom: number) => {
        if (isGlobe) return;
        if (Date.now() < autoSwitchLockRef.current) return;
        if (zoom < AUTO_SWITCH_MAP_MAX_ZOOM) {
            autoSwitchLockRef.current = Date.now() + 1200;
            toggle('globe3D');
        }
    }, [isGlobe, toggle]);

    useEffect(() => {
        if (prevModeRef.current !== isGlobe) {
            setTransitioning(true);
            const t = setTimeout(() => setTransitioning(false), 600);
            prevModeRef.current = isGlobe;
            return () => clearTimeout(t);
        }
    }, [isGlobe]);

    useEffect(() => {
        if (flyTarget) {
            const timer = setTimeout(() => setFlyTarget(null), 1600);
            return () => clearTimeout(timer);
        }
    }, [flyTarget]);

    return (
        <main className={`relative w-screen h-screen overflow-hidden bg-black ${uiVisible ? '' : 'ui-hidden'}`}>
            <div id="app-loader" className={loaded ? 'loaded' : ''}>
                <div className="spinner" />
                <p className="mt-4 text-cyan-400 text-xs font-mono tracking-widest animate-pulse">EARTH TRACKER</p>
            </div>

            <div className={`absolute inset-0 w-full h-full canvas-container ${transitioning ? 'canvas-transitioning' : ''}`} style={{ willChange: 'transform, opacity' }}>
                {isGlobe && (
                    <ErrorBoundary>
                        <GlobeCanvas
                            iss={iss}
                            trail={trail}
                            prediction={prediction}
                            wind={wind}
                            modules={modules}
                            baseStyle={baseStyle}
                            terminator={terminator}
                            flyTarget={flyTarget}
                            selectedCoord={selectedCoord}
                            onCameraChange={handleCameraChange}
                            onGlobeClick={handleLocationSelect}
                        />
                    </ErrorBoundary>
                )}
                {!isGlobe && (
                    <ErrorBoundary>
                        <MapCanvas
                            modules={modules}
                            iss={iss}
                            trail={trail}
                            prediction={prediction}
                            flyTarget={flyTarget}
                            wind={wind}
                            selectedCoord={selectedCoord}
                            baseStyle={baseStyle}
                            terminator={terminator}
                            onZoomChange={handleMapZoomChange}
                            onMapClick={handleLocationSelect}
                        />
                    </ErrorBoundary>
                )}
            </div>

            <header className="fixed top-4 left-4 right-4 z-50 flex items-center gap-3">
                <h1 className="text-lg font-bold text-cyan-400 tracking-wider text-glow-cyan">
                    Earth Tracker
                </h1>
                <SearchBar onSelect={handleCitySelect} />
            </header>

            <Toolbar modules={modules} onToggle={toggle} />

            <div className="fixed top-16 right-2 sm:right-4 z-40 w-[320px] sm:w-[380px] max-w-[calc(100vw-1rem)] max-h-[calc(100vh-6rem)] overflow-y-auto flex flex-col gap-3 panel-stagger-once scrollbar-thin">
                {modules.weather && (
                    selectedLocation ? (
                        <LazyLocationDetailPanel
                            location={selectedLocation}
                            isFetching={isFetchingData}
                            onClose={() => {
                                setSelectedLocation(null);
                                setSelectedCoord(null);
                                setWeather(null);
                                lastSelectedKeyRef.current = null;
                            }}
                        />
                    ) : (
                        <LazyWeatherPanel weather={weather} marine={marine} isFetching={isFetchingData} />
                    )
                )}
                {modules.iss && (
                    <LazyISSPanel iss={iss} prediction={prediction} />
                )}
            </div>

            <TimeLegend modules={modules} />

            <CoordDisplay lat={selectedCoord?.lat ?? null} lon={selectedCoord?.lon ?? null} />
            <ScaleBar />
        </main>
    );
}
