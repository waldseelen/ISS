'use client';

import { useEffect, useState } from 'react';
import { playBeep } from '@/lib/audio';

export interface Bookmark {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

interface Props {
    onFlyTo: (lat: number, lon: number) => void;
    // We can pass an trigger state to tell this panel to reload bookmarks when a bookmark is added/removed elsewhere
    refreshTrigger: number;
}

export default function BookmarksPanel({ onFlyTo, refreshTrigger }: Props) {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

    const loadBookmarks = () => {
        if (typeof window === 'undefined') return;
        try {
            const saved = localStorage.getItem('earth_tracker_bookmarks');
            if (saved) {
                setBookmarks(JSON.parse(saved));
            } else {
                setBookmarks([]);
            }
        } catch {
            setBookmarks([]);
        }
    };

    useEffect(() => {
        loadBookmarks();
    }, [refreshTrigger]);

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        playBeep('click');
        const next = bookmarks.filter(b => b.id !== id);
        setBookmarks(next);
        localStorage.setItem('earth_tracker_bookmarks', JSON.stringify(next));
    };

    const handleSelect = (b: Bookmark) => {
        playBeep('search');
        onFlyTo(b.latitude, b.longitude);
    };

    if (bookmarks.length === 0) return null;

    return (
        <div className="glass rounded-xl p-4 text-xs text-cyan-100 space-y-3 border border-cyan-500/10">
            <div className="flex items-center gap-2 border-b border-cyan-900/50 pb-2">
                <span className="text-base">📌</span>
                <span className="font-semibold text-cyan-300 uppercase tracking-wider font-mono">
                    Yer İmleri & Favoriler
                </span>
            </div>

            <div className="space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-thin">
                {bookmarks.map(b => (
                    <div
                        key={b.id}
                        onClick={() => handleSelect(b)}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-cyan-950/25 border border-cyan-900/30 hover:bg-cyan-900/15 hover:border-cyan-500/20 cursor-pointer transition-all duration-300"
                    >
                        <div className="min-w-0 flex-1 pr-2">
                            <p className="font-semibold text-cyan-100 truncate text-[11px]">
                                {b.name}
                            </p>
                            <p className="text-[9px] text-cyan-100/40 font-mono mt-0.5 truncate">
                                {b.latitude.toFixed(3)}°, {b.longitude.toFixed(3)}°
                            </p>
                        </div>
                        <button
                            onClick={(e) => handleDelete(b.id, e)}
                            className="text-red-400/50 hover:text-red-400 transition-colors w-5 h-5 flex items-center justify-center text-sm"
                            aria-label={`${b.name} konumunu sil`}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
