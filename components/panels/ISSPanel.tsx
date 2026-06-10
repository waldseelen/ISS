'use client';

import { t } from '@/lib/api';
import type { ISSData } from '@/types';
import { useEffect, useState } from 'react';
import { playBeep } from '@/lib/audio';
import { predictUpcomingPasses, type ISSPass } from '@/lib/geo';
import { useModules } from '@/hooks/useModules';

interface Props {
    iss: ISSData | null;
    prediction?: { lat: number; lon: number }[];
}

export default function ISSPanel({ iss, prediction = [] }: Props) {
    const [showCamera, setShowCamera] = useState(false);
    const [showPasses, setShowPasses] = useState(false);
    const { modules } = useModules();
    const [passes, setPasses] = useState<ISSPass[]>([]);
    const [passError, setPassError] = useState(false);

    useEffect(() => {
        playBeep('iss');
    }, []);

    useEffect(() => {
        if (!showPasses || !iss) return;
        if (prediction.length < 2) {
            setPassError(true);
            return;
        }
        const list = predictUpcomingPasses(iss.latitude, iss.longitude, prediction);
        setPasses(list);
        setPassError(list.length === 0);
    }, [showPasses, iss, prediction]);

    if (!iss) return null;

    const handleCameraToggle = () => {
        playBeep('click');
        setShowCamera(prev => !prev);
    };

    const handlePassesToggle = () => {
        playBeep('click');
        setShowPasses(prev => !prev);
    };

    return (
        <div className="glass rounded-xl p-4 text-sm text-cyan-100 space-y-3" role="region" aria-label="ISS panel">
            <div className="flex items-center gap-2 border-b border-cyan-900/50 pb-2">
                <span className="text-lg">🛰️</span>
                <span className="font-semibold text-cyan-300">{t('issTracker')}</span>
                <span className="ml-auto text-xs text-green-400 pulse-cyan rounded px-1.5">● LIVE</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="hud-label">{t('latitude')}</span>
                <span className="hud-value hud-value-sm">{iss.latitude.toFixed(4)}°</span>
                <span className="hud-label">{t('longitude')}</span>
                <span className="hud-value hud-value-sm">{iss.longitude.toFixed(4)}°</span>
                <span className="hud-label">{t('altitude')}</span>
                <span className="hud-value hud-value-sm">{iss.altitude.toFixed(1)} km</span>
                <span className="hud-label">{t('velocity')}</span>
                <span className="hud-value hud-value-sm">{iss.velocity.toFixed(0)} km/h</span>
            </div>

            <div className="border-t border-cyan-900/40 pt-2 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-cyan-400 inline-block rounded" />
                        {t('orbit')}
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-white/60 inline-block rounded" style={{ backgroundImage: 'repeating-linear-gradient(to right, #fff 0 4px, transparent 4px 7px)' }} />
                        {t('prediction')}
                    </span>
                </div>
                {modules.performanceMode && (
                    <span className="text-yellow-300/80 font-semibold" title="Düşük parçacık / yüksek FPS">⚡ PERF</span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                    type="button"
                    onClick={handleCameraToggle}
                    aria-pressed={showCamera}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono tracking-wider transition-all duration-300 ${
                        showCamera
                            ? 'bg-cyan-400/20 text-cyan-200 border-cyan-400'
                            : 'bg-white/5 text-cyan-100/50 border-cyan-900/40 hover:border-cyan-700/50'
                    }`}
                >
                    📽️ CANLI KAMERA
                </button>
                <button
                    type="button"
                    onClick={handlePassesToggle}
                    aria-pressed={showPasses}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-mono tracking-wider transition-all duration-300 ${
                        showPasses
                            ? 'bg-cyan-400/20 text-cyan-200 border-cyan-400'
                            : 'bg-white/5 text-cyan-100/50 border-cyan-900/40 hover:border-cyan-700/50'
                    }`}
                >
                    ✨ GELECEK GEÇİŞLER
                </button>
            </div>

            {showCamera && (
                <div className="animate-slide-down pt-2">
                    <div className="relative rounded-lg overflow-hidden border border-cyan-800/40 bg-black aspect-video">
                        <iframe
                            width="100%"
                            height="100%"
                            src="https://www.youtube.com/embed/jPTD2gnZFUw?autoplay=1&mute=1"
                            title="NASA ISS Live Space Stream"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 w-full h-full"
                        />
                    </div>
                    <p className="text-[9px] text-gray-500 font-mono mt-1 text-center">NASA HDEV Canlı Akış</p>
                </div>
            )}

            {showPasses && (
                <div className="animate-slide-down border-t border-cyan-900/40 pt-2 space-y-1.5">
                    <p className="text-[10px] text-cyan-300 font-semibold font-mono">📡 YÖRÜNGE GEÇİŞ TAHMİNİ</p>
                    {passError ? (
                        <p className="text-[10px] text-cyan-100/50 font-mono">Yeterli yörünge verisi yok, lütfen 30sn bekleyin.</p>
                    ) : passes.length === 0 ? (
                        <p className="text-[10px] text-cyan-100/50 font-mono">Hesaplanıyor…</p>
                    ) : (
                        <div className="space-y-1">
                            {passes.map((pass, index) => (
                                <div key={index} className="bg-white/5 p-1.5 rounded-lg text-[10px] grid grid-cols-2 gap-y-0.5 border border-cyan-950/40">
                                    <span className="text-cyan-300 font-semibold">{pass.time}</span>
                                    <span className="text-right text-cyan-100/60">{pass.direction}</span>
                                    <span className="text-cyan-100/50">Süre: {Math.round(pass.durationSec / 60)}dk {pass.durationSec % 60}sn</span>
                                    <span className="text-right text-cyan-200">Max {pass.maxElevation}°</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
