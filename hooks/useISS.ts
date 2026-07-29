'use client';

import { parseTLE, propagateISS, type SatRec } from '@/lib/sgp4';
import { fetchTLE, getCachedTLE, TLE_REFRESH_MS, TLE_STALE_MS } from '@/lib/tleCache';
import type { ISSPosition } from '@/types';
import { useEffect, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   ISS canlı telemetrisi.

   Ağ YALNIZCA TLE tazelemek için kullanılır (12 saatte bir). Konum
   her saniye tamamen yerel SGP4 propagasyonuyla hesaplanır — saniyelik
   ağ isteği yok.
   ═══════════════════════════════════════════════════════════════ */

export interface ISSState {
    position: ISSPosition | null;
    /** Geçiş tahmini için yörünge kaydı (PassPredictorPanel kullanır) */
    satrec: SatRec | null;
    /** TLE yaşı (saat). Henüz veri yoksa null. */
    tleAgeHours: number | null;
    /** TLE sert bayatlık eşiğini aştı mı (konum tahmini sapmış olabilir) */
    isStale: boolean;
    isLoading: boolean;
    error: string | null;
}

export function useISS(enabled = true): ISSState {
    const [satrec, setSatrec] = useState<SatRec | null>(null);
    const [fetchedAt, setFetchedAt] = useState<number | null>(null);
    const [position, setPosition] = useState<ISSPosition | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /* Aynı oturumda tekrar tekrar ağa çıkmayı önle */
    const loadedRef = useRef(false);

    /* ── 1) TLE yükle: önce önbellek, TTL dolduysa ağ ── */
    useEffect(() => {
        if (!enabled || loadedRef.current) return;
        loadedRef.current = true;

        const controller = new AbortController();
        let cancelled = false;

        const applyTLE = (line1: string, line2: string, at: number): boolean => {
            const rec = parseTLE(line1, line2);
            if (!rec) return false;
            if (cancelled) return true;
            setSatrec(rec);
            setFetchedAt(at);
            return true;
        };

        const load = async () => {
            const cached = getCachedTLE();
            const cacheFresh = cached !== null && Date.now() - cached.fetchedAt < TLE_REFRESH_MS;

            // Önbellek varsa hemen göster (ağ beklenmez)
            if (cached && applyTLE(cached.line1, cached.line2, cached.fetchedAt) && cacheFresh) return;

            setIsLoading(true);
            try {
                const fresh = await fetchTLE(controller.signal);
                if (cancelled) return;
                if (fresh && applyTLE(fresh.line1, fresh.line2, fresh.fetchedAt)) {
                    setError(null);
                } else if (!cached) {
                    // Ne taze veri ne önbellek → gerçekten veri yok.
                    // Bayrağı geri al ki modül kapatılıp açıldığında yeniden denensin.
                    loadedRef.current = false;
                    setError('Yörünge verisi (TLE) alınamadı');
                }
            } catch {
                if (!cancelled && !cached) {
                    loadedRef.current = false;
                    setError('Yörünge verisi (TLE) alınamadı');
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        load();
        return () => { cancelled = true; controller.abort(); };
    }, [enabled]);

    /* ── 2) Saniyelik yerel propagasyon (ağ yok) ── */
    useEffect(() => {
        if (!enabled || !satrec) return;

        const tick = () => {
            const next = propagateISS(satrec, new Date());
            if (next) setPosition(next);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [enabled, satrec]);

    const ageMs = fetchedAt === null ? null : Date.now() - fetchedAt;

    return {
        position,
        satrec,
        tleAgeHours: ageMs === null ? null : ageMs / 3600_000,
        isStale: ageMs !== null && ageMs > TLE_STALE_MS,
        isLoading,
        error,
    };
}
