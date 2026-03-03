'use client';

import { TILES } from '@/lib/tiles';
import type { ISSData, ModuleState } from '@/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';

interface Props {
    modules: ModuleState;
    iss: ISSData | null;
    trail: { lat: number; lon: number }[];
    flyTarget: { lat: number; lon: number } | null;
    onZoomChange?: (zoom: number) => void;
}

const ISS_ICON = L.divIcon({
    className: 'iss-marker',
    html: '<div style="width:18px;height:18px;background:#00e5ff;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #00e5ff"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

export default function MapCanvas({ modules, iss, trail, flyTarget, onZoomChange }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const baseTileRef = useRef<L.TileLayer | null>(null);
    const issMarkerRef = useRef<L.Marker | null>(null);
    const trailLineRef = useRef<L.Polyline | null>(null);
    const precipLayerRef = useRef<L.TileLayer | null>(null);
    const tempLayerRef = useRef<L.TileLayer | null>(null);
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

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /* Weather tile overlays */
    useEffect(() => {
        if (!mapRef.current || !ready) return;

        // Precipitation layer (OpenWeatherMap free tiles)
        if (modules.precipitation && !precipLayerRef.current) {
            precipLayerRef.current = L.tileLayer(
                'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2',
                { opacity: 0.6, maxZoom: 18 }
            ).addTo(mapRef.current);
        } else if (!modules.precipitation && precipLayerRef.current) {
            mapRef.current.removeLayer(precipLayerRef.current);
            precipLayerRef.current = null;
        }

        // Temperature layer
        if (modules.temperature && !tempLayerRef.current) {
            tempLayerRef.current = L.tileLayer(
                'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2',
                { opacity: 0.5, maxZoom: 18 }
            ).addTo(mapRef.current);
        } else if (!modules.temperature && tempLayerRef.current) {
            mapRef.current.removeLayer(tempLayerRef.current);
            tempLayerRef.current = null;
        }
    }, [modules.precipitation, modules.temperature, ready]);

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
                    opacity: 0.5,
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
        <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full z-0"
            aria-label="2D Map view"
        />
    );
}
