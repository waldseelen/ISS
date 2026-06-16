'use client';

import { generateWindPaths, getWindColor, type WindTrajectory } from '@/lib/map';
import { get3DSourceUrl, AUTO_SWITCH_GLOBE_MIN_ZOOM } from '@/lib/canvasStyle';
import { CURSOR_PULSE_AMP, CURSOR_PULSE_BASE, CURSOR_PULSE_HZ, pulseRadius } from '@/lib/pulse';
import { getRainViewerTimestamp, TILES, yesterdayISO } from '@/lib/tiles';
import type { TwilightBand } from '@/hooks/useSun';
import type { BaseStyle, LayerOrderKey, MarineData, ModuleState, TerminatorPolygon, WindPoint } from '@/types';
import { _GlobeView as GlobeView, FlyToInterpolator } from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import { TripsLayer } from '@deck.gl/geo-layers';
import { PathLayer, ScatterplotLayer, BitmapLayer, PolygonLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { useEffect, useMemo, useState, useCallback } from 'react';

interface Props {
    wind: WindPoint[];
    marine: MarineData | null;
    modules: ModuleState;
    baseStyle: BaseStyle;
    terminator: TerminatorPolygon;
    twilightBands?: TwilightBand[];
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
    wind,
    marine,
    modules,
    baseStyle,
    terminator,
    twilightBands = [],
    flyTarget,
    selectedCoord,
    onCameraChange,
    onGlobeClick
}: Props) {
    const [windPaths, setWindPaths] = useState<WindTrajectory[]>([]);
    const [rainTimestamp, setRainTimestamp] = useState<number | null>(null);

    const [viewState, setViewState] = useState<any>({
        longitude: 0,
        latitude: 20,
        zoom: 1.8,
        minZoom: 1.5,
        maxZoom: 18,
    });

    // Animate state grouped to minimize React render jitter
    const [anim, setAnim] = useState({
        tripTime: 0,
        cursorPhase: 0,
        cursorFade: 0,
    });

    const yesterdayStr = useMemo(() => yesterdayISO(), []);
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

    useEffect(() => {
        if (modules.tileGroup === 'precipitation') {
            getRainViewerTimestamp().then(setRainTimestamp);
        }
    }, [modules.tileGroup]);

    // Fly to target interpolation trigger
    useEffect(() => {
        if (!flyTarget) return;
        setViewState((prev: any) => ({
            ...prev,
            longitude: flyTarget.lon,
            latitude: flyTarget.lat,
            zoom: 4.8,
            transitionDuration: 1800,
            transitionInterpolator: new FlyToInterpolator(),
        }));
    }, [flyTarget]);

    // Lightweight animation loop for Trips and Pulse properties
    useEffect(() => {
        let frameId: number;
        let lastTime = performance.now();

        const loop = (now: number) => {
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            // Clamping delta to avoid physics explosion
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

            // If performance mode is active, throttle updates to ~30 FPS
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

    const onViewStateChange = useCallback(({ viewState: nextViewState }: any) => {
        setViewState(nextViewState);
        onCameraChange?.(nextViewState.zoom);
    }, [onCameraChange]);

    // Memoized static overlays to prevent GPU buffer rebuilds
    const staticLayers = useMemo(() => {
        const list = [
            makeTileLayer(`base-${baseStyle}-tiles`, get3DSourceUrl(baseStyle), 1, 0, 18),
            modules.nasaGIBS && makeTileLayer('nasagibs-globe-tiles', TILES.nasaGIBS(yesterdayStr), 0.9, 0, 9),
            modules.nightLights && makeTileLayer('night-lights-tiles', TILES.nightLights, 0.65, 0, 8),
            modules.tileGroup === 'temperature' && makeTileLayer('temperature-globe-tiles',
                `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${yesterdayStr}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
                0.6, 0, 7),
            modules.tileGroup === 'precipitation' && rainTimestamp && makeTileLayer('precipitation-globe-tiles', TILES.rainViewer(rainTimestamp), 0.75, 0, 12),
            modules.tileGroup === 'clouds' && makeTileLayer('clouds-globe-tiles', TILES.nasaClouds(yesterdayStr), 0.45, 0, 9),
        ].filter(Boolean) as any[];

        if (modules.dayNight) {
            const bands = (twilightBands || []).map((band, idx) => {
                if (!band || !band.rings || band.rings.length === 0) return null;
                return new PolygonLayer({
                    id: `twilight-band-globe-${idx}`,
                    data: band.rings,
                    getPolygon: (d: any) => d,
                    filled: true,
                    stroked: false,
                    getFillColor: band.color,
                    opacity: band.opacity,
                    pickable: false,
                    material: false,
                    parameters: { depthWriteEnabled: false, polygonOffset: [-1, -1 - idx] } as any,
                });
            }).filter(Boolean);
            list.push(...bands);

            if (terminator && terminator.rings && terminator.rings.length > 0) {
                list.push(new PolygonLayer({
                    id: 'terminator-night-globe',
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

        return list;
    }, [baseStyle, modules.nasaGIBS, modules.nightLights, modules.tileGroup, modules.dayNight, rainTimestamp, yesterdayStr, terminator, twilightBands]);

    // Animated layers reconstructed per time-frame
    const animatedLayers = useMemo(() => {
        const list: any[] = [];
        const showCursor = anim.cursorFade > 0.001;

        const cursorRadius = pulseRadius(anim.cursorPhase, CURSOR_PULSE_HZ, CURSOR_PULSE_AMP, CURSOR_PULSE_BASE);

        // Trips rain layer
        if (modules.tileGroup === 'precipitation' && windPaths.length > 0) {
            list.push(new TripsLayer({
                id: 'rain-trips-3d',
                data: windPaths,
                getPath: (d: any) => d.path,
                getTimestamps: (d: any) => d.timestamps.map((t: number) => t + 1.2),
                getColor: [0, 229, 255],
                opacity: 0.7,
                widthMinPixels: Math.max(1.0, ps.width * 0.55),
                trailLength: ps.trailLength * 0.8,
                currentTime: anim.tripTime,
                capRounded: true,
                jointRounded: true,
                shadowEnabled: false,
            }));
        }

        // Trips wind layer
        if (modules.wind && windPaths.length > 0) {
            list.push(new TripsLayer({
                id: 'wind-trips-3d',
                data: windPaths,
                getPath: (d: any) => d.path,
                getTimestamps: (d: any) => d.timestamps,
                getColor: (d: any) => getWindColor(d.speed),
                opacity: 0.85,
                widthMinPixels: ps.width,
                trailLength: ps.trailLength,
                currentTime: anim.tripTime,
                capRounded: true,
                jointRounded: true,
                shadowEnabled: false,
            }));
        }

        // Marine wave point layer
        if (modules.marine && marine) {
            list.push(new ScatterplotLayer({
                id: 'marine-wave-point-3d',
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

        // ISS trail layers removed

        // Selected coordinates cursor layers
        if (showCursor && selectedCoord) {
            list.push(
                new ScatterplotLayer({
                    id: 'selected-coord-pulse-3d',
                    data: [selectedCoord],
                    getPosition: d => [d.lon, d.lat],
                    radiusUnits: 'pixels',
                    getRadius: cursorRadius,
                    getFillColor: [0, 229, 255, Math.round(24 * anim.cursorFade)],
                    stroked: true,
                    getLineColor: [0, 229, 255, Math.round(140 * anim.cursorFade)],
                    lineWidthMinPixels: 1.5,
                }),
                new ScatterplotLayer({
                    id: 'selected-coord-pin-3d',
                    data: [selectedCoord],
                    getPosition: d => [d.lon, d.lat],
                    radiusUnits: 'pixels',
                    getRadius: 7,
                    getFillColor: [0, 229, 255, Math.round(180 * anim.cursorFade)],
                    stroked: true,
                    getLineColor: [255, 255, 255, Math.round(220 * anim.cursorFade)],
                    lineWidthMinPixels: 2,
                })
            );
        }

        return list;
    }, [
        modules.wind, modules.tileGroup, modules.marine,
        marine, windPaths, selectedCoord,
        anim.tripTime, anim.cursorPhase, anim.cursorFade,
        ps.width, ps.trailLength, ps.speedMultiplier
    ]);

    // Map layer stacking in specified z-order hierarchy mapping
    const layers = useMemo(() => {
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

        // Populate layers from combined static and animated arrays
        const combined = [...staticLayers, ...animatedLayers];
        combined.forEach(layer => {
            if (!layer) return;
            const id = layer.id;
            if (id.includes('base-') || id.includes('selected-coord')) return; // Handled separately at bottom/top

            if (id.includes('nasagibs')) orderMap.nasaGIBS.push(layer);
            else if (id.includes('night-lights')) orderMap.nightLights.push(layer);
            else if (id.includes('temperature')) orderMap.temperature.push(layer);
            else if (id.includes('precipitation') || id.includes('rain-trips')) orderMap.precipitation.push(layer);
            else if (id.includes('clouds')) orderMap.clouds.push(layer);
            else if (id.includes('twilight') || id.includes('terminator')) orderMap.dayNight.push(layer);
            else if (id.includes('wind-trips')) orderMap.wind.push(layer);
            else if (id.includes('marine-wave')) orderMap.marine.push(layer);
        });

        const sorted: any[] = [];

        // 1. Base Layer (always rendered at the very bottom)
        const baseLayer = combined.find(l => l && l.id.includes('base-'));
        if (baseLayer) sorted.push(baseLayer);

        // 2. User-sorted overlay layers
        modules.layerOrder.forEach(key => {
            if (orderMap[key]) sorted.push(...orderMap[key]);
        });

        // 3. Selection pin/pulse layers (always rendered at the very top)
        const cursorLayers = combined.filter(l => l && l.id.includes('selected-coord'));
        sorted.push(...cursorLayers);

        return sorted;
    }, [staticLayers, animatedLayers, modules.layerOrder]);

    return (
        <div
            className="absolute inset-0 w-full h-full z-0"
            style={{ background: 'radial-gradient(circle at center, rgba(0, 229, 255, 0.08) 0%, rgba(0, 0, 0, 1) 68%)' }}
        >
            <div className="w-full h-full" aria-label="3D GPU-accelerated Vector Globe">
                <DeckGL
                    views={new GlobeView({
                        id: 'globe',
                        controller: {
                            inertia: 300,
                            scrollZoom: { speed: 0.01, smooth: true },
                            touchRotate: true,
                            dragRotate: true,
                        } as any,
                    })}
                    viewState={viewState}
                    onViewStateChange={onViewStateChange}
                    onClick={(info) => {
                        if (info.coordinate && onGlobeClick) {
                            const [lon, lat] = info.coordinate;
                            onGlobeClick(lat, lon);
                        }
                    }}
                    layers={layers}
                    parameters={{
                        depthTest: true,
                        depthWriteEnabled: true,
                        depthCompare: 'less-equal',
                    } as any}
                />
            </div>

            {/* CSS-based atmospheric halo */}
            <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                    background: [
                        'radial-gradient(circle at 50% 50%, transparent 28%, rgba(0, 180, 255, 0.04) 36%, rgba(0, 120, 255, 0.025) 42%, transparent 52%)',
                        'radial-gradient(circle at 50% 50%, transparent 30%, rgba(0, 229, 255, 0.06) 38%, rgba(0, 180, 220, 0.03) 44%, transparent 56%)',
                    ].join(', '),
                    filter: 'blur(6px)',
                    mixBlendMode: 'screen',
                }}
                aria-hidden="true"
            />

            <div className="pointer-events-none absolute bottom-2 right-2 text-[9px] font-mono text-cyan-700/60">
                {AUTO_SWITCH_GLOBE_MIN_ZOOM.toFixed(1)}× — auto switch
            </div>
        </div>
    );
}
