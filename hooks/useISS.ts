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
    const timer = useRef<ReturnType<typeof setInterval>>();

    const computePrediction = useCallback((data: ISSData) => {
        const pts: { lat: number; lon: number }[] = [];
        const periodSec = ISS_ORBITAL_PERIOD * 60;
        const angularVelocity = 360 / periodSec;
        for (let i = 0; i <= PREDICTION_STEPS; i++) {
            const t = (i / PREDICTION_STEPS) * periodSec;
            const lonOffset = angularVelocity * t;
            const earthRotation = (t / 86400) * 360;
            const lat = data.latitude * Math.cos((2 * Math.PI * t) / periodSec);
            const lon = ((data.longitude + lonOffset - earthRotation + 540) % 360) - 180;
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
