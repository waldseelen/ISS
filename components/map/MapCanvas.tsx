'use client';

import { generateWindPaths, getWindColor, type WindTrajectory } from '@/lib/map';
import { AUTO_SWITCH_MAP_MAX_ZOOM, get2DStyleUrl } from '@/lib/canvasStyle';
import { clampFrameDelta, CURSOR_PULSE_AMP, CURSOR_PULSE_BASE, CURSOR_PULSE_HZ, ISS_PULSE_AMP, ISS_PULSE_BASE, ISS_PULSE_HZ, pulseRadius } from '@/lib/pulse';
import { splitTrailByAntimeridian } from '@/hooks/useISS';
import type { BaseStyle, ISSData, ModuleState, TerminatorPolygon, WindPoint } from '@/types';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { TripsLayer } from '@deck.gl/geo-layers';
import { PathLayer, ScatterplotLayer, PolygonLayer } from '@deck.gl/layers';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

interface Props {
    modules: ModuleState;
    iss: ISSData | null;
    trail: { lat: number; lon: number }[];
    prediction: { lat: number; lon: number }[];
    flyTarget: { lat: number; lon: number } | null;
    wind?: WindPoint[];
    selectedCoord: { lat: number; lon: number } | null;
    baseStyle: BaseStyle;
    terminator: TerminatorPolygon;
    onZoomChange?: (zoom: number) => void;
    onMapClick?: (lat: number, lon: number) => void;
}

