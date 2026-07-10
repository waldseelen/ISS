'use client';

import { generateWindPaths, getWindColor, type WindTrajectory } from '@/lib/map';
import { buildBaseStyle } from '@/lib/canvasStyle';
import { CURSOR_PULSE_AMP, CURSOR_PULSE_BASE, CURSOR_PULSE_HZ, clampFrameDelta, pulseRadius } from '@/lib/pulse';
import { getRainViewerTimestamp, TILES, yesterdayISO } from '@/lib/tiles';
import type { TwilightBand } from '@/hooks/useSun';
import type { BaseStyle, LayerOrderKey, MarineData, ModuleState, TerminatorPolygon, WindPoint } from '@/types';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer, TileLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, BitmapLayer, PolygonLayer } from '@deck.gl/layers';
import maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Props {
    modules: ModuleState;
    baseStyle: BaseStyle;
    wind?: WindPoint[];
    marine?: MarineData | null;
    terminator: TerminatorPolygon;
    twilightBands?: TwilightBand[];
    flyTarget: { lat: number; lon: number } | null;
    selectedCoord: { lat: number; lon: number } | null;
    onZoomChange?: (zoom: number) => void;
    onMapClick?: (lat: number, lon: number) => void;
}

/* Şeffaf overlay raster tile katmanı — depthWriteEnabled:false ile
   Z-fighting (titreşim) engellenir (AGENT.md Kural #3). */
function makeTileLayer(id: string, data: string, opacity: number, maxZoom: number) {
    return new TileLayer({
        id,
        data,
        opacity,
        minZoom: 0,
        maxZoom,
        tileSize: 256,
        maxRequests: 8,
        onTileError: () => {},
        renderSubLayers: (props: any) => {
            const { west, south, east, north } = props.tile.bbox;
            return new BitmapLayer(props, {
                data: undefined,
                image: props.data,
                bounds: [west, south, east, north],
                parameters: { depthWriteEnabled: false } as any,
            });
        },
    });
}

