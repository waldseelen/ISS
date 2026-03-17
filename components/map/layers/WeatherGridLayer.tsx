'use client';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

interface Props {
    map: L.Map | null;
    visible: boolean;
    dataType: 'temperature' | 'precipitation' | 'humidity' | 'cloudCover';
}

/**
 * Weather overlay for 2D map using Open-Meteo grid fetching.
 * Renders colored rectangles based on weather data type.
 */
export default function WeatherGridLayer({ map, visible, dataType }: Props) {
    const layerRef = useRef<L.LayerGroup | null>(null);
    const fetchingRef = useRef(false);

    useEffect(() => {
        if (!map) return;

        if (!visible) {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
            return;
        }

        if (fetchingRef.current) return;
        fetchingRef.current = true;

        const group = L.layerGroup();

        // Fetch weather grid for visible bounds
        const fetchGrid = async () => {
            try {
                const bounds = map.getBounds();
                const latMin = Math.max(-85, Math.floor(bounds.getSouth() / 5) * 5);
                const latMax = Math.min(85, Math.ceil(bounds.getNorth() / 5) * 5);
                const lonMin = Math.floor(bounds.getWest() / 5) * 5;
                const lonMax = Math.ceil(bounds.getEast() / 5) * 5;

                const step = 5;
                const promises: Promise<void>[] = [];

                for (let lat = latMin; lat <= latMax; lat += step) {
                    for (let lon = lonMin; lon <= lonMax; lon += step) {
                        const rLat = lat;
                        const rLon = ((lon + 180) % 360) - 180;
                        const paramMap: Record<string, string> = {
                            temperature: 'temperature_2m',
                            precipitation: 'precipitation',
                            humidity: 'relative_humidity_2m',
                            cloudCover: 'cloud_cover',
                        };
                        const param = paramMap[dataType];

                        promises.push(
                            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${rLat}&longitude=${rLon}&current=${param}`)
                                .then(r => r.json())
                                .then(j => {
                                    if (!j.current) return;
                                    const value = j.current[param];
                                    const color = getColor(dataType, value);

                                    L.rectangle(
                                        [[rLat - step / 2, rLon - step / 2], [rLat + step / 2, rLon + step / 2]],
                                        {
                                            color: 'transparent',
                                            fillColor: color,
                                            fillOpacity: 0.3,
                                            interactive: false,
                                        }
                                    ).addTo(group);
                                })
                                .catch(() => { })
                        );
                    }
                }

                await Promise.all(promises);

                if (layerRef.current && map) {
                    map.removeLayer(layerRef.current);
                }
                group.addTo(map);
                layerRef.current = group;
            } finally {
                fetchingRef.current = false;
            }
        };

        fetchGrid();

        return () => {
            if (layerRef.current && map) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
            fetchingRef.current = false;
        };
    }, [map, visible, dataType]);

    return null;
}

function getColor(type: string, value: number): string {
    switch (type) {
        case 'temperature':
            if (value < -20) return '#000080';
            if (value < 0) return '#0000FF';
            if (value < 10) return '#00CCFF';
            if (value < 20) return '#00FF00';
            if (value < 30) return '#FFFF00';
            if (value < 40) return '#FF8800';
            return '#FF0000';
        case 'precipitation':
            if (value < 0.5) return 'transparent';
            if (value < 2) return '#ADD8E6';
            if (value < 5) return '#4169E1';
            if (value < 10) return '#FF6347';
            return '#8B0000';
        case 'humidity':
            if (value < 20) return '#FFD700';
            if (value < 40) return '#FFA500';
            if (value < 60) return '#90EE90';
            if (value < 80) return '#4682B4';
            return '#00008B';
        case 'cloudCover':
            if (value < 20) return 'transparent';
            if (value < 40) return '#D3D3D3';
            if (value < 60) return '#A9A9A9';
            if (value < 80) return '#808080';
            return '#505050';
        default:
            return 'transparent';
    }
}