export default function MapCanvas({
    modules,
    iss,
    trail,
    prediction,
    flyTarget,
    wind = [],
    selectedCoord,
    baseStyle,
    terminator,
    onZoomChange,
    onMapClick
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const overlayRef = useRef<MapboxOverlay | null>(null);
    const [ready, setReady] = useState(false);
    const [windPaths, setWindPaths] = useState<WindTrajectory[]>([]);
    const visibleRef = useRef(true);
    const frameRef = useRef(0);
    const cursorPhaseRef = useRef(0);
    const issPhaseRef = useRef(Math.PI / 3);
    const tripTimeRef = useRef(0);
    const lastTickRef = useRef(0);
    const cursorFadeRef = useRef(0);
    const prevSelectedRef = useRef<{ lat: number; lon: number } | null>(null);
    const perfMode = modules.performanceMode;

    useEffect(() => {
        const needWind = modules.wind || modules.tileGroup === 'precipitation';
        if (wind.length > 0 && needWind) {
            setWindPaths(generateWindPaths(wind, perfMode ? 600 : 1800, 12));
        } else {
            setWindPaths([]);
        }
    }, [wind, modules.wind, modules.tileGroup, perfMode]);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: get2DStyleUrl(baseStyle),
            center: [0, 20],
            zoom: 2.2,
            minZoom: 1.5,
            maxZoom: 18,
            attributionControl: false,
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

        map.on('webglcontextlost', (e: any) => {
            e.preventDefault();
            console.warn('WebGL context lost on 2D Vector Map. Auto-recreating map resources...');
            setReady(false);
            setTimeout(() => setReady(true), 150);
        });

        map.on('zoomend', () => {
            onZoomChange?.(map.getZoom());
        });

        map.on('click', (e) => {
            const { lat, lng } = e.lngLat;
            onMapClick?.(lat, lng);
        });

        return () => {
            if (overlayRef.current) {
                map.removeControl(overlayRef.current as any);
                overlayRef.current.finalize();
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

    useEffect(() => {
        const onVisibilityChange = () => {
            visibleRef.current = document.visibilityState === 'visible';
            if (!visibleRef.current && frameRef.current) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    useEffect(() => {
        if (selectedCoord !== prevSelectedRef.current) {
            cursorFadeRef.current = 0;
            prevSelectedRef.current = selectedCoord;
        }
    }, [selectedCoord]);

    useEffect(() => {
        if (!mapRef.current || !overlayRef.current || !ready) return;

        const trailSegments = splitTrailByAntimeridian(trail);
        const predictionSegments = splitTrailByAntimeridian(prediction);

        const tick = (timestamp: number) => {
            if (!visibleRef.current) {
                frameRef.current = requestAnimationFrame(tick);
                return;
            }
            const last = lastTickRef.current || timestamp;
            const rawDelta = (timestamp - last) / 1000;
            const delta = clampFrameDelta(rawDelta);
            lastTickRef.current = timestamp;

            cursorPhaseRef.current += delta;
            issPhaseRef.current += delta;
            tripTimeRef.current = (tripTimeRef.current + delta * 1.2) % 12;

            if (selectedCoord) {
                cursorFadeRef.current = Math.min(1, cursorFadeRef.current + delta * 4);
            } else {
                cursorFadeRef.current = Math.max(0, cursorFadeRef.current - delta * 3);
            }

            const cursorRadius = pulseRadius(cursorPhaseRef.current, CURSOR_PULSE_HZ, CURSOR_PULSE_AMP, CURSOR_PULSE_BASE);
            const issRadius = pulseRadius(issPhaseRef.current, ISS_PULSE_HZ, ISS_PULSE_AMP, ISS_PULSE_BASE);
            const showCursor = cursorFadeRef.current > 0.001;
            const showISS = !!modules.iss && !!iss;

            const layers = [
                showCursor && new ScatterplotLayer({
                    id: 'selected-coord-pulse',
                    data: selectedCoord ? [selectedCoord] : [],
                    getPosition: d => [d.lon, d.lat],
                    radiusUnits: 'pixels',
                    getRadius: cursorRadius,
                    getFillColor: [0, 229, 255, Math.round(24 * cursorFadeRef.current)],
                    stroked: true,
                    getLineColor: [0, 229, 255, Math.round(140 * cursorFadeRef.current)],
                    lineWidthMinPixels: 1.5,
                    updateTriggers: {
                        getRadius: [Math.floor(cursorPhaseRef.current * 10)],
                    },
                }),
                showCursor && new ScatterplotLayer({
                    id: 'selected-coord-pin',
                    data: selectedCoord ? [selectedCoord] : [],
                    getPosition: d => [d.lon, d.lat],
                    radiusUnits: 'pixels',
                    getRadius: 6,
                    getFillColor: [0, 229, 255, Math.round(180 * cursorFadeRef.current)],
                    stroked: true,
                    getLineColor: [255, 255, 255, Math.round(220 * cursorFadeRef.current)],
                    lineWidthMinPixels: 2,
                }),

                modules.wind && new TripsLayer({
                    id: 'wind-trips',
                    data: windPaths,
                    getPath: d => d.path,
                    getTimestamps: d => d.timestamps,
                    getColor: d => getWindColor(d.speed),
                    opacity: 0.8,
                    widthMinPixels: 1.8,
                    trailLength: 2.2,
                    currentTime: tripTimeRef.current,
                    rounded: true,
                    shadowEnabled: false,
                }),

                modules.tileGroup === 'precipitation' && new TripsLayer({
                    id: 'rain-trips',
                    data: windPaths,
                    getPath: d => d.path,
                    getTimestamps: d => d.timestamps.map((t: number) => t + 1.2),
                    getColor: [0, 229, 255],
                    opacity: 0.65,
                    widthMinPixels: 1.0,
                    trailLength: 1.8,
                    currentTime: tripTimeRef.current,
                    rounded: true,
                    shadowEnabled: false,
                }),

                showISS && new PathLayer({
                    id: 'iss-trail',
                    data: trailSegments,
                    getPath: d => d.path as [number, number][],
                    getColor: [0, 229, 255, 160],
                    getWidth: 4,
                    widthMinPixels: 2.5,
                    capRounded: true,
                    jointRounded: true,
                }),

                showISS && new PathLayer({
                    id: 'iss-prediction',
                    data: predictionSegments,
                    getPath: d => d.path as [number, number][],
                    getColor: [255, 255, 255, 75],
                    getWidth: 2.5,
                    widthMinPixels: 1.8,
                    dashJustified: true,
                }),

                modules.dayNight && terminator.ring.length > 0 && new PolygonLayer({
                    id: 'terminator-night',
                    data: [{ polygon: terminator.ring }],
                    getPolygon: (d: any) => d.polygon,
                    filled: true,
                    stroked: false,
                    getFillColor: [4, 8, 18, 165],
                    opacity: 0.6,
                    pickable: false,
                }),

                showISS && new ScatterplotLayer({
                    id: 'iss-glow',
                    data: [iss],
                    getPosition: d => [d.longitude, d.latitude],
                    radiusUnits: 'pixels',
                    getRadius: issRadius,
                    getFillColor: [0, 229, 255, 22],
                    stroked: true,
                    getLineColor: [0, 229, 255, 100],
                    lineWidthMinPixels: 1,
                    updateTriggers: {
                        getRadius: [Math.floor(issPhaseRef.current * 10)],
                    },
                }),
                showISS && new ScatterplotLayer({
                    id: 'iss-core',
                    data: [iss],
                    getPosition: d => [d.longitude, d.latitude],
                    radiusUnits: 'pixels',
                    getRadius: 8,
                    getFillColor: [255, 255, 255, 230],
                    stroked: true,
                    getLineColor: [0, 229, 255, 255],
                    lineWidthMinPixels: 2.2,
                }),
            ].filter(Boolean);

            if (overlayRef.current) {
                overlayRef.current.setProps({ layers });
            }

            frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = 0;
            }
        };
    }, [ready, selectedCoord, windPaths, iss, trail, prediction, modules, terminator]);

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
