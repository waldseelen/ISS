'use client';

import L from 'leaflet';
import { useEffect, useRef } from 'react';

interface CityFeature {
    name: string;
    population: number;
    brightness: number;
    lat: number;
    lon: number;
}

interface Props {
    map: L.Map | null;
    visible: boolean;
}

/**
 * City lights as circle markers on 2D map.
 * Brightness and size scale with population.
 */
export default function CityLightsCluster({ map, visible }: Props) {
    const layerRef = useRef<L.LayerGroup | null>(null);
    const citiesRef = useRef<CityFeature[]>([]);
    const loadedRef = useRef(false);

    // Load city data once
    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;

        fetch('/data/major_cities.geojson')
            .then(r => r.json())
            .then(geo => {
                citiesRef.current = (geo.features || []).map((f: { properties: { name: string; population: number; brightness: number }; geometry: { coordinates: number[] } }) => ({
                    name: f.properties.name,
                    population: f.properties.population,
                    brightness: f.properties.brightness,
                    lon: f.geometry.coordinates[0],
                    lat: f.geometry.coordinates[1],
                }));
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!map) return;

        if (!visible) {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
            return;
        }

        // Wait a bit for data to load
        const timer = setTimeout(() => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
            }

            const group = L.layerGroup();

            citiesRef.current.forEach(city => {
                const radius = Math.max(3, Math.log10(city.population) * 2);
                const opacity = 0.4 + city.brightness * 0.5;
                L.circleMarker([city.lat, city.lon], {
                    radius,
                    color: '#ffee88',
                    fillColor: '#ffdd55',
                    fillOpacity: opacity,
                    weight: 1,
                    opacity: 0.6,
                }).bindTooltip(city.name, {
                    permanent: false,
                    direction: 'top',
                    className: 'city-tooltip',
                }).addTo(group);
            });

            group.addTo(map);
            layerRef.current = group;
        }, 500);

        return () => {
            clearTimeout(timer);
            if (layerRef.current && map) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [map, visible]);

    return null;
}
