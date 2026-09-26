// Pure maths for the 3D camera (feature #2), kept free of three.js so it's
// unit-testable and shared by any model source — the procedural meshes now,
// licensed GLB models later. The optical state stays the source of truth;
// everything here maps that state onto a physical pose.

import type { Lens } from "../data/gear";
import { apertureStops, isFullStop } from "../data/gear";
import { stopsDown } from "../preview/aperture";
import type { Provenance } from "../data/provenance";

/**
 * Named parts a camera/lens model must expose so the animator can drive it.
 * The procedural meshes use these names, and a GLB swapped in later must
 * name its nodes the same (with pivots on the real rotation axis).
 */
export const RIG_PARTS = {
  apertureRing: "aperture-ring",
  focusRing: "focus-ring",
  iris: "iris",
  shutterDial: "shutter-dial",
  advanceLever: "advance-lever",
} as const;

/** userData for parts that rotate about their local Y axis. One shared object, so re-renders never look like prop changes. */
export const AXIS_Y = Object.freeze({ axis: "y" as const });

export const MODEL_PROVENANCE: Provenance = {
  kind: "illustrative",
  notes:
    "Procedural stand-in, not a scan or a licensed model: lens length and diameter come from the catalogue's approximate sizes, body proportions are generic M-body proportions, and ring, dial and lever travel are illustrative. The iris uses the same outline as the 2D iris and the bokeh; focus-ring rotation follows the lens's real extension (f²/(d−f)) scaled to an illustrative throw.",
};

/** Generic M-body envelope, metres. Illustrative, not a specific model's dimensions. */
export const BODY = { width: 0.138, height: 0.077, depth: 0.035, topPlate: 0.018, basePlate: 0.003 };

/** Where the lens mount sits on the body's front face. */
export const MOUNT_CENTER: [number, number, number] = [0, -0.007, BODY.depth / 2];

/** Ring travel per stop. Real Leica rings aren't evenly spaced; this is an illustrative uniform scale. */
export const RING_RAD_PER_STOP = (15 * Math.PI) / 180;

/** Aperture ring rotation about the lens axis, in radians: 0 wide open, growing as the lens stops down. */
export function apertureRingAngle(lens: Lens, fNumber: number): number {
  return stopsDown(lens, fNumber) * RING_RAD_PER_STOP;
}

/**
 * The engraved marks on the aperture ring, each at the angle (relative to the
 * ring) that brings it under the index when that stop is set: the wide-open
 * value plus every full stop the lens reaches.
 */
export function apertureRingMarks(lens: Lens): { label: string; angle: number }[] {
  return apertureStops(lens)
    .filter((n, i) => i === 0 || isFullStop(n))
    .map((n) => ({ label: String(n), angle: -apertureRingAngle(lens, n) }));
}

/** Focus-ring travel from infinity to the closest distance. Leica doesn't publish throws; illustrative. */
export const FOCUS_THROW_RAD = (100 * Math.PI) / 180;

/** Helicoid extension needed to focus at `focusMm` (thin-lens f²/(d−f)); 0 at infinity. */
function extensionMm(focalMm: number, focusMm: number) {
  return Number.isFinite(focusMm) ? (focalMm * focalMm) / Math.max(focusMm - focalMm, 1e-6) : 0;
}

/**
 * Focus ring rotation: 0 at infinity, FOCUS_THROW_RAD at the closest
 * distance. A helicoid turns in proportion to extension, so the scale is
 * crowded near infinity and opens up close — as engraved distance scales do.
 */
export function focusRingAngle(lens: Lens, focusMm: number): number {
  const d = Math.max(focusMm, lens.minFocusMm);
  return (extensionMm(lens.focalMm, d) / extensionMm(lens.focalMm, lens.minFocusMm)) * FOCUS_THROW_RAD;
}

