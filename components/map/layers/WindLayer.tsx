'use client';

import type { WindPoint } from '@/types';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

interface Props {
    map: L.Map | null;
    wind: WindPoint[];
    visible: boolean;
}

/**
 * Wind arrows overlay for 2D map.
 * Renders colored arrows at wind data points, direction and speed encoded.
 */
export default function WindLayer({ map, wind, visible }: Props) {
    const layerRef = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        if (!map) return;

        if (!visible) {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
            return;
        }

        if (layerRef.current) {
            map.removeLayer(layerRef.current);
        }

        const group = L.layerGroup();

        wind.forEach(w => {
            const color = windSpeedColor(w.speed);
            const arrowSvg = createArrowSvg(w.direction, color);
            const icon = L.divIcon({
                className: 'wind-arrow',
                html: arrowSvg,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            });
            L.marker([w.lat, w.lon], { icon, interactive: false }).addTo(group);
        });

        group.addTo(map);
        layerRef.current = group;

        return () => {
            if (layerRef.current && map) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [map, wind, visible]);

    return null;
}

function windSpeedColor(speed: number): string {
    if (speed < 10) return '#60a5fa'; // blue
    if (speed < 20) return '#34d399'; // green
    if (speed < 40) return '#fbbf24'; // yellow
    if (speed < 60) return '#f97316'; // orange
    return '#ef4444'; // red
}

function createArrowSvg(direction: number, color: string): string {
    return `<svg width="24" height="24" viewBox="0 0 24 24" style="transform:rotate(${direction}deg)">
        <path d="M12 2L8 14h8L12 2z" fill="${color}" opacity="0.8"/>
        <line x1="12" y1="14" x2="12" y2="22" stroke="${color}" stroke-width="2" opacity="0.5"/>
    </svg>`;
}
