'use client';

import { generateWindPaths, getWindColor, type WindTrajectory } from '@/lib/map';
import { get3DSourceUrl, AUTO_SWITCH_GLOBE_MIN_ZOOM } from '@/lib/canvasStyle';
import { clampFrameDelta, CURSOR_PULSE_AMP, CURSOR_PULSE_BASE, CURSOR_PULSE_HZ, ISS_PULSE_AMP, ISS_PULSE_BASE, ISS_PULSE_HZ, pulseRadius } from '@/lib/pulse';
import { getRainViewerTimestamp, TILES, yesterdayISO } from '@/lib/tiles';
import { splitTrailByAntimeridian } from '@/hooks/useISS';
import type { BaseStyle, ISSData, ModuleState, TerminatorPolygon, WindPoint } from '@/types';
import { Deck, _GlobeView as GlobeView, FlyToInterpolator } from '@deck.gl/core';
import { TripsLayer } from '@deck.gl/geo-layers';
import { PathLayer, ScatterplotLayer, BitmapLayer, PolygonLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
    iss: ISSData | null;
    trail: { lat: number; lon: number }[];
    prediction: { lat: number; lon: number }[];
    wind: WindPoint[];
    modules: ModuleState;
    baseStyle: BaseStyle;
    terminator: TerminatorPolygon;
    flyTarget: { lat: number; lon: number } | null;
    selectedCoord?: { lat: number; lon: number } | null;
    onCameraChange?: (distance: number) => void;
    onGlobeClick?: (lat: number, lon: number) => void;
}

function makeTileLayer(id: string, data: string, opacity: number, minZoom: number, maxZoom: number) {
    return new TileLayer({
        id,
        data,
        opacity,
        minZoom,
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
            });
        }
    });
}

