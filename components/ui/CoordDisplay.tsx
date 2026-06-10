'use client';

import { useEffect, useRef } from 'react';

interface Props {
    lat: number | null;
    lon: number | null;
}

export default function CoordDisplay({ lat, lon }: Props) {
    const elRef = useRef<HTMLDivElement>(null);
    const prevRef = useRef<string>('');

    useEffect(() => {
        if (lat === null || lon === null) return;
        const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        if (key === prevRef.current || !elRef.current) return;
        prevRef.current = key;
        const el = elRef.current;
        el.classList.remove('coord-flash');
        el.getAnimations().forEach(a => a.cancel());
        void el.offsetWidth;
        el.classList.add('coord-flash');
    }, [lat, lon]);

    if (lat === null || lon === null) return null;
    return (
        <div
            ref={elRef}
            className="fixed bottom-4 right-4 z-40 glass rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300"
            aria-label="Coordinates"
        >
            {lat.toFixed(4)}°, {lon.toFixed(4)}°
        </div>
    );
}
