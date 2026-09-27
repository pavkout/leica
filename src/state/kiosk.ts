// Kiosk mode (feature #20): a presentation layer over the normal app for
// shops and events. This module holds the pure parts — URL config, the
// guided-flow state machine, idle timing, which stored keys a reset wipes —
// plus a local analytics hook. Nothing here knows about retail inventory or
// prices, and nothing is sent over the network.

export interface KioskConfig {
  enabled: boolean;
  /** Inactivity before resetting to the home screen, seconds. */
  idleSec: number;
}

export const DEFAULT_IDLE_SEC = 90;

/** `?kiosk` turns kiosk mode on; `?kiosk=120` also sets the idle timeout (5 s – 1 h). */
export function parseKiosk(search: string): KioskConfig {
  const p = new URLSearchParams(search);
  if (!p.has("kiosk")) return { enabled: false, idleSec: DEFAULT_IDLE_SEC };
  const n = Number(p.get("kiosk"));
  const idleSec = Number.isFinite(n) && n > 0 ? Math.min(3600, Math.max(5, Math.round(n))) : DEFAULT_IDLE_SEC;
  return { enabled: true, idleSec };
}

export type KioskStep = "home" | "body" | "lens" | "try";

export type KioskAction =
  | { type: "start" }
  | { type: "chooseBody"; bodyId: string }
  | { type: "attachLens"; lensId: string }
  | { type: "back" }
  | { type: "tryIt" }
  | { type: "reset" };

export interface KioskState {
  step: KioskStep;
  bodyId: string | null;
  lensId: string | null;
}

export const KIOSK_HOME: KioskState = { step: "home", bodyId: null, lensId: null };

export function kioskReducer(s: KioskState, a: KioskAction): KioskState {
  switch (a.type) {
    case "start":
      return { ...KIOSK_HOME, step: "body" };
    case "chooseBody":
      return { step: "lens", bodyId: a.bodyId, lensId: null };
    case "attachLens":
      return s.step === "lens" && s.bodyId ? { ...s, lensId: a.lensId } : s;
    case "back":
      if (s.step === "lens") return { ...s, step: "body", lensId: null };
      if (s.step === "body") return KIOSK_HOME;
      return s;
    case "tryIt":
      return s.step === "lens" && s.bodyId && s.lensId ? { ...s, step: "try" } : s;
    case "reset":
      return KIOSK_HOME;
  }
}

/** Seconds of warning ("Still there?") before an idle reset. */
export function warningSec(idleSec: number): number {
  return Math.min(10, Math.floor(idleSec / 3));
}

export function idlePhase(lastActivityMs: number, nowMs: number, idleSec: number): { phase: "active" | "warning" | "reset"; secondsLeft: number } {
  const left = idleSec - (nowMs - lastActivityMs) / 1000;
  if (left <= 0) return { phase: "reset", secondsLeft: 0 };
  if (left <= warningSec(idleSec)) return { phase: "warning", secondsLeft: Math.ceil(left) };
  return { phase: "active", secondsLeft: Math.ceil(left) };
}

/** Venue settings that survive a reset; everything else the app stored belongs to the visitor. */
export const KIOSK_KEEP_KEYS = ["rangefinder-muted"];

export function keysToClear(keys: string[]): string[] {
  return keys.filter((k) => k.startsWith("rangefinder") && !KIOSK_KEEP_KEYS.includes(k));
}

export type KioskEventType = "session_start" | "body_selected" | "lens_attached" | "try_it" | "start_over" | "idle_reset";

export interface KioskEvent {
  type: KioskEventType;
  at: number;
  bodyId?: string;
  lensId?: string;
}

type AnalyticsHook = (e: KioskEvent) => void;

/**
 * Analytics hook for event deployments: dispatches a `rangefinder-kiosk`
 * DOM event and, if the venue page defines `window.rangefinderKioskAnalytics`,
 * calls it. The app itself collects and sends nothing.
 */
export function emitKioskEvent(type: KioskEventType, detail: { bodyId?: string; lensId?: string } = {}) {
  if (typeof window === "undefined") return;
  const e: KioskEvent = { type, at: Date.now(), ...detail };
  window.dispatchEvent(new CustomEvent("rangefinder-kiosk", { detail: e }));
  const hook = (window as unknown as { rangefinderKioskAnalytics?: AnalyticsHook }).rangefinderKioskAnalytics;
  if (typeof hook === "function") {
    try {
      hook(e);
    } catch {
      // A venue's analytics must never break the kiosk.
    }
  }
}
