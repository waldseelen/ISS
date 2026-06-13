'use client';

import { useEffect, useState } from 'react';
import { playBeep } from '@/lib/audio';

interface Props {
    selectedLon: number | null;
    issLon: number | null;
    locationName: string | null;
}

export default function LiveStreamPanel({ selectedLon, issLon, locationName }: Props) {
    const [times, setTimes] = useState({
        local: '',
        utc: '',
        solar: '',
        solarLabel: '',
    });

    useEffect(() => {
        const updateTimes = () => {
            const now = new Date();
            
            // 1. Local Time
            const localStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // 2. UTC Time
            const utcStr = now.toLocaleTimeString('tr-TR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // 3. Local Mean Solar Time (LMST)
            const targetLon = selectedLon !== null ? selectedLon : (issLon !== null ? issLon : 0);
            const label = selectedLon !== null ? (locationName || 'Seçili Konum') : 'ISS Konumu';
            
            const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
            let solarHours = (utcHours + targetLon / 15) % 24;
            if (solarHours < 0) solarHours += 24;
            
            const h = Math.floor(solarHours);
            const m = Math.floor((solarHours - h) * 60);
            const s = Math.floor(((solarHours - h) * 60 - m) * 60);
            
            const solarStr = [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
            
            setTimes({
                local: localStr,
                utc: utcStr,
                solar: solarStr,
                solarLabel: label,
            });
        };

        updateTimes();
        const interval = setInterval(updateTimes, 1000);
        return () => clearInterval(interval);
    }, [selectedLon, issLon, locationName]);

    return (
        <div className="glass rounded-xl p-4 text-xs text-cyan-100 space-y-3 border border-cyan-500/10">
            <div className="flex items-center gap-2 border-b border-cyan-900/50 pb-2">
                <span className="text-base">🎥</span>
                <span className="font-semibold text-cyan-300 uppercase tracking-wider font-mono">
                    Canlı Video & Astronomik Saatler
                </span>
                <span className="ml-auto text-[8px] text-green-400 font-mono pulse-cyan rounded px-1 border border-green-500/20">
                    CANLI
                </span>
            </div>

            {/* NASA ISS Live Video Feed */}
            <div className="relative rounded-lg overflow-hidden border border-cyan-800/40 bg-black aspect-video">
                <iframe
                    width="100%"
                    height="100%"
                    src="https://www.youtube.com/embed/xRPjKQtRXR8?autoplay=1&mute=1"
                    title="NASA ISS HDEV Stream"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                />
            </div>

            {/* Timezones Hierarchy */}
            <div className="grid grid-cols-3 gap-2 bg-cyan-950/20 p-2.5 rounded-lg border border-cyan-900/30 text-center font-mono">
                <div className="flex flex-col gap-0.5 border-r border-cyan-900/40">
                    <span className="text-[8px] text-gray-500 uppercase">Yerel Saat</span>
                    <span className="text-[11px] font-bold text-cyan-300">{times.local}</span>
                </div>
                <div className="flex flex-col gap-0.5 border-r border-cyan-900/40">
                    <span className="text-[8px] text-gray-500 uppercase">Evrensel (UTC)</span>
                    <span className="text-[11px] font-bold text-cyan-100">{times.utc}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] text-gray-500 uppercase truncate" title={`Gerçek Güneş Saati (${times.solarLabel})`}>
                        Güneş Saati
                    </span>
                    <span className="text-[11px] font-bold text-yellow-300">{times.solar}</span>
                </div>
            </div>
            <p className="text-[8px] text-gray-500 font-mono text-center">
                * Güneş saati, {times.solarLabel} meridyenine göre gerçek güneş açısını temsil eder.
            </p>
        </div>
    );
}
