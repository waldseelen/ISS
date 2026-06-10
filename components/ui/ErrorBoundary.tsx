'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-6 z-50">
                    <div className="glass-elevated rounded-2xl p-6 max-w-sm border border-red-500/30 shadow-lg shadow-red-900/10">
                        <span className="text-4xl block mb-3">⚠️</span>
                        <h2 className="text-base font-bold text-red-400 mb-2 font-mono">Bileşen Hatası</h2>
                        <p className="text-xs text-gray-400 mb-4 leading-relaxed font-mono">
                            Harita veya WebGL tuvali yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin veya tarayıcınızın grafik hızlandırıcısını kontrol edin.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-red-950/40 border border-red-500/40 hover:bg-red-900/30 text-red-200 text-xs font-mono rounded-lg transition-colors"
                        >
                            Yeniden Yükle
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
