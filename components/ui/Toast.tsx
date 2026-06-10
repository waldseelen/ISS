'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface Toast {
    id: number;
    message: string;
    type: 'error' | 'info' | 'success';
}

interface ToastContextType {
    addToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export const useToast = () => useContext(ToastContext);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: Toast['type'] = 'error') => {
        const id = nextId++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`pointer-events-auto px-4 py-2 rounded-lg text-xs font-mono shadow-lg backdrop-blur-md animate-fade-in ${
                            t.type === 'error' 
                                ? 'bg-red-900/80 border border-red-500/40 text-red-200' 
                                : t.type === 'success'
                                ? 'bg-green-900/80 border border-green-500/40 text-green-200'
                                : 'bg-cyan-900/80 border border-cyan-500/40 text-cyan-200'
                        }`}
                    >
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
