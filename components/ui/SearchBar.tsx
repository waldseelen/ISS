'use client';

import { searchCity } from '@/lib/api';
import type { GeoCity } from '@/types';
import { useEffect, useRef, useState } from 'react';

interface Props {
    onSelect: (city: GeoCity) => void;
}

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

export default function SearchBar({ onSelect }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeoCity[]>([]);
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<SearchStatus>('idle');
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

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
        if (value.length < 2) { setResults([]); setOpen(false); setStatus('idle'); return; }
        setStatus('loading');
        timerRef.current = setTimeout(async () => {
            // Cancel previous request
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();
            try {
                const cities = await searchCity(value);
                setResults(cities);
                setOpen(cities.length > 0);
                setStatus(cities.length > 0 ? 'success' : 'error');
            } catch {
                setResults([]);
                setStatus('error');
            }
        }, 300);
    };

    const handleSelect = (city: GeoCity) => {
        setQuery(city.name);
        setOpen(false);
        setStatus('idle');
        onSelect(city);
    };

    const statusIcon = status === 'loading' ? '⏳' : status === 'success' ? '✓' : status === 'error' ? '✗' : '';

    return (
        <div ref={wrapperRef} className="relative z-50">
            <div className="relative">
                <input
                    type="search"
                    value={query}
                    onChange={e => handleInput(e.target.value)}
                    placeholder="Şehir ara..."
                    className="w-56 glass text-cyan-100 text-sm rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none focus:shadow-lg focus:shadow-cyan-900/20 placeholder-gray-500 transition-all duration-200 font-mono"
                    aria-label="Search city"
                    autoComplete="off"
                />
                {statusIcon && (
                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${status === 'success' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-gray-400'}`}
                        aria-label={`Search ${status}`}>
                        {statusIcon}
                    </span>
                )}
            </div>
            {open && results.length > 0 && (
                <ul className="absolute top-full mt-1 w-full glass-elevated rounded-lg max-h-60 overflow-y-auto shadow-lg shadow-cyan-900/10">
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
                                {city.admin1 && (
                                    <span className="text-gray-600 ml-1 text-[10px]">{city.admin1}</span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
