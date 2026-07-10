/* ═══════════════════════════════════════════════════════════════
   Faz 1 / Madde 4: Skeleton Loader Components
   Mikro-ilerleme geri bildirimi — veri yüklenirken panel iskeletleri
   ═══════════════════════════════════════════════════════════════ */

interface SkeletonProps {
    /** Variant: 'weather' | 'detail' | 'line' */
    variant?: 'weather' | 'detail' | 'line';
    /** Number of skeleton rows for 'line' variant */
    rows?: number;
}

function Bone({ className = '', width = '100%' }: { className?: string; width?: string }) {
    return (
        <div
            className={`rounded-md bg-gradient-to-r from-cyan-900/20 via-cyan-800/10 to-cyan-900/20 animate-skeleton-shimmer ${className}`}
            style={{ width, backgroundSize: '200% 100%' }}
        />
    );
}

/** Skeleton for WeatherPanel loading state */
function WeatherSkeleton() {
    return (
        <div className="glass rounded-xl p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Bone className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                    <Bone className="h-5" width="60%" />
                    <Bone className="h-3" width="40%" />
                </div>
            </div>
            {/* Data rows */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Bone key={i} className="h-3" width={i % 2 === 0 ? '55%' : '35%'} />
                ))}
            </div>
        </div>
    );
}

/** Skeleton for LocationDetailPanel loading state */
function DetailSkeleton() {
    return (
        <div className="glass-elevated rounded-2xl p-4 space-y-3 border border-cyan-500/20">
            {/* Location header */}
            <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1.5">
                    <Bone className="h-5" width="75%" />
                    <Bone className="h-3" width="45%" />
                </div>
                <Bone className="w-5 h-5 rounded shrink-0 ml-3" />
            </div>
            {/* Time bar */}
            <Bone className="h-12 rounded-xl" />
            {/* Weather display */}
            <div className="flex items-center gap-3">
                <Bone className="w-10 h-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                    <Bone className="h-6" width="35%" />
                    <Bone className="h-3" width="60%" />
                </div>
            </div>
            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-2 pt-2">
                {Array.from({ length: 16 }).map((_, i) => (
                    <Bone key={i} className="h-3" width={i % 2 === 0 ? '60%' : '30%'} />
                ))}
            </div>
            {/* Charts placeholder */}
            <Bone className="h-16 rounded-xl mt-2" />
            <Bone className="h-16 rounded-xl" />
            {/* Forecast cards */}
            <div className="flex gap-1.5 pt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Bone key={i} className="h-20 w-14 rounded-xl shrink-0" />
                ))}
            </div>
        </div>
    );
}

/** Generic line-based skeleton */
function LineSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-2 p-2">
            {Array.from({ length: rows }).map((_, i) => (
                <Bone
                    key={i}
                    className="h-3"
                    width={`${60 + Math.random() * 30}%`}
                />
            ))}
        </div>
    );
}

export default function SkeletonLoader({ variant = 'weather', rows = 4 }: SkeletonProps) {
    switch (variant) {
        case 'weather': return <WeatherSkeleton />;
        case 'detail':  return <DetailSkeleton />;
        case 'line':    return <LineSkeleton rows={rows} />;
        default:        return <WeatherSkeleton />;
    }
}
