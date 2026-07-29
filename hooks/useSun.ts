'use client';

import type { SunPosition, SunTimes, TerminatorPolygon } from '@/types';
import { useEffect, useState } from 'react';
import * as SunCalc from 'suncalc';

/* ═══════════════════════════════════════════════════════════════
   Gündüz/gece geometrisi — analitik şeritler (grid taraması yok).

   Karanlık bölge anti-güneş noktasına açısal uzaklıkla tanımlanır:
       sunAlt ≤ h   ⟺   d_anti ≤ 90° + h
   Sabit bir boylamda (meridyen boyunca) bu uzaklık tek-modludur,
   dolayısıyla karanlık bölge TEK bir kesintisiz enlem aralığıdır ve
   kapalı formda çözülebilir. Bu üç sorunu birden çözer:
     • Kutup kapsaması → aralık ±90'da kırpılır, ekstra kapanış yok.
     • Antimeridyen    → boylam −180..180 örneklendiği için hiç kesilmez.
     • Bant opaklığı   → bantlar AYRIK şeritler olarak üretilir (üst üste
                         binen iç içe daireler değil), böylece bugünkü
                         ayrık-hücre `fill-opacity` semantiği korunur.
   ═══════════════════════════════════════════════════════════════ */

export interface TwilightBand {
    rings: [number, number, number?][][];
    opacity: number;
    color: [number, number, number, number]; // RGBA
}

const DEG = Math.PI / 180;
/* Boylam örnekleme adımı — sınır eğrisi enleme göre yumuşak değiştiği için
   1° pürüzsüz bir terminatör verir (361 örnek/eşik). */
const LON_STEP = 1;
/* Bant sınırları: gündüz/gece, sivil, denizcilik, astronomik alacakaranlık */
const BAND_EDGES = [0, -6, -12, -18];

type LatRange = [number, number] | null;

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

            const { terminator: term, twilightBands: bands } = buildDayNightGeometry(subSolar.lat, subSolar.lon);
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

/* Verilen boylamda güneş yüksekliği ≤ altDeg olan enlem aralığı.
   Koşul:  A·sin(lat) + B·cos(lat) ≥ cos(r)  ⟺  sin(lat + φ) ≥ u

   Bir meridyen tam büyük dairenin YARISI olduğundan uzaklık fonksiyonunun
   içeride bir maksimumu olabilir; bu durumda sin(...) ≥ u çözümü ±360°
   kaydırmalı iki dal verir. Her iki kutbun aynı anda karanlık olması ancak
   altDeg = 0 VE anti-güneş enlemi tam 0 iken (ekinoks anı) mümkündür ve o
   dallar sıfır genişliktedir — dolayısıyla dejenere dallar elenir. Eğer
   elenmezlerse min/max birleştirmesi "tüm meridyen karanlık" sonucunu
   verir ve gündüz tarafının tamamı gölgelenir. */
const MIN_BAND = 0.01; // derece (~1 km) — altındaki şeritler görünmez

function darkLatRange(lonDeg: number, altDeg: number, antiLat: number, antiLon: number): LatRange {
    const r = 90 + altDeg; // anti-güneş noktasından açısal yarıçap
    const A = Math.sin(antiLat * DEG);
    const B = Math.cos(antiLat * DEG) * Math.cos((lonDeg - antiLon) * DEG);
    const R = Math.hypot(A, B);
    const cosR = Math.cos(r * DEG);

    if (R < 1e-12) return cosR <= 0 ? [-90, 90] : null;
    const u = cosR / R;
    if (u > 1) return null;        // bu boylamda hiç karanlık yok
    if (u < -1) return [-90, 90];  // meridyenin tamamı karanlık

    const phi = Math.atan2(B, A) / DEG;
    const a = Math.asin(u) / DEG;

    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const k of [-360, 0, 360]) {
        const start = Math.max(-90, a - phi + k);
        const end = Math.min(90, 180 - a - phi + k);
        if (end - start > MIN_BAND) { lo = Math.min(lo, start); hi = Math.max(hi, end); }
    }
    return lo === Number.POSITIVE_INFINITY ? null : [lo, hi];
}

/* Ardışık aktif boylamlardan kapalı halkalar (şeritler) üretir.
   Alt kenar soldan sağa, üst kenar sağdan sola gezilir. Boylam dizisi
   −180..180 olduğu için antimeridyendeki dikey kenarlar çakışır → dikiş yok. */
function stripsToRings(
    lons: number[],
    bottom: (number | null)[],
    top: (number | null)[],
): [number, number][][] {
    const rings: [number, number][][] = [];
    let run: number[] = [];

    const flush = () => {
        if (run.length >= 2) {
            const ring: [number, number][] = [];
            for (const i of run) ring.push([lons[i], bottom[i]!]);
            for (let j = run.length - 1; j >= 0; j--) ring.push([lons[run[j]], top[run[j]]!]);
            ring.push(ring[0]);
            rings.push(ring);
        }
        run = [];
    };

    for (let i = 0; i < lons.length; i++) {
        const b = bottom[i];
        const t = top[i];
        if (b === null || t === null || t - b < 1e-6) flush();
        else run.push(i);
    }
    flush();
    return rings;
}

function buildDayNightGeometry(subSolarLat: number, subSolarLon: number): { terminator: TerminatorPolygon; twilightBands: TwilightBand[] } {
    const antiLat = -subSolarLat;
    const antiLon = subSolarLon + 180;

    const lons: number[] = [];
    for (let lon = -180; lon <= 180; lon += LON_STEP) lons.push(lon);

    /* ranges[0] = ≤0° (terminatör), [1] = ≤−6°, [2] = ≤−12°, [3] = ≤−18° */
    const ranges = BAND_EDGES.map(alt => lons.map(lon => darkLatRange(lon, alt, antiLat, antiLon)));

    /* Bant = dış bölge \ iç bölge → alt ve üst olmak üzere iki ayrık şerit.
       İç bölge o boylamda yoksa bant dış bölgenin tamamını kaplar. */
    const bandRings = (outer: LatRange[], inner: LatRange[]): [number, number][][] => {
        const lowB: (number | null)[] = [], lowT: (number | null)[] = [];
        const highB: (number | null)[] = [], highT: (number | null)[] = [];
        for (let i = 0; i < lons.length; i++) {
            const o = outer[i];
            const n = inner[i];
            if (!o) { lowB.push(null); lowT.push(null); highB.push(null); highT.push(null); continue; }
            lowB.push(o[0]); lowT.push(n ? n[0] : o[1]);
            highB.push(n ? n[1] : o[1]); highT.push(o[1]);
        }
        return [...stripsToRings(lons, lowB, lowT), ...stripsToRings(lons, highB, highT)];
    };

    /* Gece çekirdeği (≤ −18°) tek dolu şerittir */
    const nightRings = stripsToRings(
        lons,
        ranges[3].map(r => (r ? r[0] : null)),
        ranges[3].map(r => (r ? r[1] : null)),
    );

    return {
        terminator: { rings: nightRings },
        twilightBands: [
            { rings: bandRings(ranges[0], ranges[1]), color: [4, 8, 18, 45] as [number, number, number, number], opacity: 0.3 },
            { rings: bandRings(ranges[1], ranges[2]), color: [4, 8, 18, 70] as [number, number, number, number], opacity: 0.4 },
            { rings: bandRings(ranges[2], ranges[3]), color: [4, 8, 18, 100] as [number, number, number, number], opacity: 0.5 },
        ],
    };
}
