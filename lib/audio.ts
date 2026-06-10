/* ─── Web Audio API Telemetry Synth Beeps ─── */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

export function playBeep(type: 'click' | 'radar' | 'search' | 'iss' = 'click') {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'click') {
            // Short high-tech click sound (cyber click)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now); // A5
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.05); // Slide up to A6
            gainNode.gain.setValueAtTime(0.015, now); // Extremely subtle volume
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'search') {
            // Success sweep (double electronic chime)
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(783.99, now + 0.08); // G5
            gainNode.gain.setValueAtTime(0.02, now);
            gainNode.gain.setValueAtTime(0.02, now + 0.08);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'radar') {
            // Sonar radar sweep (expanding ping)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now); // A4
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.4); // Slide down
            gainNode.gain.setValueAtTime(0.012, now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'iss') {
            // Space telemetry pulse
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(660, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
            gainNode.gain.setValueAtTime(0.014, now);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        }
    } catch {
        /* User interaction might be required to play audio, ignore silently */
    }
}
