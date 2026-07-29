'use client';

import { t } from '@/lib/api';
import { predictPasses, type SatRec } from '@/lib/sgp4';
import type { ISSUpcomingPass } from '@/types';
import { useEffect, useState } from 'react';

interface Props {
    satrec: SatRec | null;
    observer: { lat: number; lon: number } | null;
}

function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} ${t('minutesShort')} ${s}s` : `${s}s`;
}

function formatWhen(hoursFromNow: number): string {
    if (hoursFromNow < 1) return `${Math.round(hoursFromNow * 60)} ${t('minutesShort')}`;
    return `${Math.round(hoursFromNow)} ${t('hoursShort')}`;
}

export default function PassPredictorPanel({ satrec, observer }: Props) {
    const [passes, setPasses] = useState<ISSUpcomingPass[]>([]);
    const [computing, setComputing] = useState(false);

    /* Geçiş taraması senkron ve CPU-yoğun; gözlemci veya yörünge kaydı
       değiştiğinde bir kez çalışır, her render'da değil. */
    useEffect(() => {
        if (!satrec || !observer) { setPasses([]); return; }
        setComputing(true);
        // Bir sonraki frame'e ertele → panel açılışında görsel takılma olmasın
        const id = setTimeout(() => {
            setPasses(predictPasses(satrec, observer.lat, observer.lon));
            setComputing(false);
        }, 0);
        return () => clearTimeout(id);
    }, [satrec, observer]);

    return (
        <div className="glass rounded-xl p-4 text-sm text-cyan-100 space-y-2 relative overflow-hidden" role="region" aria-label="ISS pass predictor">
            <div className="hud-label hud-label-cyan text-[10px] border-b border-cyan-900/50 pb-2">
                {t('issPasses')}
            </div>

            {!observer ? (
                <p className="text-gray-400 text-xs">{t('issSelectLocation')}</p>
            ) : computing ? (
                <div className="flex items-center gap-2 text-xs text-cyan-100/50">
                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    {t('issLoading')}
                </div>
            ) : passes.length === 0 ? (
                <p className="text-gray-400 text-xs">{t('issNoPasses')}</p>
            ) : (
                <ul className="space-y-2">
                    {passes.map((p, i) => (
                        <li key={`${p.time}-${i}`} className="border border-cyan-900/40 rounded-lg px-2.5 py-2 bg-white/[0.02]">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="hud-value hud-value-sm">{p.time}</span>
                                <span className="text-[10px] text-cyan-100/40">+{formatWhen(p.hoursFromNow)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-x-2 mt-1 text-[10px]">
                                <span className="text-cyan-100/50">{t('issMaxElevation')}</span>
                                <span className="text-cyan-100/50">{t('issDuration')}</span>
                                <span className="text-cyan-100/50">{t('issDirection')}</span>
                                <span>{p.maxElevation}°</span>
                                <span>{formatDuration(p.durationSec)}</span>
                                <span>{p.direction}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
