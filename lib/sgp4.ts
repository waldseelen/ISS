/* ═══════════════════════════════════════════════════════════════
   Faz 1 / Madde 2: SGP4 Simplified Perturbations Model
   Browser-native ISS orbit propagation from TLE data
   ═══════════════════════════════════════════════════════════════ */

import type { ISSPass } from '@/types';
import { fetchWithRetry } from './fetchWithRetry';

/**
 * Minimal SGP4 implementation for ISS orbit prediction.
 * Ported from the NORAD SPacetrack Report No. 3 algorithm.
 * Handles near-Earth orbits (period < 225 min) which covers ISS.
 */

// ── Constants ──
const DEG2RAD = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const MINUTES_PER_DAY = 1440;
const MU = 398600.4418;        // km^3/s^2
const EARTH_RADIUS = 6378.137; // km (WGS-84 equatorial)
const J2 = 0.00108263;
const J3 = -0.00000254;
const J4 = -0.00000161;
const KE = 0.0743669161;       // sqrt(GM) in earth-radii^1.5/min
const XJ3 = J3;
const CK2 = 0.5 * J2;
const CK4 = -0.375 * J4;
const QOMS2T = 1.88027916e-9;
const S_DENSITY = 1.01222928;
const AE = 1.0;
const XKMPER = EARTH_RADIUS;

export interface TLEData {
    line1: string;
    line2: string;
    epoch: Date;
    inclination: number;     // degrees
    raan: number;            // degrees  (Right Ascension of Ascending Node)
    eccentricity: number;
    argPerigee: number;      // degrees
    meanAnomaly: number;     // degrees
    meanMotion: number;      // rev/day
    bstar: number;           // drag term
    epochYear: number;
    epochDay: number;
}

export interface SGP4Result {
    latitude: number;
    longitude: number;
    altitude: number;        // km
    velocity: number;        // km/h
}

/** Parse two TLE lines into structured data */
export function parseTLE(line1: string, line2: string): TLEData {
    // Line 1 fields
    const epochYr = parseInt(line1.substring(18, 20));
    const epochDay = parseFloat(line1.substring(20, 32));
    const bstarStr = line1.substring(53, 61).trim();

    // Parse BSTAR (scientific notation in TLE format)
    let bstar = 0;
    if (bstarStr.length > 0) {
        const mantissa = parseFloat(`${bstarStr[0]}.${bstarStr.substring(1, 6)}`);
        const exponent = parseInt(bstarStr.substring(6));
        bstar = mantissa * Math.pow(10, exponent);
    }

    const fullYear = epochYr < 57 ? 2000 + epochYr : 1900 + epochYr;

    // Compute epoch Date
    const epochDate = new Date(Date.UTC(fullYear, 0, 1));
    epochDate.setTime(epochDate.getTime() + (epochDay - 1) * 86400000);

    // Line 2 fields
    const inclination = parseFloat(line2.substring(8, 16).trim());
    const raan = parseFloat(line2.substring(17, 25).trim());
    const eccentricity = parseFloat(`0.${line2.substring(26, 33).trim()}`);
    const argPerigee = parseFloat(line2.substring(34, 42).trim());
    const meanAnomaly = parseFloat(line2.substring(43, 51).trim());
    const meanMotion = parseFloat(line2.substring(52, 63).trim());

    return {
        line1, line2,
        epoch: epochDate,
        inclination, raan, eccentricity,
        argPerigee, meanAnomaly, meanMotion,
        bstar,
        epochYear: fullYear,
        epochDay,
    };
}

/**
 * Propagates a TLE forward by `minutesSinceEpoch` minutes using
 * a simplified SGP4 model. Returns ECI position, then converts
 * to geodetic lat/lon/alt.
 */
