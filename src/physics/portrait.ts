// Portrait distance trainer: how far back to stand for a chosen framing,
// given the lens's focal length and an assumed subject height. Pure
// thin-lens geometry — the inverse of the same `magnification` model
// physics/optics.ts already uses (magnification = focalMm / (focusMm −
// focalMm)) — not a measurement. There's no camera-based distance sensing
// here, only the geometric calculation the spec requires to work
// everywhere, with or without AR/depth support.

import type { Provenance } from "../data/provenance";

export type FramingId = "head" | "head-shoulders" | "half-body" | "full-body";

export interface Framing {
  id: FramingId;
  label: string;
  /** Vertical extent of the subject that fills the frame height, at the default assumed standing height. */
  subjectHeightM: number;
}

export const DEFAULT_ASSUMED_HEIGHT_M = 1.7;

export const FRAMINGS: Framing[] = [
  { id: "head", label: "Head", subjectHeightM: 0.24 },
  { id: "head-shoulders", label: "Head & shoulders", subjectHeightM: 0.45 },
  { id: "half-body", label: "Half body", subjectHeightM: 0.9 },
  { id: "full-body", label: "Full body", subjectHeightM: DEFAULT_ASSUMED_HEIGHT_M },
];

export const PORTRAIT_FRAMING_PROVENANCE: Provenance = {
  kind: "illustrative",
  notes: "Framing proportions (how much of a standing adult counts as \"head\", \"half body\", etc.) are rough, generic fractions, not anthropometric data.",
};

/**
 * Distance from the lens (mm) needed so a subject `subjectHeightM` tall
 * fills the frame height, for a lens of `focalMm` on a sensor/film
 * `frameHeightMm` tall. Distances in this app are measured from the lens,
 * matching every other DOF/framing calculation.
 */
export function requiredDistanceMm(focalMm: number, frameHeightMm: number, subjectHeightM: number): number {
  const magnification = frameHeightMm / (subjectHeightM * 1000);
  return focalMm / magnification + focalMm;
}

/**
 * A framing's subject height, scaled for an assumed standing height other
 * than the default 1.7 m — the *proportion* of a person that counts as
 * "head" or "half body" doesn't change with their height, only the absolute
 * size does.
 */
export function scaledSubjectHeightM(framing: Framing, assumedHeightM: number): number {
  return framing.subjectHeightM * (assumedHeightM / DEFAULT_ASSUMED_HEIGHT_M);
}
