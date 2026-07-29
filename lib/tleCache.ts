/* ═══════════════════════════════════════════════════════════════
   ISS yörünge elemanları (TLE) — CelesTrak'tan anahtarsız çekim
   + localStorage önbelleği.

   Ağ yalnızca TLE tazelemek için kullanılır; anlık konum tamamen
   yerel SGP4 propagasyonuyla hesaplanır (bkz. lib/sgp4.ts).
   ═══════════════════════════════════════════════════════════════ */

import { fetchWithRetry } from './fetchWithRetry';

/** ISS (ZARYA) sabit NORAD katalog numarası */
const ISS_NORAD_ID = 25544;

/** Anahtarsız, hesapsız genel erişime açık TLE uç noktası */
const CELESTRAK_URL = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${ISS_NORAD_ID}&FORMAT=TLE`;

const CACHE_KEY = 'iss-tle-cache-v1';

/** Bu süreden eskiyse yeniden çekmeyi dene (ms) */
export const TLE_REFRESH_MS = 12 * 60 * 60 * 1000; // 12 saat
/** Bu süreyi aşan TLE "bayat" sayılır ve kullanıcıya uyarı gösterilir (ms).
    ISS yeniden yükseltme manevraları ve atmosferik sürüklenme nedeniyle
    yörünge elemanları ~1-2 hafta sonra ölçülebilir şekilde sapar. */
export const TLE_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

export interface CachedTLE {
    line1: string;
    line2: string;
    name: string;
    fetchedAt: number;
}

/** TLE satır biçimi doğrulaması — hatalı/HTML yanıtın önbelleğe girmesini engeller */
export function isValidTLE(line1: string, line2: string): boolean {
    return (
        line1.startsWith('1 ') && line1.length >= 69 &&
        line2.startsWith('2 ') && line2.length >= 69
    );
}

/** Ham CelesTrak metnini (2 veya 3 satırlı) ayrıştırır */
export function parseTLEText(text: string): Omit<CachedTLE, 'fetchedAt'> | null {
    const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim().length > 0);
    if (lines.length < 2) return null;

    // 3 satırlı biçim: ad satırı + 2 eleman satırı
    const hasName = !lines[0].startsWith('1 ');
    const name = hasName ? lines[0].trim() : 'ISS (ZARYA)';
    const line1 = hasName ? lines[1] : lines[0];
    const line2 = hasName ? lines[2] : lines[1];
    if (!line1 || !line2 || !isValidTLE(line1, line2)) return null;

    return { name, line1, line2 };
}

export function getCachedTLE(): CachedTLE | null {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<CachedTLE>;
        if (
            typeof parsed?.line1 !== 'string' ||
            typeof parsed?.line2 !== 'string' ||
            typeof parsed?.fetchedAt !== 'number' ||
            !isValidTLE(parsed.line1, parsed.line2)
        ) return null;
        return {
            name: typeof parsed.name === 'string' ? parsed.name : 'ISS (ZARYA)',
            line1: parsed.line1,
            line2: parsed.line2,
            fetchedAt: parsed.fetchedAt,
        };
    } catch {
        return null;
    }
}

function setCachedTLE(tle: CachedTLE): void {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(tle)); } catch { /* kota dolu olabilir */ }
}

/** CelesTrak'tan taze TLE çeker ve önbelleğe yazar. Başarısızlıkta null. */
export async function fetchTLE(signal?: AbortSignal): Promise<CachedTLE | null> {
    const text = await fetchWithRetry<string>(CELESTRAK_URL, { responseType: 'text', signal });
    if (typeof text !== 'string') return null;

    const parsed = parseTLEText(text);
    if (!parsed) return null;

    const tle: CachedTLE = { ...parsed, fetchedAt: Date.now() };
    setCachedTLE(tle);
    return tle;
}
