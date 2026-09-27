// Motion Simulator (feature #8): subject motion blur vs camera shake. Pure.
//
// calculated: image-plane blur = subject speed × exposure time × magnification
//             (f / (d − f)), for the component of motion across the frame;
//             camera shake comes from the shared shake model (shakeBlurMm).
// approximate: the "typical" speeds of each motion archetype.

import type { Provenance } from "../data/provenance";
import { shakeBlurMm } from "./exposure";
import { magnification } from "./optics";

export interface MotionArchetype {
  id: string;
  label: string;
  /** Typical speed, metres per second (approximate). */
  speedMps: number;
}

export const MOTION_ARCHETYPES: MotionArchetype[] = [
  { id: "walk", label: "Walking person", speedMps: 1.4 },
  { id: "cyclist", label: "Cyclist", speedMps: 5.5 },
  { id: "car", label: "Car in town (50 km/h)", speedMps: 13.9 },
  { id: "train", label: "Train (80 km/h)", speedMps: 22.2 },
];

export const MOTION_PROVENANCE: Provenance = {
  kind: "approximate",
  notes: "Speeds are typical values for each kind of subject, not measurements of a particular scene. The blur itself is calculated from speed, shutter time, focal length and distance.",
};

/** Image-plane blur (mm) of a subject crossing the frame at `speedMps`, at `distanceMm`, during `shutterSec`. */
export function subjectBlurMm(speedMps: number, shutterSec: number, focalMm: number, distanceMm: number, crossingFraction = 1): number {
  return speedMps * 1000 * shutterSec * magnification(focalMm, distanceMm) * Math.abs(crossingFraction);
}

/** Image-plane blur (mm) of a subject turning across the frame at `degPerSec` (e.g. the "custom angular speed" archetype). */
export function angularBlurMm(degPerSec: number, shutterSec: number, focalMm: number): number {
  return focalMm * ((degPerSec * Math.PI) / 180) * shutterSec;
}

/** Where a blur sits on the freeze → streak continuum, as a multiple of the circle of confusion. */
export function blurRatio(blurMm: number, cocMm: number): number {
  return blurMm / cocMm;
}

/** Words for a point on the continuum — descriptive bands, not a sharp/blurred verdict. */
export function blurBand(ratio: number): "frozen" | "slight" | "visible" | "streaked" {
  if (ratio <= 1) return "frozen";
  if (ratio <= 3) return "slight";
  if (ratio <= 10) return "visible";
  return "streaked";
}

export interface MotionResult {
  subjectBlurMm: number;
  shakeBlurMm: number;
  subjectRatio: number;
  shakeRatio: number;
}

/** Subject blur and camera shake, computed independently: switching one off never changes the other. */
export function motionResult(opts: {
  speedMps: number;
  shutterSec: number;
  focalMm: number;
  distanceMm: number;
  cocMm: number;
  subjectMotion: boolean;
  cameraShake: boolean;
}): MotionResult {
  const subject = opts.subjectMotion ? subjectBlurMm(opts.speedMps, opts.shutterSec, opts.focalMm, opts.distanceMm) : 0;
  const shake = opts.cameraShake ? shakeBlurMm(opts.shutterSec, opts.focalMm) : 0;
  return { subjectBlurMm: subject, shakeBlurMm: shake, subjectRatio: blurRatio(subject, opts.cocMm), shakeRatio: blurRatio(shake, opts.cocMm) };
}

/** Samples to accumulate for a trail `blurPx` long: enough to look continuous, fewer while the user is dragging. */
export function trailSamples(blurPx: number, dragging: boolean): number {
  const full = Math.min(64, Math.max(1, Math.ceil(blurPx / 1.5)));
  return dragging ? Math.min(full, 12) : full;
}
