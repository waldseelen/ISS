'use client';

import { useISS } from '@/hooks/useISS';
import { useModules } from '@/hooks/useModules';
import { useSun } from '@/hooks/useSun';
import { AUTO_SWITCH_GLOBE_MIN_ZOOM, AUTO_SWITCH_MAP_MAX_ZOOM } from '@/lib/canvasStyle';
import { fetchMarine, fetchWeather, fetchWindGrid } from '@/lib/api';
import { fetchLocationDetail } from '@/lib/geo';
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
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import ParticleSettingsPanel from '@/components/ui/ParticleSettingsPanel';
import LayerOrderPanel from '@/components/ui/LayerOrderPanel';

const GlobeCanvas = dynamic(() => import('@/components/globe/GlobeCanvas'), { ssr: false });
const MapCanvas = dynamic(() => import('@/components/map/MapCanvas'), { ssr: false });
const LazyISSPanel = dynamic(() => import('@/components/panels/ISSPanel'), { ssr: false });
const LazyLocationDetailPanel = dynamic(() => import('@/components/panels/LocationDetailPanel'), { ssr: false });
const LazyWeatherPanel = dynamic(() => import('@/components/panels/WeatherPanel'), { ssr: false });
const LazyBookmarksPanel = dynamic(() => import('@/components/panels/BookmarksPanel'), { ssr: false });
const LazyLiveStreamPanel = dynamic(() => import('@/components/panels/LiveStreamPanel'), { ssr: false });
const LazyPassPredictorPanel = dynamic(() => import('@/components/panels/PassPredictorPanel'), { ssr: false });

const getISSDistance = (issLat: number, issLon: number, issAlt: number, lat: number, lon: number) => {
    const R = 6371;
    const r1 = R + issAlt;
    const r2 = R; // ground level height

    const phi1 = (issLat * Math.PI) / 180;
    const phi2 = (lat * Math.PI) / 180;
    const theta1 = (issLon * Math.PI) / 180;
    const theta2 = (lon * Math.PI) / 180;

    const x1 = r1 * Math.cos(phi1) * Math.cos(theta1);
    const y1 = r1 * Math.cos(phi1) * Math.sin(theta1);
    const z1 = r1 * Math.sin(phi1);

    const x2 = r2 * Math.cos(phi2) * Math.cos(theta2);
    const y2 = r2 * Math.cos(phi2) * Math.sin(theta2);
    const z2 = r2 * Math.sin(phi2);

    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2);
};

export default function Home() {
    const { modules, toggle, updateParticleSettings, reorderLayers, baseStyle } = useModules();
    const { iss, trail, prediction, tle } = useISS(modules.iss);
    const { terminator, twilightBands } = useSun();
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

    // Yer imleri yenileme tetikleyicisi
    const [bookmarksRefreshTrigger, setBookmarksRefreshTrigger] = useState(0);
    const triggerBookmarksRefresh = useCallback(() => {
        setBookmarksRefreshTrigger(prev => prev + 1);
    }, []);

    const isGlobe = modules.globe3D;
    const [transitioning, setTransitioning] = useState(false);
    const prevModeRef = useRef(isGlobe);
    const autoSwitchLockRef = useRef(0);
    const lastSelectedKeyRef = useRef<string | null>(null);
    const lastRadarBeepRef = useRef<number>(0);

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

    // Yer iminden uçuş kontrolü
    const handleFlyTo = useCallback(async (lat: number, lon: number) => {
        const target = { lat, lon };
        setFlyTarget(target);
        setSelectedCoord(target);
        loadLocationData(lat, lon);
        try {
            const detail = await fetchLocationDetail(lat, lon);
            setSelectedLocation(detail);
        } catch {
            addToast('Konum detayları alınamadı', 'error');
        }
    }, [loadLocationData, addToast]);

    // ISS Yakınlık Radar Sesi
    useEffect(() => {
        if (!iss || !selectedCoord) return;
        
        const dist = getISSDistance(
            iss.latitude,
            iss.longitude,
            iss.altitude,
            selectedCoord.lat,
            selectedCoord.lon
        );

        if (dist < 1000) {
            const now = Date.now();
            if (now - lastRadarBeepRef.current >= 12000) {
                playBeep('radar');
                lastRadarBeepRef.current = now;
            }
        }
    }, [iss, selectedCoord]);

    const handleCameraChange = useCallback((zoom: number) => {
        // Auto-switch disabled. Mod geçişleri sadece Toolbar üzerinden manuel olarak yapılacaktır.
    }, []);

    const handleMapZoomChange = useCallback((zoom: number) => {
        // Auto-switch disabled. Mod geçişleri sadece Toolbar üzerinden manuel olarak yapılacaktır.
    }, []);

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
                            marine={marine}
                            modules={modules}
                            baseStyle={baseStyle}
                            terminator={terminator}
                            twilightBands={twilightBands}
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
                            marine={marine}
                            selectedCoord={selectedCoord}
                            baseStyle={baseStyle}
                            terminator={terminator}
                            twilightBands={twilightBands}
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
                    isFetchingData && !weather && !selectedLocation ? (
                        <SkeletonLoader variant={selectedCoord ? 'detail' : 'weather'} />
                    ) : selectedLocation ? (
                        <LazyLocationDetailPanel
                            location={selectedLocation}
                            isFetching={isFetchingData}
                            onBookmarkChange={triggerBookmarksRefresh}
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
                    iss ? (
                        <LazyISSPanel iss={iss} prediction={prediction} />
                    ) : (
                        <SkeletonLoader variant="iss" />
                    )
                )}
                {modules.iss && (
                    <LazyLiveStreamPanel
                        selectedLon={selectedCoord?.lon ?? null}
                        issLon={iss?.longitude ?? null}
                        locationName={selectedLocation?.locationName ?? null}
                    />
                )}
                {modules.iss && selectedCoord && (
                    <LazyPassPredictorPanel
                        tle={tle}
                        latitude={selectedCoord.lat}
                        longitude={selectedCoord.lon}
                    />
                )}
                <LazyBookmarksPanel
                    onFlyTo={handleFlyTo}
                    refreshTrigger={bookmarksRefreshTrigger}
                />
                {/* Faz 2 / Madde 3: Parçacık ayarları (wind/precipitation aktifken) */}
                {(modules.wind || modules.tileGroup === 'precipitation') && (
                    <ParticleSettingsPanel
                        settings={modules.particleSettings}
                        onChange={updateParticleSettings}
                    />
                )}
                {/* Faz 3 / Madde 1: Katman sıralama paneli */}
                <LayerOrderPanel modules={modules} onReorder={reorderLayers} />
            </div>

            <TimeLegend modules={modules} />

            <CoordDisplay lat={selectedCoord?.lat ?? null} lon={selectedCoord?.lon ?? null} />
            <ScaleBar />
        </main>
    );
}
