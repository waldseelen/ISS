/* Shared pulse math — used by GlobeCanvas & MapCanvas for synchronized,
   but visually distinct, dot animations. Keeping the math centralized prevents
   drift between the two views (critique #20-23). */

const TWO_PI = Math.PI * 2;

/* Cursor/selection: slow, gentle breathing (~0.5 Hz, period 2s) */
export const CURSOR_PULSE_HZ = 0.5;
export const CURSOR_PULSE_AMP = 8;
export const CURSOR_PULSE_BASE = 18;

export function pulseRadius(timeSec: number, hz: number, amp: number, base: number): number {
    return base + amp * Math.sin(timeSec * TWO_PI * hz);
}

/* Clamp a tile-frame delta so a tab returning from background doesn't
   catapult the pulse to a giant radius. */
export function clampFrameDelta(deltaSec: number, maxDelta = 0.1): number {
    return Math.min(deltaSec, maxDelta);
}
