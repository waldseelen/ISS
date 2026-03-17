'use client';

import type { ModuleState } from '@/types';

interface Props {
    modules: ModuleState;
}

export default function TimeLegend({ modules }: Props) {
    return (
        <div className="fixed top-20 right-4 z-40 flex flex-col gap-2">
            {modules.precipitation && (
                <div className="glass rounded-xl p-2 text-xs text-cyan-100">
                    <p className="hud-label hud-label-cyan mb-1">Yağış (mm/h)</p>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-[#00ff00]" />
                        <span>0-1</span>
                        <div className="w-3 h-3 rounded bg-[#ffff00]" />
                        <span>1-5</span>
                        <div className="w-3 h-3 rounded bg-[#ff8800]" />
                        <span>5-20</span>
                        <div className="w-3 h-3 rounded bg-[#ff0000]" />
                        <span>20+</span>
                    </div>
                </div>
            )}
            {modules.temperature && (
                <div className="glass rounded-xl p-2 text-xs text-cyan-100">
                    <p className="hud-label hud-label-cyan mb-1">Sıcaklık (°C)</p>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-[#0000ff]" />
                        <span>&lt;0</span>
                        <div className="w-3 h-3 rounded bg-[#00ccff]" />
                        <span>0-10</span>
                        <div className="w-3 h-3 rounded bg-[#00ff00]" />
                        <span>10-20</span>
                        <div className="w-3 h-3 rounded bg-[#ffff00]" />
                        <span>20-30</span>
                        <div className="w-3 h-3 rounded bg-[#ff0000]" />
                        <span>30+</span>
                    </div>
                </div>
            )}
            {modules.wind && (
                <div className="glass rounded-xl p-2 text-xs text-cyan-100">
                    <p className="hud-label hud-label-cyan mb-1">Rüzgar (km/h)</p>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-blue-400" />
                        <span>0-20</span>
                        <div className="w-3 h-3 rounded bg-green-400" />
                        <span>20-40</span>
                        <div className="w-3 h-3 rounded bg-yellow-400" />
                        <span>40-60</span>
                        <div className="w-3 h-3 rounded bg-red-500" />
                        <span>60+</span>
                    </div>
                </div>
            )}
        </div>
    );
}
