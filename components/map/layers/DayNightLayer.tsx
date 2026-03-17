'use client';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

interface Props {
    map: L.Map | null;
    visible: boolean;
}

/**
 * Day/Night overlay for 2D map.
 * Draws a semi-transparent dark polygon over the night hemisphere.
 * Computed from the current sun position (sub-solar point).
 */
export default function DayNightLayer({ map, visible }: Props) {
    const layerRef = useRef<L.Polygon | null>(null);

    useEffect(() => {
        if (!map) return;

        if (!visible) {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
            return;
        }

        const update = () => {
            const nightCoords = computeNightPolygon();

            if (layerRef.current) {
                layerRef.current.setLatLngs(nightCoords);
            } else {
                layerRef.current = L.polygon(nightCoords, {
                    color: 'transparent',
                    fillColor: '#000022',
                    fillOpacity: 0.45,
                    interactive: false,
                }).addTo(map);
            }
        };

        update();
        const interval = setInterval(update, 60000); // Update every minute

        return () => {
            clearInterval(interval);
            if (layerRef.current && map) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [map, visible]);

    return null;
}

function computeNightPolygon(): L.LatLngExpression[] {
    const now = new Date();
    const dayOfYear = getDayOfYear(now);
    const hourUTC = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

    // Sun declination
    const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
    const decRad = declination * (Math.PI / 180);

    // Sub-solar longitude
    const eqTime = equationOfTime(dayOfYear);
    const solarNoonOffset = 12 - eqTime / 60;
    const subSolarLon = (solarNoonOffset - hourUTC) * 15;
    const normLon = ((subSolarLon + 540) % 360) - 180;

    // Compute terminator line points
    const points: L.LatLngExpression[] = [];
    for (let lon = -180; lon <= 180; lon += 2) {
        const lonRad = (lon - normLon) * (Math.PI / 180);
        const lat = Math.atan(-Math.cos(lonRad) / Math.tan(decRad)) * (180 / Math.PI);
        points.push([lat, lon]);
    }

    // Build night polygon: terminator + poles
    // Determine which pole is in darkness
    const nightPole = declination > 0 ? -90 : 90;

    const polygon: L.LatLngExpression[] = [];

    // Right edge to night pole
    polygon.push([nightPole, 180]);
    polygon.push([nightPole, -180]);

    // Terminator line (from left to right)
    for (const pt of points) {
        polygon.push(pt);
    }

    // Close back to night pole
    polygon.push([nightPole, 180]);

    return polygon;
}

function getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function equationOfTime(dayOfYear: number): number {
    const b = ((360 / 365) * (dayOfYear - 81)) * (Math.PI / 180);
    return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}
