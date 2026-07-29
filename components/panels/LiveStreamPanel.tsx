'use client';

import { t } from '@/lib/api';

/* NASA'nın resmi kanalı — "Live Video from the International Space Station".
   Public /embed/ gömmesi API anahtarı veya hesap gerektirmez. */
const NASA_CHANNEL_ID = 'UCLA_DiR1FfKNvjuUpBHmylQ';
const EMBED_URL = `https://www.youtube.com/embed/live_stream?channel=${NASA_CHANNEL_ID}&autoplay=0`;

export default function LiveStreamPanel() {
    return (
        <div className="glass rounded-xl p-4 text-sm text-cyan-100 space-y-2" role="region" aria-label="ISS live stream">
            <div className="hud-label hud-label-cyan text-[10px] border-b border-cyan-900/50 pb-2">
                📡 {t('issStreamTitle')}
            </div>

            <div className="relative w-full overflow-hidden rounded-lg bg-black/60" style={{ aspectRatio: '16 / 9' }}>
                <iframe
                    src={EMBED_URL}
                    title={t('issStreamTitle')}
                    className="absolute inset-0 w-full h-full border-0"
                    loading="lazy"
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                />
            </div>

            <p className="text-[10px] text-cyan-100/40">{t('issStreamNote')}</p>
        </div>
    );
}