export function propagate(tle: TLEData, minutesSinceEpoch: number): SGP4Result {
    const n0 = tle.meanMotion * TWO_PI / MINUTES_PER_DAY; // rad/min
    const i0 = tle.inclination * DEG2RAD;
    const e0 = tle.eccentricity;
    const w0 = tle.argPerigee * DEG2RAD;
    const M0 = tle.meanAnomaly * DEG2RAD;
    const omega0 = tle.raan * DEG2RAD;

    const a1 = Math.pow(KE / n0, 2 / 3);
    const cosI = Math.cos(i0);
    const sinI = Math.sin(i0);
    const theta2 = cosI * cosI;
    const x3thm1 = 3 * theta2 - 1;
    const eosq = e0 * e0;
    const betao2 = 1 - eosq;
    const betao = Math.sqrt(betao2);

    const del1 = 1.5 * CK2 * x3thm1 / (a1 * a1 * betao * betao2);
    const ao = a1 * (1 - del1 * (0.5 * (2 / 3) + del1 * (1 + 134 / 81 * del1)));
    const delo = 1.5 * CK2 * x3thm1 / (ao * ao * betao * betao2);
    const xnodp = n0 / (1 + delo);
    const aodp = ao / (1 - delo);

    // Secular effects of atmospheric drag and gravitation
    const s4 = S_DENSITY;
    const perigee = (aodp * (1 - e0) - AE) * XKMPER;
    const qoms24 = QOMS2T;

    const tsi = 1 / (aodp - s4);
    const eta = aodp * e0 * tsi;
    const etasq = eta * eta;
    const eeta = e0 * eta;

    const psisq = Math.abs(1 - etasq);
    const coef = qoms24 * Math.pow(tsi, 4);
    const coef1 = coef / Math.pow(psisq, 3.5);

    const c2 = coef1 * xnodp * (aodp * (1 + 1.5 * etasq + eeta * (4 + etasq)));
    const c1 = tle.bstar * c2;

    const x1mth2 = 1 - theta2;
    const c4 = 2 * xnodp * coef1 * aodp * betao2 * (
        eta * (2 + 0.5 * etasq) + e0 * (0.5 + 2 * etasq)
    );

    const xmdot = xnodp + 0.5 * CK2 * betao * x3thm1 / (aodp * betao2) * xnodp;
    const x1m5th = 1 - 5 * theta2;
    const omgdot = -0.5 * CK2 * x1m5th / (aodp * betao2) * xnodp;
    const xnodot = -CK2 * cosI / (aodp * betao2) * xnodp;

    const t = minutesSinceEpoch;

    // Mean anomaly, argument of perigee, RAAN at time t
    const xm = M0 + xmdot * t;
    const omega = w0 + omgdot * t;
    const xnode = omega0 + xnodot * t;

    // Secular drag
    const a = aodp * Math.pow(1 - c1 * t, 2);
    const e = e0 - tle.bstar * c4 * t;
    const xl = xm + omega + xnode + xnodp * (1.5 * c1 * t * t);

    // Solve Kepler's equation (Newton-Raphson)
    let u = (xl - xnode) % TWO_PI;
    let eo1 = u;
    for (let iter = 0; iter < 10; iter++) {
        const sinE = Math.sin(eo1);
        const cosE = Math.cos(eo1);
        const dE = (u - eo1 + e * sinE) / (1 - e * cosE);
        eo1 += dE;
        if (Math.abs(dE) < 1e-12) break;
    }

    const sinE = Math.sin(eo1);
    const cosE = Math.cos(eo1);

    // True anomaly
    const sinV = Math.sqrt(1 - e * e) * sinE / (1 - e * cosE);
    const cosV = (cosE - e) / (1 - e * cosE);
    const trueAnomaly = Math.atan2(sinV, cosV);

    // Radius
    const r = a * (1 - e * cosE);

    // Position in orbital plane
    const u_arg = omega + trueAnomaly;
    const sinU = Math.sin(u_arg);
    const cosU = Math.cos(u_arg);
    const sinNode = Math.sin(xnode);
    const cosNode = Math.cos(xnode);

    // ECI coordinates
    const x = r * (cosU * cosNode - sinU * sinNode * cosI);
    const y = r * (cosU * sinNode + sinU * cosNode * cosI);
    const z = r * sinU * sinI;

    // Velocity (approximate from vis-viva)
    const vKmPerMin = Math.sqrt(MU * (2 / (r * XKMPER) - 1 / (a * XKMPER)));
    const vKmPerH = vKmPerMin * 60;

    // Convert ECI → Geodetic
    const alt = (r - AE) * XKMPER;

    // Greenwich Sidereal Time
    const epochMs = tle.epoch.getTime();
    const nowMs = epochMs + t * 60000;
    const gmst = greenwichSiderealTime(new Date(nowMs));

    const longitude = ((Math.atan2(y, x) - gmst) * 180 / Math.PI + 540) % 360 - 180;
    const latitude = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;

    return {
        latitude,
        longitude,
        altitude: Math.max(0, alt),
        velocity: vKmPerH,
    };
}

