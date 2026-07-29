'use client';

import { getLanguage, t } from '@/lib/api';
import type { ISSPosition } from '@/types';

interface Props {
    position: ISSPosition | null;
    tleAgeHours: number | null;
    isStale: boolean;
    isLoading?: boolean;
    error?: string | null;
}

/** İşaretli dereceyi seçili dilin yarımküre harfiyle biçimlendirir (41.01° K / 41.01° N) */
function formatLat(deg: number): string {
    const en = getLanguage() === 'en';
    return `${Math.abs(deg).toFixed(2)}° ${deg >= 0 ? (en ? 'N' : 'K') : (en ? 'S' : 'G')}`;
}
function formatLon(deg: number): string {
    const en = getLanguage() === 'en';
    return `${Math.abs(deg).toFixed(2)}° ${deg >= 0 ? (en ? 'E' : 'D') : (en ? 'W' : 'B')}`;
}

function formatTleAge(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)} ${t('minutesShort')}`;
    return `${Math.round(hours)} ${t('hoursShort')}`;
}

export default function ISSPanel({ position, tleAgeHours, isStale, isLoading = false, error = null }: Props) {
    if (error && !position) {
        return (
            <div className="glass rounded-xl p-4 text-sm text-cyan-100" role="region" aria-label="ISS panel">
                <p className="text-xs font-medium text-cyan-400 mb-1">🛰️ {t('issTitle')}</p>
                <p className="text-gray-400 text-xs">{t('issNoData')}</p>
            </div>
        );
    }

    if (!position) {
        return (
            <div className="glass rounded-xl p-4 text-sm text-cyan-100 relative overflow-hidden" role="region" aria-label="ISS panel">
                {isLoading && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-xl flex items-center justify-center z-50">
                        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                <p className="text-xs font-medium text-cyan-400 mb-1">🛰️ {t('issTitle')}</p>
                <p className="text-gray-400 text-xs">{t('issLoading')}</p>
            </div>
        );
    }

    return (
        <div className="glass rounded-xl p-4 text-sm text-cyan-100 space-y-3 relative overflow-hidden" role="region" aria-label="ISS panel">
            <div className="hud-label hud-label-cyan text-[10px] border-b border-cyan-900/50 pb-2">
                🛰️ {t('issTitle')}
            </div>

            <div className="flex items-baseline gap-2">
                <p className="hud-value-xl">{Math.round(position.altitudeKm)} km</p>
                <p className="text-xs text-cyan-100/50">{t('issAltitude')}</p>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="hud-label">{t('latitude')}</span>
                <span className="hud-value hud-value-sm">{formatLat(position.latitude)}</span>
                <span className="hud-label">{t('longitude')}</span>
                <span className="hud-value hud-value-sm">{formatLon(position.longitude)}</span>
                <span className="hud-label">{t('issSpeed')}</span>
                <span className="hud-value hud-value-sm">{Math.round(position.velocityKmS * 3600).toLocaleString('tr-TR')} km/h</span>
            </div>

            {tleAgeHours !== null && (
                <div className={`border-t border-cyan-900/50 pt-2 text-[10px] ${isStale ? 'text-amber-400' : 'text-cyan-100/40'}`}>
                    {isStale ? t('issTleStale') : `${t('issTleAge')}: ${formatTleAge(tleAgeHours)}`}
                </div>
            )}
        </div>
    );
}
