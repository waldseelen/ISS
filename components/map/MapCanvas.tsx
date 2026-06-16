'use client';

import { generateWindPaths, getWindColor, type WindTrajectory } from '@/lib/map';
import { AUTO_SWITCH_MAP_MAX_ZOOM, get2DStyleUrl } from '@/lib/canvasStyle';
import { CURSOR_PULSE_AMP, CURSOR_PULSE_BASE, CURSOR_PULSE_HZ, pulseRadius } from '@/lib/pulse';
import type { TwilightBand } from '@/hooks/useSun';
import type { BaseStyle, LayerOrderKey, MarineData, ModuleState, TerminatorPolygon, WindPoint } from '@/types';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';
import { PathLayer, ScatterplotLayer, PolygonLayer } from '@deck.gl/layers';
import maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

interface Props {
    modules: ModuleState;
    flyTarget: { lat: number; lon: number } | null;
    wind?: WindPoint[];
    marine?: MarineData | null;
    selectedCoord: { lat: number; lon: number } | null;
    baseStyle: BaseStyle;
    terminator: TerminatorPolygon;
    twilightBands?: TwilightBand[];
    onZoomChange?: (zoom: number) => void;
    onMapClick?: (lat: number, lon: number) => void;
}

export default function MapCanvas({
    modules,
    flyTarget,
    wind = [],
    marine,
    selectedCoord,
    baseStyle,
    terminator,
    twilightBands = [],
    onZoomChange,
    onMapClick
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const overlayRef = useRef<MapboxOverlay | null>(null);
    const [ready, setReady] = useState(false);
    const [windPaths, setWindPaths] = useState<WindTrajectory[]>([]);

    // Animation state driven by a single React timer
    const [anim, setAnim] = useState({
        tripTime: 0,
        cursorPhase: 0,
        cursorFade: 0,
    });

    const ps = modules.particleSettings;
    const perfMode = modules.performanceMode;

    const particleCount = useMemo(() => {
        const base = perfMode ? 600 : 1800;
        return Math.round(base * ps.density);
    }, [perfMode, ps.density]);

    useEffect(() => {
        const needWind = modules.wind || modules.tileGroup === 'precipitation';
        if (wind.length > 0 && needWind) {
            setWindPaths(generateWindPaths(wind, particleCount, 12));
        } else {
            setWindPaths([]);
        }
    }, [wind, modules.wind, modules.tileGroup, particleCount]);

    // Lightweight animation loop for Trips and Pulse properties
    useEffect(() => {
        let frameId: number;
        let lastTime = performance.now();

        const loop = (now: number) => {
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            const clampedDelta = Math.min(delta, 0.1);

            setAnim(prev => {
                const nextTripTime = (prev.tripTime + clampedDelta * ps.speedMultiplier) % 12;
                const nextCursorPhase = prev.cursorPhase + clampedDelta;
                let nextCursorFade = prev.cursorFade;

                if (selectedCoord) {
                    nextCursorFade = Math.min(1, prev.cursorFade + clampedDelta * 4);
                } else {
                    nextCursorFade = Math.max(0, prev.cursorFade - clampedDelta * 3);
                }

                return {
                    tripTime: nextTripTime,
                    cursorPhase: nextCursorPhase,
                    cursorFade: nextCursorFade,
                };
            });

            if (perfMode) {
                setTimeout(() => {
                    frameId = requestAnimationFrame(loop);
                }, 33);
            } else {
                frameId = requestAnimationFrame(loop);
            }
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, [ps.speedMultiplier, selectedCoord, perfMode]);

    const buildMap = useCallback(() => {
        if (!containerRef.current) return;

        if (overlayRef.current && mapRef.current) {
            try { mapRef.current.removeControl(overlayRef.current as any); } catch {}
            try { overlayRef.current.finalize(); } catch {}
            overlayRef.current = null;
        }
        if (mapRef.current) {
            try { mapRef.current.remove(); } catch {}
            mapRef.current = null;
        }

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: get2DStyleUrl(baseStyle),
            center: [0, 20],
            zoom: 2.2,
            minZoom: 1.5,
            maxZoom: 18,
            attributionControl: false,
            dragRotate: false,
            touchZoomRotate: true,
            touchPitch: false,
        });

        const deckOverlay = new MapboxOverlay({
            interleaved: true,
            layers: []
        });

        map.addControl(deckOverlay as any);
        mapRef.current = map;
        overlayRef.current = deckOverlay;

        map.on('load', () => {
            setReady(true);
        });

        map.on('zoomend', () => {
            onZoomChange?.(map.getZoom());
        });

        map.on('click', (e) => {
            const { lat, lng } = e.lngLat;
            onMapClick?.(lat, lng);
        });
    }, [baseStyle, onZoomChange, onMapClick]);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        buildMap();

        return () => {
            if (overlayRef.current && mapRef.current) {
                try { mapRef.current.removeControl(overlayRef.current as any); } catch {}
                try { overlayRef.current.finalize(); } catch {}
                overlayRef.current = null;
            }
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            setReady(false);
        };
    }, []);

    useEffect(() => {
        if (!mapRef.current || !ready) return;
        mapRef.current.setStyle(get2DStyleUrl(baseStyle));
    }, [baseStyle, ready]);

    useEffect(() => {
        if (!mapRef.current || !flyTarget || !ready) return;
        mapRef.current.flyTo({
            center: [flyTarget.lon, flyTarget.lat],
            zoom: 7.5,
            duration: 1600,
            essential: true
        });
    }, [flyTarget, ready]);

    // Declarative layer updates pushed to MapboxOverlay when data/ticks change
    useEffect(() => {
        if (!mapRef.current || !overlayRef.current || !ready) return;

        const showCursor = anim.cursorFade > 0.001;

        const cursorRadius = pulseRadius(anim.cursorPhase, CURSOR_PULSE_HZ, CURSOR_PULSE_AMP, CURSOR_PULSE_BASE);

        const orderMap: Record<LayerOrderKey, any[]> = {
            nasaGIBS: [],
            nightLights: [],
            temperature: [],
            precipitation: [],
            clouds: [],
            dayNight: [],
            wind: [],
            marine: []
        };

        // Precipitation trips
        if (modules.tileGroup === 'precipitation' && windPaths.length > 0) {
            orderMap.precipitation.push(new TripsLayer({
                id: 'rain-trips',
                data: windPaths,
                getPath: d => d.path,
                getTimestamps: d => d.timestamps.map((t: number) => t + 1.2),
                getColor: [0, 229, 255],
                opacity: 0.65,
                widthMinPixels: Math.max(1.0, ps.width * 0.55),
                trailLength: ps.trailLength * 0.8,
                currentTime: anim.tripTime,
                capRounded: true,
                jointRounded: true,
                shadowEnabled: false,
            }));
        }

        // Wind trips
        if (modules.wind && windPaths.length > 0) {
            orderMap.wind.push(new TripsLayer({
                id: 'wind-trips',
                data: windPaths,
                getPath: d => d.path,
                getTimestamps: d => d.timestamps,
                getColor: d => getWindColor(d.speed),
                opacity: 0.8,
                widthMinPixels: ps.width,
                trailLength: ps.trailLength,
                currentTime: anim.tripTime,
                capRounded: true,
                jointRounded: true,
                shadowEnabled: false,
            }));
        }

        // Day/night boundary
        if (modules.dayNight) {
            const bands = (twilightBands || [])
                .filter(b => b && b.rings && b.rings.length > 0)
                .map((band, idx) => new PolygonLayer({
                    id: `twilight-band-map-${idx}`,
                    data: band.rings,
                    getPolygon: (d: any) => d,
                    filled: true,
                    stroked: false,
                    getFillColor: band.color,
                    opacity: band.opacity,
                    pickable: false,
                }));
            orderMap.dayNight.push(...bands);

            if (terminator && terminator.rings && terminator.rings.length > 0) {
                orderMap.dayNight.push(new PolygonLayer({
                    id: 'terminator-night',
                    data: terminator.rings,
                    getPolygon: (d: any) => d,
                    filled: true,
                    stroked: false,
                    getFillColor: [4, 8, 18, 165],
                    opacity: 0.6,
                    pickable: false,
                }));
            }
        }

        // Marine wave point
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
            }));
        }

        // ISS removed

        const orderedLayers: any[] = [];
        modules.layerOrder.forEach(key => {
            const layerVal = orderMap[key];
            if (layerVal && layerVal.length > 0) {
                orderedLayers.push(...layerVal);
            }
        });

        const cursorLayers = [
            showCursor && selectedCoord && new ScatterplotLayer({
                id: 'selected-coord-pulse',
                data: [selectedCoord],
                getPosition: d => [d.lon, d.lat],
                radiusUnits: 'pixels',
                getRadius: cursorRadius,
                getFillColor: [0, 229, 255, Math.round(24 * anim.cursorFade)],
                stroked: true,
                getLineColor: [0, 229, 255, Math.round(140 * anim.cursorFade)],
                lineWidthMinPixels: 1.5,
            }),
            showCursor && selectedCoord && new ScatterplotLayer({
                id: 'selected-coord-pin',
                data: [selectedCoord],
                getPosition: d => [d.lon, d.lat],
                radiusUnits: 'pixels',
                getRadius: 6,
                getFillColor: [0, 229, 255, Math.round(180 * anim.cursorFade)],
                stroked: true,
                getLineColor: [255, 255, 255, Math.round(220 * anim.cursorFade)],
                lineWidthMinPixels: 2,
            })
        ].filter(Boolean);

        overlayRef.current.setProps({ layers: [...orderedLayers, ...cursorLayers] });
    }, [ready, anim, windPaths, marine, modules, terminator, twilightBands, ps]);

    return (
        <div className="absolute inset-0 w-full h-full bg-black z-0">
            <div
                ref={containerRef}
                className="w-full h-full"
                aria-label="2D GPU-accelerated Vector Map"
            />
            <div className="pointer-events-none absolute bottom-2 right-2 text-[9px] font-mono text-cyan-700/60">
                {AUTO_SWITCH_MAP_MAX_ZOOM.toFixed(1)}× — auto switch
            </div>
        </div>
    );
}
