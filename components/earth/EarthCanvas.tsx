'use client';

import { generateWindPaths, getWindColor, type WindTrajectory } from '@/lib/map';
import { buildBaseStyle } from '@/lib/canvasStyle';
import { CURSOR_PULSE_AMP, CURSOR_PULSE_BASE, CURSOR_PULSE_HZ, clampFrameDelta, pulseRadius } from '@/lib/pulse';
import { getRainViewerTimestamp, TILES, yesterdayISO } from '@/lib/tiles';
import type { TwilightBand } from '@/hooks/useSun';
import type { BaseStyle, LayerOrderKey, MarineData, ModuleState, TerminatorPolygon, WindPoint } from '@/types';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer } from '@deck.gl/layers';
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

/* ─────────────────────────────────────────────────────────────
   Compositing modeli (Zoom Earth-grade):
   • Altlık + tüm raster overlay'ler + gündüz/gece gölgesi → MapLibre
     NATIVE katmanlar (tek reprojection hattı, piksel-hizalı, SW-cache).
   • deck.gl overlay yalnızca animasyonlu parçacıklar (rüzgar/yağış),
     deniz dalga noktası ve seçim imleci için kullanılır.
   ───────────────────────────────────────────────────────────── */

interface RasterSpec { tiles: string; opacity: number; maxzoom: number; }

/* Raster overlay id eşlemesi (LayerOrderKey → MapLibre layer id) */
const RASTER_LAYER_ID: Partial<Record<LayerOrderKey, string>> = {
    nasaGIBS: 'ov-nasagibs',
    nightLights: 'ov-nightlights',
    temperature: 'ov-temperature',
    precipitation: 'ov-precip',
    clouds: 'ov-clouds',
};
const DAYNIGHT_LAYER_ID = 'ov-daynight';
const DAYNIGHT_SRC_ID = 'ov-daynight-src';

