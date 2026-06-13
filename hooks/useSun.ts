'use client';

import type { SunPosition, SunTimes, TerminatorPolygon } from '@/types';
import { useEffect, useState } from 'react';
import SunCalc from 'suncalc';

/* ═══════════════════════════════════════════════════════════════
   Faz 2 / Madde 5: Terminator Feathering (Twilight Bands)
   Multiple concentric polygons with decreasing opacity simulate
   the atmospheric scattering gradient at the day/night boundary.
   ═══════════════════════════════════════════════════════════════ */

export interface TwilightBand {
    rings: [number, number, number?][][];
    opacity: number;
    color: [number, number, number, number]; // RGBA
}

export function useSun() {
    const [sunPos, setSunPos] = useState<SunPosition>({ azimuth: 0, altitude: 0, declination: 0, rightAscension: 0, lat: 0, lon: 0 });
    const [sunTimes, setSunTimes] = useState<SunTimes | null>(null);
    const [terminator, setTerminator] = useState<TerminatorPolygon>({ rings: [] });
    const [twilightBands, setTwilightBands] = useState<TwilightBand[]>([]);

    useEffect(() => {
        const calc = () => {
            const now = new Date();
            const pos = SunCalc.getPosition(now, 0, 0);
            const subSolar = getSubSolarPoint(now);
            setSunPos({ azimuth: pos.azimuth, altitude: pos.altitude, declination: 0, rightAscension: 0, lat: subSolar.lat, lon: subSolar.lon });
            setSunTimes(SunCalc.getTimes(now, 0, 0) as unknown as SunTimes);
            
            const { terminator: term, twilightBands: bands } = buildSunGrid(subSolar.lat, subSolar.lon);
            setTerminator(term);
            setTwilightBands(bands);
        };
        calc();
        const id = setInterval(calc, 60_000);
        return () => clearInterval(id);
    }, []);

    return { sunPos, sunTimes, terminator, twilightBands };
}

function getSubSolarPoint(date: Date): { lat: number; lon: number } {
    const dayOfYear = getDayOfYear(date);
    const hourUTC = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const declination = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
    const eqTime = equationOfTime(dayOfYear);
    const solarNoonOffset = 12 - eqTime / 60;
    const lon = (solarNoonOffset - hourUTC) * 15;
    return { lat: declination, lon: ((lon + 540) % 360) - 180 };
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

function getSunAltitude(latDeg: number, lonDeg: number, subSolarLatDeg: number, subSolarLonDeg: number): number {
    const lat1 = latDeg * (Math.PI / 180);
    const lon1 = lonDeg * (Math.PI / 180);
    const lat2 = subSolarLatDeg * (Math.PI / 180);
    const lon2 = subSolarLonDeg * (Math.PI / 180);

    const sinAlt = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon1 - lon2);
    return Math.asin(Math.max(-1, Math.min(1, sinAlt))) * (180 / Math.PI);
}

function buildSunGrid(subSolarLat: number, subSolarLon: number): { terminator: TerminatorPolygon; twilightBands: TwilightBand[] } {
    const step = 1.5; // High resolution 1.5 degree grid
    const terminatorRings: [number, number, number][][] = [];
    const civilRings: [number, number, number][][] = [];
    const nauticalRings: [number, number, number][][] = [];
    const astroRings: [number, number, number][][] = [];

    const alt = 8000; // 8 km altitude offset to float above base map and completely resolve Z-fighting

    for (let lat = -90; lat < 90; lat += step) {
        for (let lon = -180; lon < 180; lon += step) {
            const latCenter = lat + step / 2;
            const lonCenter = lon + step / 2;

            const sunAlt = getSunAltitude(latCenter, lonCenter, subSolarLat, subSolarLon);

            const quad: [number, number, number][] = [
                [lon, lat, alt],
                [lon + step, lat, alt],
                [lon + step, lat + step, alt],
                [lon, lat + step, alt],
                [lon, lat, alt]
            ];

            if (sunAlt <= -18) {
                terminatorRings.push(quad);
            } else if (sunAlt > -6 && sunAlt <= 0) {
                civilRings.push(quad);
            } else if (sunAlt > -12 && sunAlt <= -6) {
                nauticalRings.push(quad);
            } else if (sunAlt > -18 && sunAlt <= -12) {
                astroRings.push(quad);
            }
        }
    }

    return {
        terminator: { rings: terminatorRings },
        twilightBands: [
            { rings: civilRings, color: [4, 8, 18, 45] as [number, number, number, number], opacity: 0.3 },
            { rings: nauticalRings, color: [4, 8, 18, 70] as [number, number, number, number], opacity: 0.4 },
            { rings: astroRings, color: [4, 8, 18, 100] as [number, number, number, number], opacity: 0.5 }
        ]
    };
}
