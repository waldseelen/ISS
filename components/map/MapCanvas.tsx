'use client';

import { TILES, getRainViewerTimestamp } from '@/lib/tiles';
import type { ISSData, ModuleState, WindPoint } from '@/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import CityLightsCluster from './layers/CityLightsCluster';
import DayNightLayer from './layers/DayNightLayer';
import WeatherGridLayer from './layers/WeatherGridLayer';
import WindLayer from './layers/WindLayer';

interface Props {
    modules: ModuleState;
    iss: ISSData | null;
    trail: { lat: number; lon: number }[];
    flyTarget: { lat: number; lon: number } | null;
    wind?: WindPoint[];
    onZoomChange?: (zoom: number) => void;
    onMapClick?: (lat: number, lon: number) => void;
}

const ISS_ICON = L.divIcon({
    className: 'iss-marker',
    html: `<div style="width:22px;height:22px;background:radial-gradient(circle,#00e5ff 40%,transparent 70%);border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #00e5ff,0 0 24px rgba(0,229,255,0.4);animation:pulse-marker 2s ease-in-out infinite"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
});

export default function MapCanvas({ modules, iss, trail, flyTarget, wind = [], onZoomChange, onMapClick }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const baseTileRef = useRef<L.TileLayer | null>(null);
    const issMarkerRef = useRef<L.Marker | null>(null);
    const trailLineRef = useRef<L.Polyline | null>(null);
    const precipLayerRef = useRef<L.TileLayer | null>(null);
    const tempLayerRef = useRef<L.TileLayer | null>(null);
    const nightLayerRef = useRef<L.TileLayer | null>(null);
    const cloudsLayerRef = useRef<L.TileLayer | null>(null);
    const nasaGIBSLayerRef = useRef<L.TileLayer | null>(null);
    const clickMarkerRef = useRef<L.CircleMarker | null>(null);
    const [ready, setReady] = useState(false);

    /* Init map */
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const map = L.map(containerRef.current, {
            center: [20, 0],
            zoom: 3,
            minZoom: 2,
            maxZoom: 18,
            zoomControl: false,
            attributionControl: false,
            worldCopyJump: true,
        });

        const base = L.tileLayer(TILES.esriSatellite, {
            maxZoom: 18,
        }).addTo(map);

        mapRef.current = map;
        baseTileRef.current = base;
        setReady(true);

        // Zoom change listener
        map.on('zoomend', () => {
            onZoomChange?.(map.getZoom());
        });

        // Map click → weather data
        map.on('click', (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            onMapClick?.(lat, lng);

            // Click marker visual feedback
            if (clickMarkerRef.current) {
                map.removeLayer(clickMarkerRef.current);
            }
            clickMarkerRef.current = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#00e5ff',
                fillColor: '#00e5ff',
                fillOpacity: 0.3,
                weight: 2,
            }).addTo(map);
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* Base layer switching */
    useEffect(() => {
        if (!mapRef.current || !ready) return;
        const map = mapRef.current;

        if (baseTileRef.current) {
            map.removeLayer(baseTileRef.current);
        }

        let tileUrl = TILES.esriSatellite;
        if (modules.street) tileUrl = TILES.osm;
        else if (modules.topo) tileUrl = TILES.openTopo;

        baseTileRef.current = L.tileLayer(tileUrl, { maxZoom: 18 }).addTo(map);
    }, [modules.satellite, modules.street, modules.topo, ready]);

    /* NASA GIBS overlay */
    useEffect(() => {
        if (!mapRef.current || !ready) return;
        if (modules.nasaGIBS && !nasaGIBSLayerRef.current) {
            nasaGIBSLayerRef.current = L.tileLayer(TILES.nasaGIBS(), {
                opacity: 0.7,
                maxZoom: 9,
            }).addTo(mapRef.current);
        } else if (!modules.nasaGIBS && nasaGIBSLayerRef.current) {
            mapRef.current.removeLayer(nasaGIBSLayerRef.current);
            nasaGIBSLayerRef.current = null;
        }
    }, [modules.nasaGIBS, ready]);

    /* Night lights overlay */
    useEffect(() => {
        if (!mapRef.current || !ready) return;
        if (modules.nightLights && !nightLayerRef.current) {
            nightLayerRef.current = L.tileLayer(TILES.nightLights, {
                opacity: 0.7,
                maxZoom: 8,
            }).addTo(mapRef.current);
        } else if (!modules.nightLights && nightLayerRef.current) {
            mapRef.current.removeLayer(nightLayerRef.current);
            nightLayerRef.current = null;
        }
    }, [modules.nightLights, ready]);

    /* Clouds overlay (NASA GIBS) */
    useEffect(() => {
        if (!mapRef.current || !ready) return;
        if (modules.clouds && !cloudsLayerRef.current) {
            cloudsLayerRef.current = L.tileLayer(TILES.nasaClouds(), {
                opacity: 0.5,
                maxZoom: 9,
            }).addTo(mapRef.current);
        } else if (!modules.clouds && cloudsLayerRef.current) {
            mapRef.current.removeLayer(cloudsLayerRef.current);
            cloudsLayerRef.current = null;
        }
    }, [modules.clouds, ready]);

    /* Precipitation overlay (RainViewer — free, no key) */
    useEffect(() => {
        if (!mapRef.current || !ready) return;

        if (modules.precipitation && !precipLayerRef.current) {
            getRainViewerTimestamp().then(ts => {
                if (!ts || !mapRef.current || !modules.precipitation) return;
                precipLayerRef.current = L.tileLayer(TILES.rainViewer(ts), {
                    opacity: 0.6,
                    maxZoom: 12,
                }).addTo(mapRef.current!);
            });
        } else if (!modules.precipitation && precipLayerRef.current) {
            mapRef.current.removeLayer(precipLayerRef.current);
            precipLayerRef.current = null;
        }
    }, [modules.precipitation, ready]);

    /* Temperature overlay (NASA GIBS Land Surface Temp) */
    useEffect(() => {
        if (!mapRef.current || !ready) return;

        if (modules.temperature && !tempLayerRef.current) {
            tempLayerRef.current = L.tileLayer(
                `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
                { opacity: 0.6, maxZoom: 7 }
            ).addTo(mapRef.current);
        } else if (!modules.temperature && tempLayerRef.current) {
            mapRef.current.removeLayer(tempLayerRef.current);
            tempLayerRef.current = null;
        }
    }, [modules.temperature, ready]);

    /* ISS */
    useEffect(() => {
        if (!mapRef.current || !iss || !ready) return;

        if (modules.iss) {
            if (!issMarkerRef.current) {
                issMarkerRef.current = L.marker([iss.latitude, iss.longitude], { icon: ISS_ICON }).addTo(mapRef.current);
            } else {
                issMarkerRef.current.setLatLng([iss.latitude, iss.longitude]);
            }
        } else if (issMarkerRef.current) {
            mapRef.current.removeLayer(issMarkerRef.current);
            issMarkerRef.current = null;
        }
    }, [iss, modules.iss, ready]);

    /* Trail */
    useEffect(() => {
        if (!mapRef.current || !ready) return;

        if (modules.iss && trail.length > 1) {
            const latlngs = trail.map(p => [p.lat, p.lon] as [number, number]);
            if (trailLineRef.current) {
                trailLineRef.current.setLatLngs(latlngs);
            } else {
                trailLineRef.current = L.polyline(latlngs, {
                    color: '#00e5ff',
                    weight: 2,
                    opacity: 0.6,
                    dashArray: '8 4',
                }).addTo(mapRef.current);
            }
        } else if (trailLineRef.current) {
            mapRef.current.removeLayer(trailLineRef.current);
            trailLineRef.current = null;
        }
    }, [trail, modules.iss, ready]);

    /* Fly to target */
    useEffect(() => {
        if (!mapRef.current || !flyTarget || !ready) return;
        mapRef.current.flyTo([flyTarget.lat, flyTarget.lon], 8, { duration: 1.5 });
    }, [flyTarget, ready]);

    return (
        <>
            <div
                ref={containerRef}
                className="absolute inset-0 w-full h-full z-0"
                aria-label="2D Map view"
            />
            {ready && (
                <>
                    <WindLayer map={mapRef.current} wind={wind} visible={modules.wind} />
                    <CityLightsCluster map={mapRef.current} visible={modules.nightLights} />
                    <DayNightLayer map={mapRef.current} visible={modules.dayNight} />
                    <WeatherGridLayer map={mapRef.current} visible={modules.weather} dataType="temperature" />
                </>
            )}
        </>
    );
}
