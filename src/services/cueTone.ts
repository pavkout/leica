// Cue tones and vibration for the timers (#46, #52): short, distinct beeps a
// darkroom worker can tell apart without looking. Web Audio, created on the
// first tap (browsers only allow sound after a gesture); silent and harmless
// where audio or vibration isn't available.

import { isMuted } from "../audio/sounds";

let ctx: AudioContext | null = null;

/** Call from a tap, so later cues are allowed to sound. */
export function unlockTones(): void {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    ctx = null;
  }
}

const PATTERNS = {
  /** Agitate: two quick high beeps. */
  agitate: [880, 0, 880],
  /** Rest: one low beep. */
  rest: [440],
  /** Start pouring out: three beeps. */
  drain: [660, 0, 660, 0, 660],
  /** Next step: a rising pair. */
  next: [523, 784],
  /** Done: a longer rising three. */
  done: [523, 659, 784],
} as const;

export type ToneKind = keyof typeof PATTERNS;

export function playTone(kind: ToneKind): void {
  try {
    navigator.vibrate?.(kind === "agitate" ? [120, 80, 120] : kind === "drain" ? [200, 100, 200, 100, 200] : kind === "done" ? [400] : [150]);
  } catch {
    // No vibration here.
  }
  if (!ctx || isMuted()) return;
  const step = 0.14;
  PATTERNS[kind].forEach((freq, i) => {
    if (!freq || !ctx) return;
    const t0 = ctx.currentTime + i * step;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + step * 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + step);
  });
}
