'use client';

export default function ScaleBar() {
    return (
        <div
            className="fixed bottom-4 left-4 z-40 glass rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono"
            aria-label="Scale bar"
        >
            <div className="flex items-center gap-2">
                <div className="w-16 h-0.5 bg-gradient-to-r from-cyan-400 to-cyan-600 rounded" />
                <span>~500 km</span>
            </div>
        </div>
    );
}
