/* ═══════════════════════════════════════════════════════════════
   SGP4 yörünge propagasyonu — satellite.js (MIT) ince sarmalayıcısı.

   satellite.js, referans Vallado/Hoots SGP4 uygulamasının sadık bir
   portudur; elle yazılan bir SGP4 (WGS72 sabitleri, seküler pertürbasyon
   terimleri, derin uzay geçişi) sessizce sapan sonuçlar üretmeye çok
   müsaittir. Kütüphane saf hesaplamadır: ağ çağrısı ve hesap gerektirmez.

   ⚠ SÜRÜM KİLİDİ: satellite.js 6.x kullanılmalı, 7.x'e YÜKSELTMEYİN.
   7.0 ile gelen `#wasm-single-thread` / `#wasm-multi-thread` package-imports
   dalları, Emscripten üretimi ~126 KB'lık gömülü WASM modüllerine işaret
   ediyor ve Turbopack bunları statik analiz ederken `next build` süresiz
   kilitleniyor (derleme aşamasına hiç ulaşmıyor). Kullandığımız senkron
   API 6.x ile birebir aynıdır; WASM çalışma zamanına hiç girmiyoruz.
   ═══════════════════════════════════════════════════════════════ */

import {
    twoline2satrec,
    propagate,
    gstime,
    eciToGeodetic,
    eciToEcf,
    ecfToLookAngles,
    degreesLat,
    degreesLong,
    type SatRec,
} from 'satellite.js';
import { getLanguage } from './api';
import { azimuthLabel } from './geo';
import type { ISSPosition, ISSUpcomingPass } from '@/types';

const DEG = Math.PI / 180;

/** TLE satırlarından yörünge kaydı üretir. Geçersizse null. */
export function parseTLE(line1: string, line2: string): SatRec | null {
    try {
        const satrec = twoline2satrec(line1, line2);
        // satrec.error ≠ 0 → elemanlar propagasyon için uygun değil
        return satrec && satrec.error === 0 ? satrec : null;
    } catch {
        return null;
    }
}

/** Verilen an için ISS coğrafi konumu + hızı. Propagasyon hatasında null. */
export function propagateISS(satrec: SatRec, date: Date): ISSPosition | null {
    const pv = propagate(satrec, date);
    if (!pv?.position || !pv?.velocity) return null;

    const gmst = gstime(date);
    const geo = eciToGeodetic(pv.position, gmst);
    const latitude = degreesLat(geo.latitude);
    const longitude = degreesLong(geo.longitude);
    const { x, y, z } = pv.velocity;
    const velocityKmS = Math.sqrt(x * x + y * y + z * z);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(geo.height)) return null;

    return { latitude, longitude, altitudeKm: geo.height, velocityKmS };
}

interface ObserverGd { latitude: number; longitude: number; height: number }

/** Gözlemciye göre yükseklik (derece) ve azimut (derece). Hata durumunda null. */
function lookAt(satrec: SatRec, observerGd: ObserverGd, date: Date): { elevation: number; azimuth: number } | null {
    const pv = propagate(satrec, date);
    if (!pv?.position) return null;
    const gmst = gstime(date);
    const ecf = eciToEcf(pv.position, gmst);
    const look = ecfToLookAngles(observerGd, ecf);
    const elevation = look.elevation / DEG;
    const azimuth = ((look.azimuth / DEG) % 360 + 360) % 360;
    return Number.isFinite(elevation) ? { elevation, azimuth } : null;
}

/* Kaba tarama adımı: ISS geçişleri tipik olarak birkaç dakika sürer,
   60 sn eşik geçişini kaçırmayacak kadar sıktır. */
const COARSE_STEP_MS = 60_000;
/** Sınır hassaslaştırmasında ikili arama yineleme sayısı (~1 sn çözünürlük) */
const BISECT_ITERATIONS = 7;
/** Zirve yüksekliği araması için ince örnekleme adımı */
const PEAK_STEP_MS = 15_000;

