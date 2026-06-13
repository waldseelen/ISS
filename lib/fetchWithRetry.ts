/* ═══════════════════════════════════════════════════════════════
   Faz 1 / Madde 1+5: Robust Fetch with Exponential Backoff,
   Rate-Limiting, Request Queuing & Response Validation
   ═══════════════════════════════════════════════════════════════ */

const FETCH_OPTS: RequestInit = { mode: 'cors', credentials: 'omit' };

/**
 * Per-hostname concurrency tracker.
 * Prevents the browser from firing 30+ simultaneous requests to
 * rate-limited open APIs like Open-Meteo or Nominatim.
 */
const hostConcurrency = new Map<string, number>();
const MAX_CONCURRENT_PER_HOST = 4;
const pendingQueue: Array<{
    url: string;
    resolve: (v: boolean) => void;
}> = [];

function getHost(url: string): string {
    try { return new URL(url).hostname; } catch { return 'unknown'; }
}

function acquireSlot(url: string): boolean {
    const host = getHost(url);
    const current = hostConcurrency.get(host) ?? 0;
    if (current >= MAX_CONCURRENT_PER_HOST) return false;
    hostConcurrency.set(host, current + 1);
    return true;
}

function releaseSlot(url: string): void {
    const host = getHost(url);
    const current = hostConcurrency.get(host) ?? 1;
    hostConcurrency.set(host, Math.max(0, current - 1));
    // Drain queue for this host
    for (let i = 0; i < pendingQueue.length; i++) {
        if (getHost(pendingQueue[i].url) === host) {
            const entry = pendingQueue.splice(i, 1)[0];
            entry.resolve(true);
            break;
        }
    }
}

function waitForSlot(url: string): Promise<boolean> {
    if (acquireSlot(url)) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
        pendingQueue.push({ url, resolve });
    });
}

/** Options for the resilient fetcher */
export interface FetchRetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Base delay in ms before first retry (default: 500) */
    baseDelay?: number;
    /** Maximum delay cap in ms (default: 8000) */
    maxDelay?: number;
    /** AbortSignal from caller */
    signal?: AbortSignal;
    /** If true, throws on failure instead of returning null (default: false) */
    throwOnFail?: boolean;
    /** Expected response type ('json' or 'text') (default: 'json') */
    responseType?: 'json' | 'text';
}

/**
 * Fetches a URL with:
 *  - Per-host concurrency limiting (max 4 in-flight per domain)
 *  - Exponential backoff retries with jitter
 *  - HTTP 429 / 5xx automatic retry
 *  - CORS error resilience
 *
 * Returns the parsed JSON or `null` on terminal failure.
 */
export async function fetchWithRetry<T = unknown>(
    url: string,
    opts: FetchRetryOptions = {},
): Promise<T | null> {
    const {
        maxRetries = 3,
        baseDelay = 500,
        maxDelay = 8000,
        signal,
        throwOnFail = false,
        responseType = 'json',
    } = opts;

    // Wait until a slot opens for this host
    await waitForSlot(url);

    let lastError: Error | null = null;

    try {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (signal?.aborted) return null;

            try {
                const res = await fetch(url, { ...FETCH_OPTS, signal });

                // --- Retryable HTTP errors ---
                if (res.status === 429 || res.status >= 500) {
                    const retryAfter = res.headers.get('Retry-After');
                    const waitMs = retryAfter
                        ? parseInt(retryAfter, 10) * 1000
                        : Math.min(baseDelay * 2 ** attempt + Math.random() * 300, maxDelay);

                    if (attempt < maxRetries) {
                        await sleep(waitMs, signal);
                        continue;
                    }
                    lastError = new Error(`HTTP ${res.status} after ${maxRetries + 1} attempts: ${url}`);
                    break;
                }

                // --- Non-retryable HTTP errors (4xx except 429) ---
                if (!res.ok) {
                    lastError = new Error(`HTTP ${res.status}: ${url}`);
                    break;
                }

                // --- Parse response safely ---
                const text = await res.text();
                if (responseType === 'text') {
                    return text as unknown as T;
                }
                try {
                    return JSON.parse(text) as T;
                } catch {
                    lastError = new Error(`Invalid JSON from ${url}: ${text.slice(0, 120)}`);
                    break;
                }
            } catch (err: unknown) {
                // Network / CORS / timeout errors → retry
                lastError = err instanceof Error ? err : new Error(String(err));
                if (attempt < maxRetries) {
                    const waitMs = Math.min(baseDelay * 2 ** attempt + Math.random() * 300, maxDelay);
                    await sleep(waitMs, signal);
                    continue;
                }
            }
        }
    } finally {
        releaseSlot(url);
    }

    if (throwOnFail && lastError) throw lastError;
    return null;
}

/** Validates that `value` is a real number (not NaN, not Infinity, not null) */
export function safeNum(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const n = parseFloat(value);
        if (Number.isFinite(n)) return n;
    }
    return fallback;
}

/** Validates that `value` is a non-empty string */
export function safeStr(value: unknown, fallback = ''): string {
    if (typeof value === 'string' && value.length > 0) return value;
    return fallback;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const id = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => { clearTimeout(id); resolve(); }, { once: true });
    });
}
