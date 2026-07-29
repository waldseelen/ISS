'use client';

import { useISS } from '@/hooks/useISS';
import { useModules } from '@/hooks/useModules';
import { useSun } from '@/hooks/useSun';
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

const EarthCanvas = dynamic(() => import('@/components/earth/EarthCanvas'), { ssr: false });
const LazyLocationDetailPanel = dynamic(() => import('@/components/panels/LocationDetailPanel'), { ssr: false });
const LazyWeatherPanel = dynamic(() => import('@/components/panels/WeatherPanel'), { ssr: false });
const LazyBookmarksPanel = dynamic(() => import('@/components/panels/BookmarksPanel'), { ssr: false });
const LazyISSPanel = dynamic(() => import('@/components/panels/ISSPanel'), { ssr: false });
const LazyPassPredictorPanel = dynamic(() => import('@/components/panels/PassPredictorPanel'), { ssr: false });
const LazyLiveStreamPanel = dynamic(() => import('@/components/panels/LiveStreamPanel'), { ssr: false });


export default function Home() {
    const { modules, toggle, setProjection, updateParticleSettings, reorderLayers, baseStyle } = useModules();
    const { terminator, twilightBands } = useSun();
    /* ISS yalnızca ilgili panel/işaretçi açıkken TLE çeker ve propagasyon yapar */
    const iss = useISS(modules.iss);
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

            <div className="absolute inset-0 w-full h-full canvas-container">
                <ErrorBoundary>
                    <EarthCanvas
                        modules={modules}
                        baseStyle={baseStyle}
                        wind={wind}
                        marine={marine}
                        iss={iss.position}
                        terminator={terminator}
                        twilightBands={twilightBands}
                        flyTarget={flyTarget}
                        selectedCoord={selectedCoord}
                        onMapClick={handleLocationSelect}
                    />
                </ErrorBoundary>
            </div>

            <header className="fixed top-4 left-4 right-4 z-50 flex items-center gap-3">
                <h1 className="text-lg font-bold text-cyan-400 tracking-wider text-glow-cyan">
                    Earth Tracker
                </h1>
                <SearchBar onSelect={handleCitySelect} />
            </header>

            <Toolbar modules={modules} onToggle={toggle} onSetProjection={setProjection} />

            <div className="fixed top-16 right-2 sm:right-4 z-40 w-[320px] sm:w-[380px] max-w-[calc(100vw-1rem)] max-h-[calc(100vh-6rem)] overflow-y-auto flex flex-col gap-3 panel-stagger-once scrollbar-thin">
                {/* ISS: telemetri + geçiş tahmini tek toggle altında */}
                {modules.iss && (
                    <>
                        <LazyISSPanel
                            position={iss.position}
                            tleAgeHours={iss.tleAgeHours}
                            isStale={iss.isStale}
                            isLoading={iss.isLoading}
                            error={iss.error}
                        />
                        <LazyPassPredictorPanel satrec={iss.satrec} observer={selectedCoord} />
                    </>
                )}
                {/* Canlı yayın ayrı toggle — ağır iframe isteğe bağlı */}
                {modules.issStream && <LazyLiveStreamPanel />}
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
