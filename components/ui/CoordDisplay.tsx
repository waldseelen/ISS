'use client';

interface Props {
    lat: number | null;
    lon: number | null;
}

export default function CoordDisplay({ lat, lon }: Props) {
    if (lat === null || lon === null) return null;
    return (
        <div
            className="fixed bottom-20 right-4 z-40 bg-black/70 backdrop-blur rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300"
            aria-label="Coordinates"
        >
            {lat.toFixed(4)}°, {lon.toFixed(4)}°
        </div>
    );
}
