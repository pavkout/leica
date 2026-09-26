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
} as const;

export const MODEL_PROVENANCE: Provenance = {
  kind: "illustrative",
  notes:
    "Procedural stand-in, not a scan or a licensed model: lens length and diameter come from the catalogue's approximate sizes, body proportions are generic M-body proportions, and ring spacing is a uniform illustrative scale. The iris uses the same outline as the 2D iris and the bokeh.",
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