/** Greenwich Mean Sidereal Time in radians */
function greenwichSiderealTime(date: Date): number {
    const jd = julianDate(date);
    const t = (jd - 2451545.0) / 36525.0;
    let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * t * t
        - t * t * t / 38710000;
    gmst = ((gmst % 360) + 360) % 360;
    return gmst * DEG2RAD;
}

function julianDate(date: Date): number {
    return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Generate a full orbit prediction (lat/lon points) from TLE data
 * for `durationMinutes` into the future, with `steps` resolution.
 */
export function generateSGP4Prediction(
    tle: TLEData,
    now: Date,
    durationMinutes: number = 92.68 * 1.5,  // ~1.5 orbits
    steps: number = 180,
): SGP4Result[] {
    const epochMs = tle.epoch.getTime();
    const nowMinutes = (now.getTime() - epochMs) / 60000;
    const results: SGP4Result[] = [];

    for (let i = 0; i <= steps; i++) {
        const tMin = nowMinutes + (i / steps) * durationMinutes;
        try {
            const pos = propagate(tle, tMin);
            if (Number.isFinite(pos.latitude) && Number.isFinite(pos.longitude)) {
                results.push(pos);
            }
        } catch {
            // Skip diverged points
        }
    }

    return results;
}

/** Fetch latest TLE from CelesTrak (NORAD ID 25544 = ISS) */
export async function fetchTLE(): Promise<TLEData | null> {
    const CELESTRAK_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
    try {
        const text = await fetchWithRetry<string>(CELESTRAK_URL, { responseType: 'text', maxRetries: 2 });
        if (!text) return null;
        const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) return null;

        // TLE can be 2-line or 3-line (with name)
        const line1 = lines.find(l => l.startsWith('1 '))!;
        const line2 = lines.find(l => l.startsWith('2 '))!;
        if (!line1 || !line2) return null;

        return parseTLE(line1, line2);
    } catch {
        return null;
    }
}

