'use client';

import { fetchISS } from '@/lib/api';
import { fetchTLE, generateSGP4Prediction, parseTLE, type TLEData } from '@/lib/sgp4';
import type { ISSData, ISSTrailPoint } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 10000;
const MAX_TRAIL = 200;
const TLE_REFRESH_MS = 3600000; // Re-fetch TLE every 1 hour

/* Critique #20: Dynamically calculate orbital period using Kepler's Third Law */
function calculateOrbitalPeriod(altitude: number): number {
    const EARTH_RADIUS_KM = 6371;
    const GM = 398600.4418; // km^3 / s^2
    const r = EARTH_RADIUS_KM + altitude;
    const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / GM);
    return periodSeconds / 60; // minutes
}

export function useISS(enabled: boolean) {
    const [iss, setIss] = useState<ISSData | null>(null);
    const [smoothIss, setSmoothIss] = useState<ISSData | null>(null);
    const [trail, setTrail] = useState<ISSTrailPoint[]>([]);
    const [prediction, setPrediction] = useState<{ lat: number; lon: number }[]>([]);
    const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    const lastPosRef = useRef<{ lat: number; lon: number; alt: number; vel: number } | null>(null);
    const targetPosRef = useRef<{ lat: number; lon: number; alt: number; vel: number } | null>(null);
    const lastUpdateTimeRef = useRef<number>(Date.now());
    const lastReportedRef = useRef<{ lat: number; lon: number } | null>(null);

    // SGP4 TLE state (Faz 1 / Madde 2)
    const tleRef = useRef<TLEData | null>(null);
    const tleTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const lastTleFetch = useRef<number>(0);

    // SGP4-based prediction generator
    const computeSGP4Prediction = useCallback((data: ISSData) => {
        const tle = tleRef.current;
        if (tle) {
            // Use real SGP4 orbit mechanics
            const results = generateSGP4Prediction(tle, new Date(), 92.68 * 1.5, 180);
            if (results.length > 10) {
                return results.map(r => ({ lat: r.latitude, lon: r.longitude }));
            }
        }
        // Fallback: analytical Keplerian prediction (existing method)
        return computeKeplerianPrediction(data);
    }, []);

    const computeKeplerianPrediction = useCallback((data: ISSData) => {
        const orbitalPeriod = calculateOrbitalPeriod(data.altitude);
        const PREDICTION_STEPS = 120;
        const pts: { lat: number; lon: number }[] = [];
        const periodSec = orbitalPeriod * 60;
        const inclination = 51.6 * (Math.PI / 180);
        const angularVelocity = (2 * Math.PI) / periodSec;
        const earthRotRate = (2 * Math.PI) / 86400;

        const latRad = data.latitude * (Math.PI / 180);
        const phase0 = Math.asin(Math.sin(latRad) / Math.sin(inclination));

        for (let i = 0; i <= PREDICTION_STEPS; i++) {
            const t = (i / PREDICTION_STEPS) * periodSec;
            const phase = phase0 + angularVelocity * t;

            const lat = Math.asin(Math.sin(inclination) * Math.sin(phase)) * (180 / Math.PI);

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

    // Fetch TLE from CelesTrak (Faz 1 / Madde 2)
    useEffect(() => {
        if (!enabled) return;

        const loadTLE = async () => {
            if (Date.now() - lastTleFetch.current < TLE_REFRESH_MS && tleRef.current) return;
            const tle = await fetchTLE();
            if (tle) {
                tleRef.current = tle;
                lastTleFetch.current = Date.now();
                if (typeof window !== 'undefined') {
                    localStorage.setItem('earth_tracker_tle', JSON.stringify({
                        line1: tle.line1,
                        line2: tle.line2,
                        fetchedAt: Date.now(),
                    }));
                }
            }
        };

        // Try loading cached TLE first
        if (typeof window !== 'undefined' && !tleRef.current) {
            try {
                const cached = localStorage.getItem('earth_tracker_tle');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.fetchedAt < TLE_REFRESH_MS * 24) {
                        tleRef.current = parseTLE(parsed.line1, parsed.line2);
                        lastTleFetch.current = parsed.fetchedAt;
                    }
                }
            } catch { /* silent */ }
        }

        loadTLE();
        tleTimerRef.current = setInterval(loadTLE, TLE_REFRESH_MS);
        return () => clearInterval(tleTimerRef.current);
    }, [enabled]);

    // Frame-by-frame interpolation loop — thresholded to prevent 60fps state churn
    useEffect(() => {
        if (!iss) return;
        if (!targetPosRef.current) {
            lastPosRef.current = { lat: iss.latitude, lon: iss.longitude, alt: iss.altitude, vel: iss.velocity };
            targetPosRef.current = { lat: iss.latitude, lon: iss.longitude, alt: iss.altitude, vel: iss.velocity };
        } else {
            lastPosRef.current = { ...targetPosRef.current };
            targetPosRef.current = { lat: iss.latitude, lon: iss.longitude, alt: iss.altitude, vel: iss.velocity };
        }
        lastUpdateTimeRef.current = Date.now();
    }, [iss]);

    useEffect(() => {
        if (!enabled) return;

        let frameId: number;
        const tick = () => {
            if (lastPosRef.current && targetPosRef.current && iss) {
                const elapsed = Date.now() - lastUpdateTimeRef.current;
                const t = Math.min(elapsed / POLL_MS, 1.0);

                const lat = lastPosRef.current.lat + (targetPosRef.current.lat - lastPosRef.current.lat) * t;
                let diffLon = targetPosRef.current.lon - lastPosRef.current.lon;
                if (diffLon > 180) diffLon -= 360;
                if (diffLon < -180) diffLon += 360;
                const lon = ((lastPosRef.current.lon + diffLon * t + 540) % 360) - 180;
                const alt = lastPosRef.current.alt + (targetPosRef.current.alt - lastPosRef.current.alt) * t;
                const vel = lastPosRef.current.vel + (targetPosRef.current.vel - lastPosRef.current.vel) * t;

                const last = lastReportedRef.current;
                if (!last || Math.abs(lat - last.lat) > 0.01 || Math.abs(lon - last.lon) > 0.01) {
                    lastReportedRef.current = { lat, lon };
                    setSmoothIss({ ...iss, latitude: lat, longitude: lon, altitude: alt, velocity: vel });
                }
            }
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [enabled, iss]);

    // Load from offline localStorage cache (Critique #17)
    const loadFromCache = useCallback(() => {
        if (typeof window === 'undefined') return;
        try {
            const cachedData = localStorage.getItem('earth_tracker_iss_cache');
            const cachedTrail = localStorage.getItem('earth_tracker_iss_trail');
            const cachedPred = localStorage.getItem('earth_tracker_iss_pred');
            
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                setIss(parsed);
                
                if (cachedTrail) {
                    setTrail(JSON.parse(cachedTrail));
                }
                if (cachedPred) {
                    setPrediction(JSON.parse(cachedPred));
                } else {
                    setPrediction(computeSGP4Prediction(parsed));
                }
            }
        } catch { /* silent */ }
    }, [computeSGP4Prediction]);

    useEffect(() => {
        if (enabled) {
            loadFromCache();
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;

        const poll = async () => {
            try {
                const data = await fetchISS();
                if (data) {
                    setIss(data);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('earth_tracker_iss_cache', JSON.stringify(data));
                    }
                    
                    setTrail(prev => {
                        const next = [...prev, { lat: data.latitude, lon: data.longitude, alt: data.altitude, time: Date.now() }];
                        const sliced = next.length > MAX_TRAIL ? next.slice(-MAX_TRAIL) : next;
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('earth_tracker_iss_trail', JSON.stringify(sliced));
                        }
                        return sliced;
                    });

                    const pred = computeSGP4Prediction(data);
                    setPrediction(pred);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('earth_tracker_iss_pred', JSON.stringify(pred));
                    }
                } else {
                    loadFromCache();
                }
            } catch {
                loadFromCache();
            }
        };
        poll();
        timer.current = setInterval(poll, POLL_MS);
        return () => clearInterval(timer.current);
    }, [enabled]);

    return { iss: smoothIss || iss, rawIss: iss, trail, prediction, tle: tleRef.current };
}

export function splitTrailByAntimeridian(
    trail: { lat: number; lon: number }[]
): { path: [number, number][] }[] {
    if (trail.length < 2) return trail.length ? [{ path: trail.map(p => [p.lon, p.lat] as [number, number]) }] : [];
    const segments: { path: [number, number][] }[] = [];
    let current: [number, number][] = [[trail[0].lon, trail[0].lat]];
    for (let i = 1; i < trail.length; i++) {
        const prev = trail[i - 1];
        const cur = trail[i];
        const dLon = Math.abs(cur.lon - prev.lon);
        const dLat = Math.abs(cur.lat - prev.lat);
        if (dLon > 180 || Math.sqrt(dLon * dLon + dLat * dLat) > 25) {
            if (current.length > 1) segments.push({ path: current });
            current = [[cur.lon, cur.lat]];
        } else {
            current.push([cur.lon, cur.lat]);
        }
    }
    if (current.length > 1) segments.push({ path: current });
    return segments;
}