export default function EarthCanvas({
    modules,
    baseStyle,
    wind = [],
    marine,
    terminator,
    twilightBands = [],
    flyTarget,
    selectedCoord,
    onZoomChange,
    onMapClick,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const overlayRef = useRef<MapboxOverlay | null>(null);
    const [ready, setReady] = useState(false);

    const [windPaths, setWindPaths] = useState<WindTrajectory[]>([]);
    const [rainTimestamp, setRainTimestamp] = useState<number | null>(null);

    /* Faz 2: Animasyon değerleri React state'te DEĞİL, ref'te tutulur.
       Böylece her frame'de React re-render + tüm katmanların yeniden
       inşası tetiklenmez; yalnızca deck.gl uniformları güncellenir. */
    const animRef = useRef({ tripTime: 0, cursorPhase: 0, cursorFade: 0 });

    const yesterdayStr = useMemo(() => yesterdayISO(), []);
    const ps = modules.particleSettings;
    const perfMode = modules.performanceMode;

    const particleCount = useMemo(() => {
        const base = perfMode ? 600 : 1800;
        return Math.round(base * ps.density);
    }, [perfMode, ps.density]);

    /* Faz 2: Parçacık yollarını ana thread'i kilitlemeden, kaydırıcı
       değişiminde debounce ederek üret. */
    useEffect(() => {
        const needWind = modules.wind || modules.tileGroup === 'precipitation';
        if (!(wind.length > 0 && needWind)) {
            setWindPaths([]);
            return;
        }
        const handle = setTimeout(() => {
            setWindPaths(generateWindPaths(wind, particleCount, 12));
        }, 120);
        return () => clearTimeout(handle);
    }, [wind, modules.wind, modules.tileGroup, particleCount]);

    useEffect(() => {
        if (modules.tileGroup === 'precipitation') {
            getRainViewerTimestamp().then(setRainTimestamp);
        }
    }, [modules.tileGroup]);

    /* ── Katman üreteci: stabil veri referanslarıyla (deck.gl aynı id +
       aynı data görürse GPU buffer'ı yeniden yüklemez). ── */
    const buildLayers = useCallback(() => {
        const { tripTime, cursorPhase, cursorFade } = animRef.current;

        const orderMap: Record<LayerOrderKey, any[]> = {
            nasaGIBS: [], nightLights: [], temperature: [],
            precipitation: [], clouds: [], dayNight: [], wind: [], marine: [],
        };

        /* Raster overlay katmanları (NASA GIBS vb.) — artık HER İKİ
           projeksiyonda da (2D+3D) tutarlı şekilde render edilir. */
        if (modules.nasaGIBS) {
            orderMap.nasaGIBS.push(makeTileLayer('nasagibs-tiles', TILES.nasaGIBS(yesterdayStr), 0.9, 9));
        }
        if (modules.nightLights) {
            orderMap.nightLights.push(makeTileLayer('night-lights-tiles', TILES.nightLights, 0.65, 8));
        }
        if (modules.tileGroup === 'temperature') {
            orderMap.temperature.push(makeTileLayer('temperature-tiles',
                `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${yesterdayStr}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
                0.6, 7));
        }
        if (modules.tileGroup === 'clouds') {
            orderMap.clouds.push(makeTileLayer('clouds-tiles', TILES.nasaClouds(yesterdayStr), 0.45, 9));
        }
        if (modules.tileGroup === 'precipitation' && rainTimestamp) {
            orderMap.precipitation.push(makeTileLayer('precipitation-tiles', TILES.rainViewer(rainTimestamp), 0.75, 12));
        }

        /* Yağış parçacık izleri (Trips) */
        if (modules.tileGroup === 'precipitation' && windPaths.length > 0) {
            orderMap.precipitation.push(new TripsLayer({
                id: 'rain-trips',
                data: windPaths,
                getPath: (d: any) => d.path,
                getTimestamps: (d: any) => d.timestamps.map((t: number) => t + 1.2),
                getColor: [0, 229, 255],
                opacity: 0.7,
                widthMinPixels: Math.max(1.0, ps.width * 0.55),
                trailLength: ps.trailLength * 0.8,
                currentTime: tripTime,
                capRounded: true,
                jointRounded: true,
                shadowEnabled: false,
                parameters: { depthWriteEnabled: false } as any,
            }));
        }

        /* Rüzgar parçacık izleri (Trips) */
        if (modules.wind && windPaths.length > 0) {
            orderMap.wind.push(new TripsLayer({
                id: 'wind-trips',
                data: windPaths,
                getPath: (d: any) => d.path,
                getTimestamps: (d: any) => d.timestamps,
                getColor: (d: any) => getWindColor(d.speed),
                opacity: 0.85,
                widthMinPixels: ps.width,
                trailLength: ps.trailLength,
                currentTime: tripTime,
                capRounded: true,
                jointRounded: true,
                shadowEnabled: false,
                parameters: { depthWriteEnabled: false } as any,
            }));
        }

        /* Gündüz/gece: alacakaranlık bandları + gece poligonu.
           Şeffaf poligonlarda depthWriteEnabled:false + polygonOffset
           ile Z-fighting (titreşim) tamamen giderilir. */
        if (modules.dayNight) {
            (twilightBands || []).forEach((band, idx) => {
                if (!band || !band.rings || band.rings.length === 0) return;
                orderMap.dayNight.push(new PolygonLayer({
                    id: `twilight-band-${idx}`,
                    data: band.rings,
                    getPolygon: (d: any) => d,
                    filled: true,
                    stroked: false,
                    getFillColor: band.color,
                    opacity: band.opacity,
                    pickable: false,
                    material: false,
                    parameters: { depthWriteEnabled: false, polygonOffset: [-1, -1 - idx] } as any,
                }));
            });
            if (terminator && terminator.rings && terminator.rings.length > 0) {
                orderMap.dayNight.push(new PolygonLayer({
                    id: 'terminator-night',
                    data: terminator.rings,
                    getPolygon: (d: any) => d,
                    filled: true,
                    stroked: false,
                    getFillColor: [4, 8, 18, 165],
                    opacity: 0.7,
                    pickable: false,
                    material: false,
                    parameters: { depthWriteEnabled: false, polygonOffset: [-1, -5] } as any,
                }));
            }
        }

        /* Deniz dalga noktası */
        if (modules.marine && marine) {
            orderMap.marine.push(new ScatterplotLayer({
                id: 'marine-wave-point',
                data: [marine],
                getPosition: (d: MarineData) => [d.longitude, d.latitude],
                radiusUnits: 'pixels',
                getRadius: 18 + (marine.waveHeight ?? 0) * 6,
                getFillColor: (() => {
                    const sst = marine.seaSurfaceTemperature ?? 15;
                    if (sst < 5) return [6, 78, 135, 140];
                    if (sst < 15) return [26, 139, 204, 140];
                    if (sst < 25) return [45, 212, 191, 140];
                    return [251, 191, 36, 140];
                })(),
                stroked: true,
                getLineColor: [0, 229, 255, 80],
                lineWidthMinPixels: 1.5,
                parameters: { depthWriteEnabled: false } as any,
            }));
        }

        /* Kullanıcı sıralamasına göre overlay katmanlarını diz */
        const sorted: any[] = [];
        modules.layerOrder.forEach(key => {
            if (orderMap[key]?.length) sorted.push(...orderMap[key]);
        });

        /* Seçili konum imleci — daima en üstte */
        const showCursor = cursorFade > 0.001;
        if (showCursor && selectedCoord) {
            const cursorRadius = pulseRadius(cursorPhase, CURSOR_PULSE_HZ, CURSOR_PULSE_AMP, CURSOR_PULSE_BASE);
            sorted.push(
                new ScatterplotLayer({
                    id: 'selected-coord-pulse',
                    data: [selectedCoord],
                    getPosition: (d: any) => [d.lon, d.lat],
                    radiusUnits: 'pixels',
                    getRadius: cursorRadius,
                    getFillColor: [0, 229, 255, Math.round(24 * cursorFade)],
                    stroked: true,
                    getLineColor: [0, 229, 255, Math.round(140 * cursorFade)],
                    lineWidthMinPixels: 1.5,
                    updateTriggers: { getRadius: cursorRadius, getFillColor: cursorFade, getLineColor: cursorFade },
                    parameters: { depthWriteEnabled: false } as any,
                }),
                new ScatterplotLayer({
                    id: 'selected-coord-pin',
                    data: [selectedCoord],
                    getPosition: (d: any) => [d.lon, d.lat],
                    radiusUnits: 'pixels',
                    getRadius: 6,
                    getFillColor: [0, 229, 255, Math.round(180 * cursorFade)],
                    stroked: true,
                    getLineColor: [255, 255, 255, Math.round(220 * cursorFade)],
                    lineWidthMinPixels: 2,
                    updateTriggers: { getFillColor: cursorFade, getLineColor: cursorFade },
                    parameters: { depthWriteEnabled: false } as any,
                }),
            );
        }

        return sorted;
    }, [
        modules.nasaGIBS, modules.nightLights, modules.tileGroup, modules.wind,
        modules.dayNight, modules.marine, modules.layerOrder,
        windPaths, marine, terminator, twilightBands, rainTimestamp,
        selectedCoord, yesterdayStr, ps.width, ps.trailLength,
    ]);

    /* ── Harita kurulumu (context-loss kurtarma için tekrar çağrılabilir) ── */
    const buildMap = useCallback(() => {
        if (!containerRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: buildBaseStyle(baseStyle),
            center: [0, 20],
            zoom: 2.2,
            minZoom: 1.2,
            maxZoom: 18,
            attributionControl: false,
            dragRotate: false,
            touchZoomRotate: true,
            touchPitch: false,
        });
        // Faz 1: Kesintisiz 2D↔3D — küre projeksiyonu (zoom ile otomatik düzleşir)
        map.on('style.load', () => {
            try { map.setProjection({ type: modules.globe3D ? 'globe' : 'mercator' } as any); } catch {}
        });

        const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
        map.addControl(overlay as any);

        mapRef.current = map;
        overlayRef.current = overlay;

        map.on('load', () => setReady(true));
        map.on('zoomend', () => onZoomChange?.(map.getZoom()));
        map.on('click', (e) => {
            const { lat, lng } = e.lngLat;
            onMapClick?.(lat, lng);
        });

        /* Faz 4: WebGL bağlam kaybı kurtarma state machine */
        const canvas = map.getCanvas();
        const onLost = (ev: Event) => {
            ev.preventDefault();
            setReady(false);
        };
        const onRestored = () => {
            // MapLibre bağlamı kendi geri yükler; overlay katmanlarını tazele
            if (mapRef.current) setReady(true);
        };
        canvas.addEventListener('webglcontextlost', onLost as any, false);
        canvas.addEventListener('webglcontextrestored', onRestored as any, false);
        (map as any).__ctxHandlers = { canvas, onLost, onRestored };
    }, [baseStyle, modules.globe3D, onZoomChange, onMapClick]);

    const destroyMap = useCallback(() => {
        const map = mapRef.current;
        const overlay = overlayRef.current;
        if (map && (map as any).__ctxHandlers) {
            const { canvas, onLost, onRestored } = (map as any).__ctxHandlers;
            canvas.removeEventListener('webglcontextlost', onLost);
            canvas.removeEventListener('webglcontextrestored', onRestored);
        }
        if (overlay && map) {
            try { map.removeControl(overlay as any); } catch {}
            try { overlay.finalize(); } catch {}
        }
        overlayRef.current = null;
        if (map) {
            try { map.remove(); } catch {}
        }
        mapRef.current = null;
    }, []);

    // Mount / unmount
    useEffect(() => {
        if (mapRef.current) return;
        buildMap();
        return () => {
            destroyMap();
            setReady(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Altlık değişince stili yenile (aynı stilde gereksiz reload yok)
    const prevBaseRef = useRef(baseStyle);
    useEffect(() => {
        if (!mapRef.current || !ready) return;
        if (prevBaseRef.current === baseStyle) return;
        prevBaseRef.current = baseStyle;
        mapRef.current.setStyle(buildBaseStyle(baseStyle));
        mapRef.current.once('style.load', () => {
            try { mapRef.current?.setProjection({ type: modules.globe3D ? 'globe' : 'mercator' } as any); } catch {}
        });
    }, [baseStyle, ready, modules.globe3D]);

    // Projeksiyon (küre / düz) değişimi
    useEffect(() => {
        if (!mapRef.current || !ready) return;
        try { mapRef.current.setProjection({ type: modules.globe3D ? 'globe' : 'mercator' } as any); } catch {}
    }, [modules.globe3D, ready]);

    // Konuma uçuş
    useEffect(() => {
        if (!mapRef.current || !flyTarget || !ready) return;
        mapRef.current.flyTo({
            center: [flyTarget.lon, flyTarget.lat],
            zoom: 7.5,
            duration: 1600,
            essential: true,
        });
    }, [flyTarget, ready]);

    /* ── Faz 2: Tek animasyon döngüsü — React re-render tetiklemeden
       deck.gl uniformlarını günceller. visibilitychange ile arka
       planda askıya alınır (Faz 4). ── */
    useEffect(() => {
        if (!ready) return;
        let frameId = 0;
        let timerId: any = 0;
        let lastTime = performance.now();
        let stopped = false;

        const tick = (now: number) => {
            const delta = clampFrameDelta((now - lastTime) / 1000);
            lastTime = now;
            const a = animRef.current;
            a.tripTime = (a.tripTime + delta * ps.speedMultiplier) % 12;
            a.cursorPhase += delta;
            a.cursorFade = selectedCoord
                ? Math.min(1, a.cursorFade + delta * 4)
                : Math.max(0, a.cursorFade - delta * 3);

            overlayRef.current?.setProps({ layers: buildLayers() });

            if (stopped) return;
            if (perfMode) {
                timerId = setTimeout(() => { frameId = requestAnimationFrame(tick); }, 33);
            } else {
                frameId = requestAnimationFrame(tick);
            }
        };

        const start = () => {
            lastTime = performance.now();
            frameId = requestAnimationFrame(tick);
        };
        const stop = () => {
            stopped = true;
            cancelAnimationFrame(frameId);
            clearTimeout(timerId);
        };

        const onVisibility = () => {
            if (document.hidden) {
                stop();
            } else {
                stopped = false;
                start();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        start();
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [ready, perfMode, ps.speedMultiplier, selectedCoord, buildLayers]);

    return (
        <div className="absolute inset-0 w-full h-full bg-black z-0">
            <div
                ref={containerRef}
                className="w-full h-full"
                aria-label="GPU hızlandırmalı entegre 2D/3D Dünya"
            />
        </div>
    );
}