const DISTANCE_MARKS_M = [Infinity, 10, 5, 3, 2, 1.5, 1.2, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
/** Closest angular spacing that keeps engraved labels from overlapping. */
const MIN_MARK_GAP_RAD = (16 * Math.PI) / 180;

/**
 * The engraved distance scale (metres), placed like the aperture marks so the
 * set distance sits under the index. The closest-focus mark is always kept;
 * labels that would crowd their neighbour toward infinity are dropped.
 */
export function focusRingMarks(lens: Lens): { label: string; angle: number }[] {
  const minM = lens.minFocusMm / 1000;
  const candidates = [...DISTANCE_MARKS_M.filter((m) => m > minM + 1e-9), minM];
  const kept: { label: string; angle: number }[] = [];
  for (const m of [...candidates].reverse()) {
    const angle = -focusRingAngle(lens, m * 1000);
    if (kept.length && Math.abs(kept[kept.length - 1].angle - angle) < MIN_MARK_GAP_RAD && m !== Infinity) continue;
    if (kept.length && m === Infinity && Math.abs(kept[kept.length - 1].angle - angle) < MIN_MARK_GAP_RAD) kept.pop();
    kept.push({ label: m === Infinity ? "∞" : String(m), angle });
  }
  return kept.reverse();
}

/** Shutter dial detents, slowest first, plus "A" on bodies with automatic exposure. */
export function dialDetents(speeds: number[], hasAuto: boolean): { label: string; sec: number | null }[] {
  const slowestFirst = [...speeds].sort((a, b) => b - a);
  const marks = slowestFirst.map((t) => ({ label: t > 1 ? `${t}s` : String(Math.round(1 / t)), sec: t as number | null }));
  return hasAuto ? [...marks, { label: "A", sec: null }] : marks;
}

/** Detent spacing: up to 24°, tighter on long dials so every position fits within 330°. Illustrative. */
export function dialStep(detents: number): number {
  return Math.min((24 * Math.PI) / 180, (330 * Math.PI) / 180 / Math.max(1, detents - 1));
}

/** Shutter dial rotation: slowest speed at 0, one detent per marked speed, "A" last. */
export function shutterDialAngle(speeds: number[], shutterSec: number, auto: boolean, hasAuto: boolean): number {
  const detents = dialDetents(speeds, hasAuto);
  const step = dialStep(detents.length);
  if (auto && hasAuto) return (detents.length - 1) * step;
  let best = 0;
  detents.forEach((d, i) => {
    if (d.sec !== null && Math.abs(Math.log(d.sec / shutterSec)) < Math.abs(Math.log(detents[best].sec! / shutterSec))) best = i;
  });
  return best * step;
}

/** Advance-lever stroke: out over STROKE_OUT_S, spring back over STROKE_BACK_S. Travel is illustrative. */
export const LEVER_STROKE_RAD = (120 * Math.PI) / 180;
export const STROKE_OUT_S = 0.28;
export const STROKE_BACK_S = 0.22;

/** Lever angle `t` seconds into a stroke; 0 before it starts and once it has sprung back. */
export function advanceLeverAngle(t: number): number {
  if (t <= 0 || t >= STROKE_OUT_S + STROKE_BACK_S) return 0;
  const ease = (x: number) => x * x * (3 - 2 * x);
  return t < STROKE_OUT_S ? LEVER_STROKE_RAD * ease(t / STROKE_OUT_S) : LEVER_STROKE_RAD * (1 - ease((t - STROKE_OUT_S) / STROKE_BACK_S));
}

/** Iris opening radius as a fraction of the wide-open radius (diameter scales as 1/f-number). */
export function irisOpening(lens: Lens, fNumber: number): number {
  return Math.min(1, lens.maxAperture / fNumber);
}

export interface LensProfile {
  /** Barrel length and radius, metres. */
  length: number;
  radius: number;
  mountRadius: number;
  /** Axial extent [start, end] of each ring, metres from the mount flange (+z toward the subject). */
  focusRing: [number, number];
  apertureRing: [number, number];
  frontRadius: number;
}

const MOUNT_DEPTH = 0.006;
const BEZEL = 0.003;

/**
 * Generic M-lens layout scaled to one lens's catalogue size: focus ring
 * toward the mount, aperture ring toward the front (the common modern M
 * arrangement — illustrative, not this lens's drawing).
 */
export function lensProfile(lens: Lens): LensProfile {
  const length = lens.look.lengthMm / 1000;
  const radius = lens.look.diameterMm / 2000;
  const usable = Math.max(0.004, length - MOUNT_DEPTH - BEZEL);
  const focusStart = MOUNT_DEPTH;
  const focusEnd = focusStart + usable * 0.45;
  const apertureEnd = length - BEZEL;
  const apertureStart = apertureEnd - usable * 0.3;
  return {
    length,
    radius,
    mountRadius: Math.min(radius * 0.92, 0.024),
    focusRing: [focusStart, focusEnd],
    apertureRing: [apertureStart, apertureEnd],
    frontRadius: radius * 0.72,
  };
}

export type QualityTier = "full" | "reduced" | "fallback";

export interface DeviceCaps {
  webgl: boolean;
  webgl2: boolean;
  /** navigator.deviceMemory in GB, where exposed (not on Safari). */
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData?: boolean;
}

/**
 * Full PBR with environment reflections, a reduced tier (no environment map,
 * device pixel ratio 1) for weak or data-saving devices, or the existing 2D
 * art when WebGL isn't available at all.
 */
export function chooseQualityTier(caps: DeviceCaps): QualityTier {
  if (!caps.webgl) return "fallback";
  if (!caps.webgl2 || caps.saveData) return "reduced";
  if (caps.deviceMemory !== undefined && caps.deviceMemory <= 2) return "reduced";
  if (caps.hardwareConcurrency !== undefined && caps.hardwareConcurrency <= 2) return "reduced";
  return "full";
}

// ── Turning parts directly in 3D (slice 3) ─────────────────────────────────
// A part being turned writes through the app's normal setters, so the optical
// state stays the single source of truth and the 3D pose follows it.

export type TurnablePart = "aperture" | "focus" | "shutter";

/** Horizontal drag distance per detent for click-stop rings and dials. */
export const DRAG_PX_PER_DETENT = 22;
/** Focus is smooth, not detented: ring rotation per pixel dragged. */
export const FOCUS_RAD_PER_PX = (0.6 * Math.PI) / 180;
/** Pointer travel below this is a tap, not a drag. */
export const TAP_SLOP_PX = 6;

/** The aperture `steps` clicks away from `fNumber`, clamped to the lens's range. */
export function stepAperture(lens: Lens, fNumber: number, steps: number): number {
  const stops = apertureStops(lens);
  let i = 0;
  stops.forEach((n, k) => {
    if (Math.abs(Math.log(n / fNumber)) < Math.abs(Math.log(stops[i] / fNumber))) i = k;
  });
  return stops[Math.min(stops.length - 1, Math.max(0, i + steps))];
}

/**
 * The dial position `steps` detents away, in dial order (slowest … fastest, then A).
 * Returns the new speed, or `auto: true` when the dial lands on A.
 */
export function stepShutter(speeds: number[], shutterSec: number, auto: boolean, hasAuto: boolean, steps: number): { auto: boolean; sec: number } {
  const detents = dialDetents(speeds, hasAuto);
  let i: number;
  if (auto && hasAuto) i = detents.length - 1;
  else {
    i = 0;
    detents.forEach((d, k) => {
      if (d.sec !== null && Math.abs(Math.log(d.sec / shutterSec)) < Math.abs(Math.log(detents[i].sec! / shutterSec))) i = k;
    });
  }
  const next = detents[Math.min(detents.length - 1, Math.max(0, i + steps))];
  return next.sec === null ? { auto: true, sec: shutterSec } : { auto: false, sec: next.sec };
}

/** Inverse of focusRingAngle: the focus distance a ring angle sets (Infinity at 0). */
export function focusFromRingAngle(lens: Lens, angle: number): number {
  const a = Math.min(Math.max(angle, 0), FOCUS_THROW_RAD);
  if (a <= 1e-9) return Infinity;
  const f = lens.focalMm;
  const extMin = (f * f) / (lens.minFocusMm - f);
  const ext = (a / FOCUS_THROW_RAD) * extMin;
  return f + (f * f) / ext;
}

/** Whole detents in an accumulated drag, and the remainder to carry into the next move. */
export function detentsFromDrag(accumulatedPx: number): { steps: number; remainderPx: number } {
  const steps = Math.trunc(accumulatedPx / DRAG_PX_PER_DETENT);
  return { steps, remainderPx: accumulatedPx - steps * DRAG_PX_PER_DETENT };
}