/* ─── Look Angles (Elevation, Azimuth, Distance) ─── */
export function getLookAngles(
    iss: SGP4Result,
    obsLat: number,
    obsLon: number
): { elevation: number; azimuth: number; distance: number } {
    const R = 6378.137; // Earth radius in km
    const rad = Math.PI / 180;
    
    const phiObs = obsLat * rad;
    const lamObs = obsLon * rad;
    const phiIss = iss.latitude * rad;
    const lamIss = iss.longitude * rad;
    
    const rIss = R + iss.altitude;
    
    // ECEF observer
    const xObs = R * Math.cos(phiObs) * Math.cos(lamObs);
    const yObs = R * Math.cos(phiObs) * Math.sin(lamObs);
    const zObs = R * Math.sin(phiObs);
    
    // ECEF ISS
    const xIss = rIss * Math.cos(phiIss) * Math.cos(lamIss);
    const yIss = rIss * Math.cos(phiIss) * Math.sin(lamIss);
    const zIss = rIss * Math.sin(phiIss);
    
    // Vector observer -> ISS
    const dx = xIss - xObs;
    const dy = yIss - yObs;
    const dz = zIss - zObs;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist < 1e-3) {
        return { elevation: 90, azimuth: 0, distance: dist };
    }
    
    // Local horizon coordinates (East, North, Zenith)
    const sinPhi = Math.sin(phiObs);
    const cosPhi = Math.cos(phiObs);
    const sinLam = Math.sin(lamObs);
    const cosLam = Math.cos(lamObs);
    
    // Dot product with local Zenith vector
    const zVal = dx * cosPhi * cosLam + dy * cosPhi * sinLam + dz * sinPhi;
    
    // Dot product with local East vector
    const eVal = -dx * sinLam + dy * cosLam;
    
    // Dot product with local North vector
    const nVal = -dx * sinPhi * cosLam - dy * sinPhi * sinLam + dz * cosPhi;
    
    const elevation = Math.asin(zVal / dist) * 180 / Math.PI;
    const azimuth = (Math.atan2(eVal, nVal) * 180 / Math.PI + 360) % 360;
    
    return { elevation, azimuth, distance: dist };
}

/* ─── Pass Predictor (Umut Verici Geçiş Saatleri) ─── */
export function predictPasses(
    tle: TLEData,
    obsLat: number,
    obsLon: number,
    startDate: Date = new Date()
): ISSPass[] {
    const epochMs = tle.epoch.getTime();
    const startMinutes = (startDate.getTime() - epochMs) / 60000;
    const passes: ISSPass[] = [];
    
    let activePass: Partial<ISSPass> | null = null;
    
    // Scan next 24 hours in 30-second steps
    const durationMinutes = 1440;
    const stepMinutes = 0.5;
    const totalSteps = durationMinutes / stepMinutes;
    
    for (let i = 0; i <= totalSteps; i++) {
        const tMin = startMinutes + i * stepMinutes;
        const timeAtStep = new Date(epochMs + tMin * 60000);
        
        try {
            const pos = propagate(tle, tMin);
            if (!Number.isFinite(pos.latitude) || !Number.isFinite(pos.longitude)) {
                continue;
            }
            
            const look = getLookAngles(pos, obsLat, obsLon);
            
            if (look.elevation > 10) {
                if (!activePass) {
                    activePass = {
                        startTime: timeAtStep,
                        startAzimuth: look.azimuth,
                        maxElevation: look.elevation,
                        peakTime: timeAtStep,
                        peakAzimuth: look.azimuth,
                    };
                } else {
                    if (look.elevation > (activePass.maxElevation ?? -90)) {
                        activePass.maxElevation = look.elevation;
                        activePass.peakTime = timeAtStep;
                        activePass.peakAzimuth = look.azimuth;
                    }
                }
            } else {
                if (activePass) {
                    activePass.endTime = timeAtStep;
                    activePass.endAzimuth = look.azimuth;
                    activePass.durationSeconds = Math.round(
                        ((activePass.endTime?.getTime() ?? 0) - (activePass.startTime?.getTime() ?? 0)) / 1000
                    );
                    
                    passes.push(activePass as ISSPass);
                    activePass = null;
                }
            }
        } catch {
            // Ignore SGP4 divergence
        }
    }
    
    if (activePass) {
        const endTime = new Date(startDate.getTime() + durationMinutes * 60000);
        activePass.endTime = endTime;
        activePass.endAzimuth = 0;
        activePass.durationSeconds = Math.round(
            ((activePass.endTime?.getTime() ?? 0) - (activePass.startTime?.getTime() ?? 0)) / 1000
        );
        passes.push(activePass as ISSPass);
    }
    
    return passes;
}

export function getCompassDirection(azimuth: number): string {
    const directions = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
    const index = Math.round(azimuth / 45) % 8;
    return directions[index];
}