export default function GlobeCanvas({
    iss,
    trail,
    prediction,
    wind,
    modules,
    baseStyle,
    terminator,
    flyTarget,
    selectedCoord,
    onCameraChange,
    onGlobeClick
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const deckRef = useRef<Deck<any> | null>(null);
    const [ready, setReady] = useState(false);
    const [windPaths, setWindPaths] = useState<WindTrajectory[]>([]);
    const [rainTimestamp, setRainTimestamp] = useState<number | null>(null);
    const viewStateRef = useRef({ longitude: 0, latitude: 20, zoom: 1.8 });
    const visibleRef = useRef(true);
    const frameRef = useRef(0);
    const cursorPhaseRef = useRef(0);
    const issPhaseRef = useRef(Math.PI / 3);
    const tripTimeRef = useRef(0);
    const lastTickRef = useRef(0);
    const cursorFadeRef = useRef(0);
    const prevSelectedRef = useRef<{ lat: number; lon: number } | null>(null);

    const yesterdayStr = useMemo(() => yesterdayISO(), []);
    const perfMode = modules.performanceMode;

    const baseLayers = useMemo(() => [
        makeTileLayer(`base-${baseStyle}-tiles`, get3DSourceUrl(baseStyle), 1, 0, 18),
    ], [baseStyle]);

    const overlayLayers = useMemo(() => {
        const layers: any[] = [];

        if (modules.nasaGIBS) {
            layers.push(makeTileLayer('nasagibs-globe-tiles', TILES.nasaGIBS(yesterdayStr), 0.9, 0, 9));
        }
        if (modules.nightLights) {
            layers.push(makeTileLayer('night-lights-tiles', TILES.nightLights, 0.65, 0, 8));
        }
        if (modules.tileGroup === 'temperature') {
            layers.push(makeTileLayer('temperature-globe-tiles',
                `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${yesterdayStr}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
                0.6, 0, 7));
        }
        if (modules.tileGroup === 'precipitation' && rainTimestamp) {
            layers.push(makeTileLayer('precipitation-globe-tiles', TILES.rainViewer(rainTimestamp), 0.75, 0, 12));
        }
        if (modules.tileGroup === 'clouds') {
            layers.push(makeTileLayer('clouds-globe-tiles', TILES.nasaClouds(yesterdayStr), 0.45, 0, 9));
        }

        if (modules.dayNight && terminator.ring.length > 0) {
            layers.push(new PolygonLayer({
                id: 'terminator-night-globe',
                data: [{ polygon: terminator.ring }],
                getPolygon: (d: any) => d.polygon,
                filled: true,
                stroked: false,
                getFillColor: [4, 8, 18, 165],
                opacity: 0.7,
                pickable: false,
            }));
        }

        return layers;
    }, [modules, modules.nasaGIBS, modules.nightLights, modules.tileGroup, modules.dayNight, rainTimestamp, yesterdayStr, terminator]);

    useEffect(() => {
        if (modules.tileGroup === 'precipitation') {
            getRainViewerTimestamp().then(setRainTimestamp);
        }
    }, [modules.tileGroup]);

    useEffect(() => {
        const needWind = modules.wind || modules.tileGroup === 'precipitation';
        if (wind.length > 0 && needWind) {
            setWindPaths(generateWindPaths(wind, perfMode ? 600 : 1800, 12));
        } else {
            setWindPaths([]);
        }
    }, [wind, modules.wind, modules.tileGroup, perfMode]);

    useEffect(() => {
        if (!containerRef.current || deckRef.current) return;

        const deck = new Deck({
            parent: containerRef.current,
            views: new GlobeView({ id: 'globe', controller: true }),
            initialViewState: viewStateRef.current,
            onViewStateChange: ({ viewState }) => {
                viewStateRef.current = viewState as any;
                onCameraChange?.(viewState.zoom);
            },
            onClick: (info) => {
                if (info.coordinate && onGlobeClick) {
                    const [lon, lat] = info.coordinate;
                    onGlobeClick(lat, lon);
                }
            },
        });

        const canvas = containerRef.current?.querySelector('canvas');
        const handleContextLost = (e: Event) => {
            e.preventDefault();
            console.warn('WebGL context lost on 3D Globe canvas. Re-initializing graphics...');
            setReady(false);
            setTimeout(() => setReady(true), 150);
        };
        canvas?.addEventListener('webglcontextlost', handleContextLost);

        deckRef.current = deck;
        setReady(true);

        return () => {
            canvas?.removeEventListener('webglcontextlost', handleContextLost);
            if (deckRef.current) {
                deckRef.current.finalize();
                deckRef.current = null;
            }
            setReady(false);
        };
    }, []);

    useEffect(() => {
        if (!deckRef.current || !flyTarget || !ready) return;

        viewStateRef.current = {
            longitude: flyTarget.lon,
            latitude: flyTarget.lat,
            zoom: 4.8,
        };

        deckRef.current.setProps({
            initialViewState: {
                ...viewStateRef.current,
                transitionDuration: 1800,
                transitionInterpolator: new FlyToInterpolator(),
            }
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
        const cur = selectedCoord ?? null;
        if (cur !== prevSelectedRef.current) {
            cursorFadeRef.current = 0;
            prevSelectedRef.current = cur;
        }
    }, [selectedCoord]);

    useEffect(() => {
        if (!deckRef.current || !ready) return;

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
            const cursorAlpha = Math.round(cursorFadeRef.current * 255);

            const showCursor = cursorFadeRef.current > 0.001;
            const showISS = !!modules.iss && !!iss;

            const dynamicLayers = [
                showCursor && new ScatterplotLayer({
                    id: 'selected-coord-pulse-3d',
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
                    id: 'selected-coord-pin-3d',
                    data: selectedCoord ? [selectedCoord] : [],
                    getPosition: d => [d.lon, d.lat],
                    radiusUnits: 'pixels',
                    getRadius: 7,
                    getFillColor: [0, 229, 255, Math.round(180 * cursorFadeRef.current)],
                    stroked: true,
                    getLineColor: [255, 255, 255, Math.round(220 * cursorFadeRef.current)],
                    lineWidthMinPixels: 2,
                }),

                modules.wind && new TripsLayer({
                    id: 'wind-trips-3d',
                    data: windPaths,
                    getPath: d => d.path,
                    getTimestamps: d => d.timestamps,
                    getColor: d => getWindColor(d.speed),
                    opacity: 0.85,
                    widthMinPixels: 1.8,
                    trailLength: 2.2,
                    currentTime: tripTimeRef.current,
                    rounded: true,
                    shadowEnabled: false,
                }),

                modules.tileGroup === 'precipitation' && new TripsLayer({
                    id: 'rain-trips-3d',
                    data: windPaths,
                    getPath: d => d.path,
                    getTimestamps: d => d.timestamps.map((t: number) => t + 1.2),
                    getColor: [0, 229, 255],
                    opacity: 0.7,
                    widthMinPixels: 1.0,
                    trailLength: 1.8,
                    currentTime: tripTimeRef.current,
                    rounded: true,
                    shadowEnabled: false,
                }),

                showISS && new PathLayer({
                    id: 'iss-trail-3d',
                    data: trailSegments,
                    getPath: d => d.path as [number, number][],
                    getColor: [0, 229, 255, 160],
                    getWidth: 4,
                    widthMinPixels: 2.5,
                    capRounded: true,
                    jointRounded: true,
                }),

                showISS && new PathLayer({
                    id: 'iss-prediction-3d',
                    data: predictionSegments,
                    getPath: d => d.path as [number, number][],
                    getColor: [255, 255, 255, 75],
                    getWidth: 2.5,
                    widthMinPixels: 1.8,
                }),

                showISS && new ScatterplotLayer({
                    id: 'iss-glow-3d',
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
                    id: 'iss-core-3d',
                    data: [iss],
                    getPosition: d => [d.longitude, d.latitude],
                    radiusUnits: 'pixels',
                    getRadius: 9,
                    getFillColor: [255, 255, 255, 230],
                    stroked: true,
                    getLineColor: [0, 229, 255, 255],
                    lineWidthMinPixels: 2.2,
                }),
            ].filter(Boolean);

            if (deckRef.current) {
                deckRef.current.setProps({ layers: [...baseLayers, ...overlayLayers, ...dynamicLayers] });
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
    }, [ready, selectedCoord, windPaths, iss, trail, prediction, modules, baseLayers, overlayLayers]);

    return (
        <div
            className="absolute inset-0 w-full h-full z-0"
            style={{ background: 'radial-gradient(circle at center, rgba(0, 229, 255, 0.08) 0%, rgba(0, 0, 0, 1) 68%)' }}
        >
            <div
                ref={containerRef}
                className="w-full h-full"
                aria-label="3D GPU-accelerated Vector Globe"
            />
            {/* Globe zoom threshold indicator (dev hint) */}
            <div className="pointer-events-none absolute bottom-2 right-2 text-[9px] font-mono text-cyan-700/60">
                {AUTO_SWITCH_GLOBE_MIN_ZOOM.toFixed(1)}× — auto switch
            </div>
        </div>
    );
}
