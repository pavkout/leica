import { useSyncExternalStore } from "react";
import { GENERIC_BLADES } from "../../preview/aperture";

// The screen transition, drawn as the lens's aperture iris: it closes over
// the old screen, the screen changes while it's shut, and it opens on the new
// one. Taking a picture blinks it. The state lives outside the app's React
// state, so animating it re-renders only the iris.

export type IrisPhase = "idle" | "closing" | "closed" | "opening";

export interface IrisTiming {
  close: number;
  hold: number;
  open: number;
}

/** Changing screens, ms: quick and crisp. */
export const PAGE_TIMING: IrisTiming = { close: 200, hold: 40, open: 230 };
/** Taking a picture, ms: a blink. */
export const SHOT_TIMING: IrisTiming = { close: 70, hold: 0, open: 130 };
/** A whole page transition, for anything that waits for the new screen. */
export const PAGE_TRANSITION_MS = PAGE_TIMING.close + PAGE_TIMING.hold + PAGE_TIMING.open;

export interface IrisState {
  phase: IrisPhase;
  /** performance.now() when the phase began. */
  at: number;
  /** Openness (0 shut – 1 open) when the phase began. */
  from: number;
  /** Length of the phase, ms. */
  dur: number;
  /** Blade count, from the chosen lens. */
  blades: number;
}

let state: IrisState = { phase: "idle", at: 0, from: 1, dur: 0, blades: GENERIC_BLADES };
const listeners = new Set<() => void>();
let timers: number[] = [];
let pending: (() => void) | null = null;
/** Bumped on every cycle, so a superseded cycle's frame callbacks do nothing. */
let generation = 0;

function set(next: Partial<IrisState>) {
  state = { ...state, ...next };
  // Dev-only probe: the phase, for the transition tests.
  if (import.meta.env.DEV) (window as unknown as { __leicaIris?: IrisState }).__leicaIris = state;
  listeners.forEach((l) => l());
}

const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** How open the iris is at `now`: 1 is fully open (screen visible), 0 shut. */
export function openness(s: IrisState, now: number): number {
  const t = s.dur > 0 ? Math.min(1, Math.max(0, (now - s.at) / s.dur)) : 1;
  switch (s.phase) {
    case "closing":
      return s.from * (1 - easeIn(t));
    case "closed":
      return 0;
    case "opening":
      return s.from + (1 - s.from) * easeOut(t);
    default:
      return 1;
  }
}

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Closes the iris, runs `onClosed` while it's shut, then opens it. A new
 * request while it's still closing just replaces what happens once shut; one
 * while it opens closes it again from where it is. Reduced motion: `onClosed`
 * runs straight away, with no iris.
 */
export function irisCycle(onClosed: () => void, timing: IrisTiming = PAGE_TIMING) {
  if (reducedMotion() || typeof window === "undefined") {
    onClosed();
    return;
  }
  if (state.phase === "closing") {
    pending = onClosed;
    return;
  }
  // Dev-only slow motion, for looking at the frames (window.__leicaIrisSlow = 10).
  const slow = import.meta.env.DEV ? Number((window as unknown as { __leicaIrisSlow?: number }).__leicaIrisSlow) || 1 : 1;
  if (slow !== 1) timing = { close: timing.close * slow, hold: timing.hold * slow, open: timing.open * slow };
  timers.forEach(clearTimeout);
  timers = [];
  generation++;
  pending = onClosed;
  const now = performance.now();
  const from = openness(state, now);
  const close = timing.close * from;
  set({ phase: "closing", at: now, from, dur: close });
  timers.push(
    window.setTimeout(() => {
      set({ phase: "closed", at: performance.now(), from: 0, dur: timing.hold });
      const run = pending;
      pending = null;
      run?.();
      // Open once the new screen has painted twice, so its first (heaviest) frame happens behind the blades.
      const gen = ++generation;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (gen !== generation) return;
          timers.push(
            window.setTimeout(() => {
              set({ phase: "opening", at: performance.now(), from: 0, dur: timing.open });
              timers.push(window.setTimeout(() => set({ phase: "idle", from: 1, dur: 0 }), timing.open));
            }, timing.hold),
          );
        }),
      );
    }, close),
  );
}

/** Opening the app, ms: the lens opens once, slowly enough to be seen, never long enough to wait for. */
export const POWER_ON_TIMING = { hold: 320, open: 900 };

/**
 * The first look: the app starts behind a shut iris that opens on the camera.
 * Runs once per page load, before the first render; silent (sound never
 * autoplays); skipped under reduced motion.
 */
export function irisPowerOn() {
  if (reducedMotion() || typeof window === "undefined") return;
  generation++;
  set({ phase: "closed", at: performance.now(), from: 0, dur: POWER_ON_TIMING.hold });
  const gen = generation;
  timers.push(
    window.setTimeout(() => {
      if (gen !== generation) return;
      set({ phase: "opening", at: performance.now(), from: 0, dur: POWER_ON_TIMING.open });
      timers.push(window.setTimeout(() => gen === generation && set({ phase: "idle", from: 1, dur: 0 }), POWER_ON_TIMING.open));
    }, POWER_ON_TIMING.hold),
  );
}

/** A transition is running. */
export function irisActive() {
  return state.phase !== "idle";
}

/** The shutter blink when a picture is taken. */
export function irisBlink() {
  irisCycle(() => {}, SHOT_TIMING);
}

/** The iris follows the chosen lens. */
export function setIrisBlades(blades: number) {
  if (blades !== state.blades) set({ blades });
}

export function useIris(): IrisState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
