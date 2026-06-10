import type { WindPoint } from '@/types';

/**
 * Bilinear/IDW (Inverse Distance Weighting) interpolation of wind speed and direction
 * at any given geographic lat/lon.
 */
export function getWindVectorAt(lat: number, lon: number, wind: WindPoint[]): { speed: number; direction: number } {
    if (wind.length === 0) return { speed: 0, direction: 0 };
    
    let totalWeight = 0;
    let sumSpeed = 0;
    let sumDirX = 0;
    let sumDirY = 0;
    const DEG = Math.PI / 180;

    // Use 4-nearest-neighbor IDW for high performance and smooth interpolation
    for (const p of wind) {
        const d2 = (lat - p.lat) ** 2 + (lon - p.lon) ** 2 + 1e-6;
        const weight = 1 / d2;
        sumSpeed += p.speed * weight;
        sumDirX += Math.cos(p.direction * DEG) * weight;
        sumDirY += Math.sin(p.direction * DEG) * weight;
        totalWeight += weight;
    }

    if (totalWeight === 0) return { speed: 0, direction: 0 };

    const avgSpeed = sumSpeed / totalWeight;
    const avgDir = (Math.atan2(sumDirY, sumDirX) / DEG + 360) % 360;

    return { speed: avgSpeed, direction: avgDir };
}

export interface WindTrajectory {
    path: [number, number][]; // [lon, lat][]
    timestamps: number[];
    speed: number;
}

/**
 * Traces thousands of dynamic wind particle paths frame-by-frame in coordinate space
 * to be processed in parallel by Deck.gl's GPU TripsLayer.
 */
export function generateWindPaths(wind: WindPoint[], particleCount = 1800, maxSteps = 12): WindTrajectory[] {
    if (wind.length === 0) return [];

    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
    for (const p of wind) {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLon = Math.min(minLon, p.lon);
        maxLon = Math.max(maxLon, p.lon);
    }

    // Safeguard bounds
    const latSpan = maxLat - minLat || 10;
    const lonSpan = maxLon - minLon || 10;

    const paths: WindTrajectory[] = [];
    const DEG = Math.PI / 180;

    for (let i = 0; i < particleCount; i++) {
        let lat = minLat - 2 + Math.random() * (latSpan + 4);
        let lon = minLon - 2 + Math.random() * (lonSpan + 4);

        const path: [number, number][] = [];
        const timestamps: number[] = [];
        let speedSum = 0;

        for (let t = 0; t < maxSteps; t++) {
            path.push([lon, lat]);
            timestamps.push(t);

            const vec = getWindVectorAt(lat, lon, wind);
            speedSum += vec.speed;

            // Coordinated step size scaled to wind speed
            const step = vec.speed * 0.0006;
            lat += Math.cos(vec.direction * DEG) * step;
            lon += Math.sin(vec.direction * DEG) * step;
        }

        paths.push({
            path,
            timestamps,
            speed: speedSum / maxSteps,
        });
    }

    return paths;
}

/**
 * Maps wind speed to a premium, harmonized color array for Deck.gl [r, g, b].
 */
export function getWindColor(speed: number): [number, number, number] {
    if (speed < 10) return [96, 165, 250]; // Soft blue
    if (speed < 20) return [52, 211, 153]; // Emerald green
    if (speed < 45) return [251, 191, 36]; // Amber yellow
    if (speed < 65) return [249, 115, 22]; // Vivid orange
    return [239, 68, 68]; // Crimson red (storm)
}

/* Shared between wind + rain so we don't trace two particle systems
   (critique #30). Returns the same paths; callers can shift the color
   and timestamp offset. */
export function getOrGenerateWindPaths(
    wind: WindPoint[],
    windEnabled: boolean,
    rainEnabled: boolean,
    cached: WindTrajectory[],
    setCached: (next: WindTrajectory[]) => void,
) {
    if (!windEnabled && !rainEnabled) return { paths: [] as WindTrajectory[], cacheHit: true };
    if (wind.length === 0) return { paths: [] as WindTrajectory[], cacheHit: true };
    if (cached.length > 0) return { paths: cached, cacheHit: true };
    const paths = generateWindPaths(wind, 1800, 12);
    setCached(paths);
    return { paths, cacheHit: false };
}
