// Focus breathing / perspective lab (feature #26). Pure.
//
// Perspective: real pinhole projection. A point at height Y, lateral X and
// distance Z from the camera lands on the sensor at (f·X/Z, f·Y/Z). Relative
// sizes of things at different distances depend only on where the camera is,
// never on the focal length — the lesson of this lab.
//
// Breathing: the change of angle of view while focusing depends on each
// lens's design. It needs a measured (or published) effective-focal-length
// curve; without one it is *not modelled* rather than invented.

import type { Provenance } from "../data/provenance";

export interface ScenePoint {
  /** Metres: lateral (right +), height (up +), distance behind the subject (0 = the subject's plane). */
  x: number;
  y: number;
  depth: number;
}

export interface SceneObject {
  id: string;
  label: string;
  /** Base centre and size, metres. */
  base: ScenePoint;
  width: number;
  height: number;
}

/** A simple street: a person, a tree behind them, a building far behind, and a post in front. */
export const PERSPECTIVE_SCENE: SceneObject[] = [
  { id: "building", label: "Building, 25 m behind", base: { x: 0.2, y: 0, depth: 25 }, width: 14, height: 12 },
  { id: "tree", label: "Tree, 8 m behind", base: { x: -2.2, y: 0, depth: 8 }, width: 2.4, height: 5 },
  { id: "person", label: "Person (the subject)", base: { x: 0, y: 0, depth: 0 }, width: 0.5, height: 1.75 },
  { id: "post", label: "Post, 1 m in front", base: { x: 0.9, y: 0, depth: -1 }, width: 0.12, height: 1.1 },
];

/** Camera eye height, metres. */
export const EYE_HEIGHT = 1.5;

/** Project a scene point to sensor millimetres for a camera `cameraDistance` metres in front of the subject. */
export function project(p: ScenePoint, cameraDistance: number, focalMm: number): { x: number; y: number } | null {
  const z = cameraDistance + p.depth;
  if (z <= 0.05) return null; // behind or at the camera
  return { x: (focalMm * p.x) / z, y: (focalMm * (p.y - EYE_HEIGHT)) / z };
}

/** Image height (sensor mm) of an object. */
export function imageHeight(o: SceneObject, cameraDistance: number, focalMm: number): number {
  const z = cameraDistance + o.base.depth;
  return z > 0.05 ? (focalMm * o.height) / z : Infinity;
}

/** How big one object looks relative to another — perspective. Independent of focal length. */
export function relativeSize(a: SceneObject, b: SceneObject, cameraDistance: number): number {
  return imageHeight(a, cameraDistance, 1) / imageHeight(b, cameraDistance, 1);
}

/** The focal length that keeps the subject the same image height from a new camera distance ("dolly zoom"). */
export function focalForSameSubject(subject: SceneObject, targetImageMm: number, cameraDistance: number): number {
  return (targetImageMm * (cameraDistance + subject.base.depth)) / subject.height;
}

// ── Breathing ──────────────────────────────────────────────────────────────

export interface BreathingProfile {
  /** Effective focal length at focus distances (mm, mm), sorted by distance. */
  points: [number, number][];
  provenance: Provenance;
}

/** Measured/published breathing curves by lens id. Empty: none have been sourced — nothing is invented. */
export const BREATHING_PROFILES: Record<string, BreathingProfile> = {};

/** Effective focal length at a focus distance, or null when the lens has no breathing data (not modelled). */
export function effectiveFocal(profile: BreathingProfile | undefined, focusMm: number): number | null {
  if (!profile || profile.points.length === 0) return null;
  const pts = profile.points;
  if (focusMm <= pts[0][0]) return pts[0][1];
  if (focusMm >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (focusMm <= pts[i][0]) {
      const [d0, f0] = pts[i - 1];
      const [d1, f1] = pts[i];
      return f0 + ((focusMm - d0) / (d1 - d0)) * (f1 - f0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Angle-of-view change from breathing, percent (positive = wider), or null when not modelled. */
export function breathingPercent(profile: BreathingProfile | undefined, nominalFocalMm: number, focusMm: number): number | null {
  const eff = effectiveFocal(profile, focusMm);
  return eff === null ? null : (nominalFocalMm / eff - 1) * 100;
}
