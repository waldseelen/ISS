'use client';

import { fetchISS } from '@/lib/api';
import type { ISSData, ISSTrailPoint } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 5000;
const MAX_TRAIL = 200;
const PREDICTION_STEPS = 120;
const ISS_ORBITAL_PERIOD = 92.65; // minutes

export function useISS(enabled: boolean) {
    const [iss, setIss] = useState<ISSData | null>(null);
    const [trail, setTrail] = useState<ISSTrailPoint[]>([]);
    const [prediction, setPrediction] = useState<{ lat: number; lon: number }[]>([]);
    const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    const computePrediction = useCallback((data: ISSData) => {
        const pts: { lat: number; lon: number }[] = [];
        const periodSec = ISS_ORBITAL_PERIOD * 60;
        const inclination = 51.6 * (Math.PI / 180); // ISS orbital inclination in radians
        const angularVelocity = (2 * Math.PI) / periodSec;
        const earthRotRate = (2 * Math.PI) / 86400;

        // Compute initial orbital phase from current position
        const latRad = data.latitude * (Math.PI / 180);
        const phase0 = Math.asin(Math.sin(latRad) / Math.sin(inclination));

        for (let i = 0; i <= PREDICTION_STEPS; i++) {
            const t = (i / PREDICTION_STEPS) * periodSec;
            const phase = phase0 + angularVelocity * t;

            // Latitude from orbital inclination
            const lat = Math.asin(Math.sin(inclination) * Math.sin(phase)) * (180 / Math.PI);

            // Longitude with ascending node regression and Earth rotation
            const lonShift = Math.atan2(
                Math.cos(inclination) * Math.sin(phase),
                Math.cos(phase)
            ) * (180 / Math.PI);
            const ascNodeShift = Math.atan2(
                Math.cos(inclination) * Math.sin(phase0),
                Math.cos(phase0)
            ) * (180 / Math.PI);
            const lon = ((data.longitude + (lonShift - ascNodeShift) - (earthRotRate * t * 180 / Math.PI)) + 540) % 360 - 180;

            pts.push({ lat, lon });
        }
        return pts;
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const poll = async () => {
            try {
                const data = await fetchISS();
                setIss(data);
                if (data) {
                    setTrail(prev => {
                        const next = [...prev, { lat: data.latitude, lon: data.longitude, alt: data.altitude, time: Date.now() }];
                        return next.length > MAX_TRAIL ? next.slice(-MAX_TRAIL) : next;
                    });
                    setPrediction(computePrediction(data));
                }
            } catch { /* silent */ }
        };
        poll();
        timer.current = setInterval(poll, POLL_MS);
        return () => clearInterval(timer.current);
    }, [enabled, computePrediction]);

    return { iss, trail, prediction };
}