/** İki zaman noktası arasında eşik geçişini ikili aramayla bulur. */
function bisectCrossing(
    satrec: SatRec, observerGd: ObserverGd,
    tLow: number, tHigh: number, minElevation: number, risingEdge: boolean,
): number {
    let lo = tLow, hi = tHigh;
    for (let i = 0; i < BISECT_ITERATIONS; i++) {
        const mid = (lo + hi) / 2;
        const look = lookAt(satrec, observerGd, new Date(mid));
        const above = (look?.elevation ?? -90) > minElevation;
        // Yükselen kenarda: eşiğin üstündeysek sınır solda kaldı
        if (above === risingEdge) hi = mid;
        else lo = mid;
    }
    return (lo + hi) / 2;
}

/**
 * SGP4 tabanlı görünür geçiş tahmini.
 *
 * İki geçişli: önce 60 sn'lik kaba tarama ile eşik geçişleri bulunur,
 * sonra yalnızca aday aralıklarda ikili arama + ince örnekleme yapılır.
 * Naif 10 sn'lik tam tarama 24 saat için ~8.600 propagate çağrısı demektir.
 */
export function predictPasses(
    satrec: SatRec,
    obsLat: number,
    obsLon: number,
    obsAltKm = 0,
    hoursAhead = 24,
    minElevationDeg = 10,
    maxPasses = 5,
): ISSUpcomingPass[] {
    const observerGd: ObserverGd = {
        latitude: obsLat * DEG,
        longitude: obsLon * DEG,
        height: obsAltKm,
    };

    const start = Date.now();
    const end = start + hoursAhead * 3600_000;
    const passes: ISSUpcomingPass[] = [];

    let prevT = start;
    let prevAbove = (lookAt(satrec, observerGd, new Date(start))?.elevation ?? -90) > minElevationDeg;
    // Tarama başında geçiş sürüyorsa başlangıcı "şimdi" kabul et
    let riseT: number | null = prevAbove ? start : null;

    for (let t = start + COARSE_STEP_MS; t <= end; t += COARSE_STEP_MS) {
        const look = lookAt(satrec, observerGd, new Date(t));
        const above = (look?.elevation ?? -90) > minElevationDeg;

        if (above && !prevAbove) {
            riseT = bisectCrossing(satrec, observerGd, prevT, t, minElevationDeg, true);
        } else if (!above && prevAbove && riseT !== null) {
            const setT = bisectCrossing(satrec, observerGd, prevT, t, minElevationDeg, false);
            const pass = buildPass(satrec, observerGd, riseT, setT, start);
            if (pass) passes.push(pass);
            riseT = null;
            if (passes.length >= maxPasses) break;
        }

        prevAbove = above;
        prevT = t;
    }

    return passes;
}

function buildPass(
    satrec: SatRec, observerGd: ObserverGd,
    riseT: number, setT: number, now: number,
): ISSUpcomingPass | null {
    const riseLook = lookAt(satrec, observerGd, new Date(riseT));
    const setLook = lookAt(satrec, observerGd, new Date(setT));
    if (!riseLook || !setLook) return null;

    // Zirve yüksekliği — yalnızca geçiş penceresinde ince örnekleme
    let maxElevation = Math.max(riseLook.elevation, setLook.elevation);
    for (let t = riseT; t <= setT; t += PEAK_STEP_MS) {
        const e = lookAt(satrec, observerGd, new Date(t))?.elevation;
        if (e !== undefined && e > maxElevation) maxElevation = e;
    }

    return {
        time: new Date(riseT).toLocaleTimeString(getLanguage() === 'en' ? 'en-GB' : 'tr-TR', { hour: '2-digit', minute: '2-digit' }),
        durationSec: Math.round((setT - riseT) / 1000),
        maxElevation: Math.round(maxElevation),
        direction: `${azimuthLabel(riseLook.azimuth, true)} → ${azimuthLabel(setLook.azimuth, true)}`,
        hoursFromNow: (riseT - now) / 3600_000,
    };
}

export type { SatRec };