function rasterSpecFor(
    key: LayerOrderKey,
    modules: ModuleState,
    yesterdayStr: string,
    rainTimestamp: number | null,
): RasterSpec | null {
    switch (key) {
        case 'nasaGIBS':
            return modules.nasaGIBS ? { tiles: TILES.nasaGIBS(yesterdayStr), opacity: 0.9, maxzoom: 9 } : null;
        case 'nightLights':
            return modules.nightLights ? { tiles: TILES.nightLights, opacity: 0.65, maxzoom: 8 } : null;
        case 'temperature':
            return modules.tileGroup === 'temperature'
                ? { tiles: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${yesterdayStr}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`, opacity: 0.6, maxzoom: 7 }
                : null;
        case 'precipitation':
            return modules.tileGroup === 'precipitation' && rainTimestamp
                ? { tiles: TILES.rainViewer(rainTimestamp), opacity: 0.75, maxzoom: 12 } : null;
        case 'clouds':
            return modules.tileGroup === 'clouds' ? { tiles: TILES.nasaClouds(yesterdayStr), opacity: 0.45, maxzoom: 9 } : null;
        default:
            return null;
    }
}

/* Gündüz/gece: terminatör + alacakaranlık bandlarını tek GeoJSON fill
   kaynağına çevirir (native compositing, per-feature renk/opaklık). */
function buildDayNightGeoJSON(terminator: TerminatorPolygon, twilightBands: TwilightBand[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];
    const toFeature = (rings: [number, number, number?][][], color: string, opacity: number): GeoJSON.Feature => ({
        type: 'Feature',
        properties: { c: color, o: opacity },
        geometry: {
            type: 'MultiPolygon',
            coordinates: rings.map(r => [r.map(pt => [pt[0], pt[1]])]),
        },
    });
    (twilightBands || []).forEach(b => {
        if (b?.rings?.length) features.push(toFeature(b.rings, `rgb(${b.color[0]},${b.color[1]},${b.color[2]})`, b.opacity));
    });
    if (terminator?.rings?.length) features.push(toFeature(terminator.rings, 'rgb(4,8,18)', 0.72));
    return { type: 'FeatureCollection', features };
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
    // Stil (setStyle) her yeniden yüklendiğinde overlay'leri yeniden kurmak için
    const [styleEpoch, setStyleEpoch] = useState(0);
    // Raster kaynak URL'lerini takip et (RainViewer zaman damgası değişince yenile)
    const rasterUrlRef = useRef<Record<string, string>>({});

    const [windPaths, setWindPaths] = useState<WindTrajectory[]>([]);
    const [rainTimestamp, setRainTimestamp] = useState<number | null>(null);

    /* Faz 2: Animasyon değerleri ref'te — per-frame React re-render yok */
    const animRef = useRef({ tripTime: 0, cursorPhase: 0, cursorFade: 0 });

    const yesterdayStr = useMemo(() => yesterdayISO(), []);
    const ps = modules.particleSettings;
    const perfMode = modules.performanceMode;

    const particleCount = useMemo(() => {
        const base = perfMode ? 600 : 1800;
        return Math.round(base * ps.density);
    }, [perfMode, ps.density]);

    /* Parçacık yolları — density kaydırıcısında debounce ile ana thread kilidini önle */
    useEffect(() => {
        const needWind = modules.wind || modules.tileGroup === 'precipitation';
        if (!(wind.length > 0 && needWind)) {
            setWindPaths([]);
            return;
        }
        const handle = setTimeout(() => setWindPaths(generateWindPaths(wind, particleCount, 12)), 120);
        return () => clearTimeout(handle);
    }, [wind, modules.wind, modules.tileGroup, particleCount]);

    useEffect(() => {
        if (modules.tileGroup === 'precipitation') getRainViewerTimestamp().then(setRainTimestamp);
    }, [modules.tileGroup]);

    /* ── deck.gl katmanları: yalnızca parçacık + marker (raster'lar native) ── */
    const buildLayers = useCallback(() => {
        const { tripTime, cursorPhase, cursorFade } = animRef.current;
        const byKey: Record<'precipitation' | 'wind' | 'marine', any[]> = { precipitation: [], wind: [], marine: [] };

        if (modules.tileGroup === 'precipitation' && windPaths.length > 0) {
            byKey.precipitation.push(new TripsLayer({
                id: 'rain-trips', data: windPaths,
                getPath: (d: any) => d.path,
                getTimestamps: (d: any) => d.timestamps.map((t: number) => t + 1.2),
                getColor: [0, 229, 255], opacity: 0.7,
                widthMinPixels: Math.max(1.0, ps.width * 0.55), trailLength: ps.trailLength * 0.8,
                currentTime: tripTime, capRounded: true, jointRounded: true, shadowEnabled: false,
                parameters: { depthWriteEnabled: false } as any,
            }));
        }
        if (modules.wind && windPaths.length > 0) {
            byKey.wind.push(new TripsLayer({
                id: 'wind-trips', data: windPaths,
                getPath: (d: any) => d.path,
                getTimestamps: (d: any) => d.timestamps,
                getColor: (d: any) => getWindColor(d.speed), opacity: 0.85,
                widthMinPixels: ps.width, trailLength: ps.trailLength,
                currentTime: tripTime, capRounded: true, jointRounded: true, shadowEnabled: false,
                parameters: { depthWriteEnabled: false } as any,
            }));
        }
        if (modules.marine && marine) {
            byKey.marine.push(new ScatterplotLayer({
                id: 'marine-wave-point', data: [marine],
                getPosition: (d: MarineData) => [d.longitude, d.latitude],
                radiusUnits: 'pixels', getRadius: 18 + (marine.waveHeight ?? 0) * 6,
                getFillColor: (() => {
                    const sst = marine.seaSurfaceTemperature ?? 15;
                    if (sst < 5) return [6, 78, 135, 140];
                    if (sst < 15) return [26, 139, 204, 140];
                    if (sst < 25) return [45, 212, 191, 140];
                    return [251, 191, 36, 140];
                })(),
                stroked: true, getLineColor: [0, 229, 255, 80], lineWidthMinPixels: 1.5,
                parameters: { depthWriteEnabled: false } as any,
            }));
        }

        const sorted: any[] = [];
        modules.layerOrder.forEach(key => {
            if (key === 'precipitation') sorted.push(...byKey.precipitation);
            else if (key === 'wind') sorted.push(...byKey.wind);
            else if (key === 'marine') sorted.push(...byKey.marine);
        });

        const showCursor = cursorFade > 0.001;
        if (showCursor && selectedCoord) {
            const cursorRadius = pulseRadius(cursorPhase, CURSOR_PULSE_HZ, CURSOR_PULSE_AMP, CURSOR_PULSE_BASE);
            sorted.push(
                new ScatterplotLayer({
                    id: 'selected-coord-pulse', data: [selectedCoord],
                    getPosition: (d: any) => [d.lon, d.lat], radiusUnits: 'pixels',
                    getRadius: cursorRadius, getFillColor: [0, 229, 255, Math.round(24 * cursorFade)],
                    stroked: true, getLineColor: [0, 229, 255, Math.round(140 * cursorFade)], lineWidthMinPixels: 1.5,
                    updateTriggers: { getRadius: cursorRadius, getFillColor: cursorFade, getLineColor: cursorFade },
                    parameters: { depthWriteEnabled: false } as any,
                }),
                new ScatterplotLayer({
                    id: 'selected-coord-pin', data: [selectedCoord],
                    getPosition: (d: any) => [d.lon, d.lat], radiusUnits: 'pixels',
                    getRadius: 6, getFillColor: [0, 229, 255, Math.round(180 * cursorFade)],
                    stroked: true, getLineColor: [255, 255, 255, Math.round(220 * cursorFade)], lineWidthMinPixels: 2,
                    updateTriggers: { getFillColor: cursorFade, getLineColor: cursorFade },
                    parameters: { depthWriteEnabled: false } as any,
                }),
            );
        }
        return sorted;
    }, [modules.tileGroup, modules.wind, modules.marine, modules.layerOrder, windPaths, marine, selectedCoord, ps.width, ps.trailLength]);

    /* ── MapLibre native raster + gündüz/gece katmanlarını modül state ile senkronla ── */
    const syncNativeOverlays = useCallback(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;

        // 1) Raster overlay'leri ekle/güncelle/kaldır
        (Object.keys(RASTER_LAYER_ID) as LayerOrderKey[]).forEach(key => {
            const layerId = RASTER_LAYER_ID[key]!;
            const srcId = `${layerId}-src`;
            const spec = rasterSpecFor(key, modules, yesterdayStr, rainTimestamp);
            if (!spec) {
                if (map.getLayer(layerId)) map.removeLayer(layerId);
                if (map.getSource(srcId)) map.removeSource(srcId);
                delete rasterUrlRef.current[layerId];
                return;
            }
            const prevUrl = rasterUrlRef.current[layerId];
            // URL değiştiyse (ör. RainViewer zaman damgası) kaynağı yeniden kur
            if (prevUrl && prevUrl !== spec.tiles) {
                if (map.getLayer(layerId)) map.removeLayer(layerId);
                if (map.getSource(srcId)) map.removeSource(srcId);
            }
            if (!map.getSource(srcId)) {
                map.addSource(srcId, { type: 'raster', tiles: [spec.tiles], tileSize: 256, maxzoom: spec.maxzoom } as any);
            }
            if (!map.getLayer(layerId)) {
                map.addLayer({ id: layerId, type: 'raster', source: srcId, paint: { 'raster-opacity': spec.opacity, 'raster-fade-duration': 200 } });
            } else {
                map.setPaintProperty(layerId, 'raster-opacity', spec.opacity);
            }
            rasterUrlRef.current[layerId] = spec.tiles;
        });

        // 2) Gündüz/gece fill katmanı
        if (modules.dayNight) {
            const data = buildDayNightGeoJSON(terminator, twilightBands);
            const src = map.getSource(DAYNIGHT_SRC_ID) as maplibregl.GeoJSONSource | undefined;
            if (!src) {
                map.addSource(DAYNIGHT_SRC_ID, { type: 'geojson', data } as any);
                map.addLayer({
                    id: DAYNIGHT_LAYER_ID, type: 'fill', source: DAYNIGHT_SRC_ID,
                    paint: { 'fill-color': ['get', 'c'] as any, 'fill-opacity': ['get', 'o'] as any, 'fill-antialias': false },
                });
            } else {
                src.setData(data);
            }
        } else {
            if (map.getLayer(DAYNIGHT_LAYER_ID)) map.removeLayer(DAYNIGHT_LAYER_ID);
            if (map.getSource(DAYNIGHT_SRC_ID)) map.removeSource(DAYNIGHT_SRC_ID);
        }

        // 3) Kanonik sıraya göre diz (layerOrder). Her katmanı sırayla üste taşı →
        //    son taşınan en üstte; altlık en altta kalır. deck overlay hepsinin üstünde.
        modules.layerOrder.forEach(key => {
            const layerId = key === 'dayNight' ? DAYNIGHT_LAYER_ID : RASTER_LAYER_ID[key];
            if (layerId && map.getLayer(layerId)) {
                try { map.moveLayer(layerId); } catch { /* yoksay */ }
            }
        });
    }, [modules, yesterdayStr, rainTimestamp, terminator, twilightBands]);

    useEffect(() => {
        if (!ready) return;
        syncNativeOverlays();
    }, [ready, styleEpoch, syncNativeOverlays]);

    /* ── Harita kurulumu (context-loss kurtarma için tekrar çağrılabilir) ── */
    const buildMap = useCallback(() => {
        if (!containerRef.current) return;
        const map = new maplibregl.Map({
            container: containerRef.current,
            style: buildBaseStyle(baseStyle),
            center: [0, 20], zoom: 2.2, minZoom: 1.2, maxZoom: 18,
            attributionControl: false, dragRotate: false, touchZoomRotate: true, touchPitch: false,
        });
        map.on('style.load', () => {
            try { map.setProjection({ type: modules.globe3D ? 'globe' : 'mercator' } as any); } catch {}
            rasterUrlRef.current = {};
            setStyleEpoch(e => e + 1);
        });

        const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
        map.addControl(overlay as any);
        mapRef.current = map;
        overlayRef.current = overlay;

        map.on('load', () => setReady(true));
        map.on('zoomend', () => onZoomChange?.(map.getZoom()));
        map.on('click', (e) => { const { lat, lng } = e.lngLat; onMapClick?.(lat, lng); });

        /* Faz 4: WebGL bağlam kaybı kurtarma */
        const canvas = map.getCanvas();
        const onLost = (ev: Event) => { ev.preventDefault(); setReady(false); };
        const onRestored = () => { if (mapRef.current) setReady(true); };
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
        if (map) { try { map.remove(); } catch {} }
        mapRef.current = null;
    }, []);

    useEffect(() => {
        if (mapRef.current) return;
        buildMap();
        return () => { destroyMap(); setReady(false); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Altlık değişince stili yenile (aynı stilde gereksiz reload yok)
    const prevBaseRef = useRef(baseStyle);
    useEffect(() => {
        if (!mapRef.current || !ready) return;
        if (prevBaseRef.current === baseStyle) return;
        prevBaseRef.current = baseStyle;
        // style.load handler projeksiyonu + styleEpoch'u tekrar uygular → overlay'ler yeniden kurulur
        mapRef.current.setStyle(buildBaseStyle(baseStyle));
    }, [baseStyle, ready]);

    // Projeksiyon (küre / düz) değişimi — kesintisiz geçiş
    useEffect(() => {
        if (!mapRef.current || !ready) return;
        try { mapRef.current.setProjection({ type: modules.globe3D ? 'globe' : 'mercator' } as any); } catch {}
    }, [modules.globe3D, ready]);

    // Konuma uçuş
    useEffect(() => {
        if (!mapRef.current || !flyTarget || !ready) return;
        mapRef.current.flyTo({ center: [flyTarget.lon, flyTarget.lat], zoom: 7.5, duration: 1600, essential: true });
    }, [flyTarget, ready]);

    /* ── Tek animasyon döngüsü: deck uniformlarını setProps ile günceller,
       React re-render yok. visibilitychange ile arka planda askıya alınır. ── */
    useEffect(() => {
        if (!ready) return;
        let frameId = 0, timerId: any = 0, stopped = false;
        let lastTime = performance.now();

        const tick = (now: number) => {
            const delta = clampFrameDelta((now - lastTime) / 1000);
            lastTime = now;
            const a = animRef.current;
            a.tripTime = (a.tripTime + delta * ps.speedMultiplier) % 12;
            a.cursorPhase += delta;
            a.cursorFade = selectedCoord ? Math.min(1, a.cursorFade + delta * 4) : Math.max(0, a.cursorFade - delta * 3);
            overlayRef.current?.setProps({ layers: buildLayers() });
            if (stopped) return;
            if (perfMode) timerId = setTimeout(() => { frameId = requestAnimationFrame(tick); }, 33);
            else frameId = requestAnimationFrame(tick);
        };
        const start = () => { lastTime = performance.now(); frameId = requestAnimationFrame(tick); };
        const stop = () => { stopped = true; cancelAnimationFrame(frameId); clearTimeout(timerId); };
        const onVisibility = () => { if (document.hidden) stop(); else { stopped = false; start(); } };

        document.addEventListener('visibilitychange', onVisibility);
        start();
        return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
    }, [ready, perfMode, ps.speedMultiplier, selectedCoord, buildLayers]);

    return (
        <div className="absolute inset-0 w-full h-full bg-black z-0">
            <div ref={containerRef} className="w-full h-full" aria-label="GPU hızlandırmalı entegre 2D/3D Dünya" />
        </div>
    );
}
