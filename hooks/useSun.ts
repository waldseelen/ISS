'use client';

import type { SunPosition, SunTimes, TerminatorPolygon } from '@/types';
import { useEffect, useState } from 'react';
import SunCalc from 'suncalc';

export function useSun() {
    const [sunPos, setSunPos] = useState<SunPosition>({ azimuth: 0, altitude: 0, declination: 0, rightAscension: 0, lat: 0, lon: 0 });
    const [sunTimes, setSunTimes] = useState<SunTimes | null>(null);
    const [terminator, setTerminator] = useState<TerminatorPolygon>({ ring: [] });

    useEffect(() => {
        const calc = () => {
            const now = new Date();
            const pos = SunCalc.getPosition(now, 0, 0);
            const subSolar = getSubSolarPoint(now);
            setSunPos({ azimuth: pos.azimuth, altitude: pos.altitude, declination: 0, rightAscension: 0, lat: subSolar.lat, lon: subSolar.lon });
            setSunTimes(SunCalc.getTimes(now, 0, 0) as unknown as SunTimes);
            setTerminator(buildTerminatorPolygon(subSolar.lat));
        };
        calc();
        const id = setInterval(calc, 60_000);
        return () => clearInterval(id);
    }, []);

    return { sunPos, sunTimes, terminator };
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

function buildTerminatorPolygon(declinationDeg: number): TerminatorPolygon {
    const dec = declinationDeg * (Math.PI / 180);
    const step = 2;
    const ring: [number, number][] = [];
    for (let lon = -180; lon <= 180; lon += step) {
        const lonRad = lon * (Math.PI / 180);
        const lat = Math.atan(-Math.cos(lonRad) / Math.tan(dec)) * (180 / Math.PI);
        ring.push([lon, lat]);
    }
    if (declinationDeg >= 0) {
        ring.push([180, 90]);
        ring.push([-180, 90]);
    } else {
        ring.push([180, -90]);
        ring.push([-180, -90]);
    }
    ring.push(ring[0]);
    return { ring };
}
