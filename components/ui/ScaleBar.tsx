'use client';

export default function ScaleBar() {
    return (
        <div
            className="fixed bottom-20 left-4 z-40 bg-black/70 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono"
            aria-label="Scale bar"
        >
            <div className="flex items-center gap-2">
                <div className="w-16 h-0.5 bg-cyan-400 rounded" />
                <span>~500 km</span>
            </div>
        </div>
    );
}
