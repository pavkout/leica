// Try Before You Buy (feature #19): framing and practical consequences of a
// lens before buying it. Pure. Framing is calculated from focal length, frame
// size and distance (thin lens); warnings are factual consequences only — no
// recommendations.

import { framelinesFor, isAdapted, type Body, type Lens } from "../data/gear";

/** The focal lengths the trial strip always offers, when the camera takes a lens of that length. */
export const TRIAL_FOCALS = [28, 35, 50, 75, 90];

/** Width × height of the scene covered at `distanceMm`, in mm (thin lens: frame × (d − f) / f). */
export function fieldAtDistance(focalMm: number, distanceMm: number, frameWmm: number, frameHmm: number): { w: number; h: number } {
  const k = (distanceMm - focalMm) / focalMm;
  return { w: frameWmm * k, h: frameHmm * k };
}

/** How far to stand to cover the same scene width with another focal length (inverse of fieldAtDistance). */
export function distanceForField(focalMm: number, fieldWmm: number, frameWmm: number): number {
  return focalMm * (fieldWmm / frameWmm) + focalMm;
}

/** One lens per focal length for the strip: the current lens where it matches, else the first that fits the body. */
export function trialLenses(current: Lens, lenses: Lens[]): Lens[] {
  const focals = [...new Set([...TRIAL_FOCALS.filter((f) => lenses.some((l) => l.focalMm === f)), current.focalMm])].sort((a, b) => a - b);
  return focals.map((f) => (current.focalMm === f ? current : lenses.find((l) => l.focalMm === f)!));
}

export type TrialWarning = { kind: "closest-focus" | "no-framelines" | "adapter"; text: string };

/** Factual consequences of using `lens` on `body` at `distanceMm`. */
export function trialWarnings(lens: Lens, body: Body, distanceMm: number, formatDistance: (mm: number) => string): TrialWarning[] {
  const w: TrialWarning[] = [];
  if (distanceMm < lens.minFocusMm) {
    w.push({ kind: "closest-focus", text: `Closest focus is ${formatDistance(lens.minFocusMm)}; it can't focus at ${formatDistance(distanceMm)}.` });
  }
  if (body.rangefinder && !framelinesFor(body, lens.focalMm)) {
    w.push({ kind: "no-framelines", text: `The ${body.name}'s finder has no ${lens.focalMm} mm frame lines: frame with an accessory finder or live view.` });
  }
  if (isAdapted(body, lens)) w.push({ kind: "adapter", text: `Fits the ${body.name} through an adapter.` });
  return w;
}

export interface TrialState {
  bodyId: string;
  lensId: string;
  distanceMm: number;
  sceneId: string;
  fNumber?: number;
}

/** Serialise a trial into a share link's query string. */
export function trialQuery(t: TrialState): string {
  const p = new URLSearchParams({ try: "1", body: t.bodyId, lens: t.lensId, d: String(Math.round(t.distanceMm)), scene: t.sceneId });
  if (t.fNumber) p.set("f", String(t.fNumber));
  return `?${p.toString()}`;
}

/** Read a trial back from a query string; null unless it's a complete, well-formed trial link. */
export function parseTrial(search: string): TrialState | null {
  const p = new URLSearchParams(search);
  if (p.get("try") !== "1") return null;
  const bodyId = p.get("body");
  const lensId = p.get("lens");
  const d = Number(p.get("d"));
  const sceneId = p.get("scene");
  if (!bodyId || !lensId || !sceneId || !Number.isFinite(d) || d <= 0) return null;
  const f = Number(p.get("f"));
  return { bodyId, lensId, distanceMm: d, sceneId, ...(Number.isFinite(f) && f > 0 ? { fNumber: f } : {}) };
}
