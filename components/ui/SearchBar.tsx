'use client';

import { searchCity } from '@/lib/api';
import type { GeoCity } from '@/types';
import { useEffect, useRef, useState } from 'react';

interface Props {
    onSelect: (city: GeoCity) => void;
}

export default function SearchBar({ onSelect }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeoCity[]>([]);
    const [open, setOpen] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleInput = (value: string) => {
        setQuery(value);
        clearTimeout(timerRef.current);
        if (value.length < 2) { setResults([]); setOpen(false); return; }
        timerRef.current = setTimeout(async () => {
            try {
                const cities = await searchCity(value);
                setResults(cities);
                setOpen(cities.length > 0);
            } catch { setResults([]); }
        }, 350);
    };

    const handleSelect = (city: GeoCity) => {
        setQuery(city.name);
        setOpen(false);
        onSelect(city);
    };

    return (
        <div ref={wrapperRef} className="relative z-50">
            <input
                type="search"
                value={query}
                onChange={e => handleInput(e.target.value)}
                placeholder="Şehir ara..."
                className="w-56 bg-black/70 backdrop-blur text-cyan-100 text-sm rounded-lg px-3 py-2 border border-cyan-900/50 focus:border-cyan-500 focus:outline-none placeholder-gray-500"
                aria-label="Search city"
                autoComplete="off"
            />
            {open && results.length > 0 && (
                <ul className="absolute top-full mt-1 w-full bg-black/90 backdrop-blur rounded-lg border border-cyan-900/50 max-h-60 overflow-y-auto">
                    {results.map((city, i) => (
                        <li key={`${city.name}-${city.latitude}-${i}`}>
                            <button
                                type="button"
                                onClick={() => handleSelect(city)}
                                className="w-full text-left px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-900/40 transition-colors"
                            >
                                <span className="font-medium">{city.name}</span>
                                {city.country && (
                                    <span className="text-gray-500 ml-1 text-xs">({city.country})</span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
