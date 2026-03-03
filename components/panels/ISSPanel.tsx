'use client';

import type { ISSData } from '@/types';

interface Props {
    iss: ISSData | null;
}

export default function ISSPanel({ iss }: Props) {
    if (!iss) return null;

    return (
        <div className="bg-black/70 backdrop-blur rounded-lg p-4 text-sm text-cyan-100 space-y-2" role="region" aria-label="ISS panel">
            <div className="flex items-center gap-2 border-b border-cyan-900/50 pb-2">
                <span className="text-lg">🛰️</span>
                <span className="font-semibold text-cyan-300">ISS Takip</span>
                <span className="ml-auto text-xs text-green-400 animate-pulse">● CANLI</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-gray-400">Enlem</span>
                <span>{iss.latitude.toFixed(4)}°</span>
                <span className="text-gray-400">Boylam</span>
                <span>{iss.longitude.toFixed(4)}°</span>
                <span className="text-gray-400">Yükseklik</span>
                <span>{iss.altitude.toFixed(1)} km</span>
                <span className="text-gray-400">Hız</span>
                <span>{iss.velocity.toFixed(0)} km/h</span>
            </div>

            {/* Orbit legend */}
            <div className="border-t border-cyan-900/50 pt-2 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-cyan-400 inline-block rounded" />
                    Yörünge
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-cyan-400/40 inline-block rounded border-dashed border-t border-cyan-400" />
                    Tahmin
                </span>
            </div>
        </div>
    );
}
