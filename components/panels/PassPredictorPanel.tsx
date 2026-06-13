'use client';

import { useEffect, useState } from 'react';
import type { TLEData } from '@/lib/sgp4';
import { predictPasses, getCompassDirection } from '@/lib/sgp4';
import type { ISSPass } from '@/types';
import { playBeep } from '@/lib/audio';

interface Props {
    tle: TLEData | null;
    latitude: number;
    longitude: number;
}

export default function PassPredictorPanel({ tle, latitude, longitude }: Props) {
    const [passes, setPasses] = useState<ISSPass[]>([]);

    useEffect(() => {
        if (!tle) return;
        
        try {
            // Predict passes starting now
            const rawPasses = predictPasses(tle, latitude, longitude, new Date());
            
            // Limit to next 3 visual passes
            setPasses(rawPasses.slice(0, 3));
        } catch (e) {
            console.error('Failed to predict passes', e);
        }
    }, [tle, latitude, longitude]);

    if (!tle) {
        return (
            <div className="glass rounded-xl p-3.5 text-xs text-cyan-200/50 font-mono text-center">
                📡 ISS Yörünge verileri bekleniyor...
            </div>
        );
    }

    const formatPassTime = (date: Date) => {
        const now = new Date();
        const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
        const datePrefix = isToday ? 'Bugün' : 'Yarın';
        const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        return `${datePrefix} ${timeStr}`;
    };

    return (
        <div className="glass rounded-xl p-4 text-xs text-cyan-100 space-y-3 border border-cyan-500/10">
            <div className="flex items-center gap-2 border-b border-cyan-900/50 pb-2">
                <span className="text-base">📡</span>
                <span className="font-semibold text-cyan-300 uppercase tracking-wider font-mono">
                    ISS Görünürlük Hesaplayıcısı
                </span>
            </div>

            {passes.length === 0 ? (
                <p className="text-[10px] text-cyan-100/50 font-mono text-center py-2">
                    Önümüzdeki 24 saat içinde bu konumda ufuk üstü geçiş bulunmamaktadır (ufuk açısı &gt; 10°).
                </p>
            ) : (
                <div className="space-y-2">
                    {passes.map((pass, idx) => {
                        const startDir = getCompassDirection(pass.startAzimuth);
                        const endDir = getCompassDirection(pass.endAzimuth);
                        const min = Math.floor(pass.durationSeconds / 60);
                        const sec = pass.durationSeconds % 60;
                        const durationStr = min > 0 ? `${min}dk ${sec}sn` : `${sec}sn`;
                        
                        return (
                            <div 
                                key={idx} 
                                className="bg-cyan-950/25 border border-cyan-900/30 rounded-xl p-2.5 flex flex-col gap-1 hover:border-cyan-500/20 transition-all duration-300"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="text-cyan-300 font-semibold font-mono text-[10px]">
                                        {formatPassTime(pass.startTime)}
                                    </span>
                                    <span className="text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-900/40 text-[9px]">
                                        Zirve: {Math.round(pass.maxElevation)}°
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 text-[10px] text-cyan-100/60 font-mono gap-y-0.5">
                                    <span>⏳ Süre:</span>
                                    <span className="text-right text-cyan-200">{durationStr}</span>
                                    <span>🧭 Yön:</span>
                                    <span className="text-right text-cyan-200">
                                        {startDir} &rarr; {endDir}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <p className="text-[8px] text-gray-500 font-mono text-center">
                Geçişlerin gözlemlenebilmesi için bulutsuz bir gökyüzü gereklidir.
            </p>
        </div>
    );
}
