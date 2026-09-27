// Real-world light meter (feature #13). Pure, so metering can evolve (and be
// calibrated) independently of the UI.
//
// Two honest modes:
// - measured: the browser reports the camera's exposure time and ISO, so the
//   scene EV follows from those settings plus how bright the frame came out
//   relative to middle grey (reflective metering).
// - estimated: the browser hides exposure data (iOS Safari always does). The
//   phone's auto-exposure normalises brightness, so absolute EV can't be
//   measured; the base EV comes from the user (light picker / calibration),
//   while brightness *ratios within one frame* are still real, so spot and
//   highlight/shadow readings are measured relative to that base.

import { exposureError } from "./exposure";

/** Middle grey as linear reflectance: what a reflective meter assumes the scene averages to. */
export const MID_GREY = 0.18;

export function srgbToLinear(v8: number): number {
  const v = v8 / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Rec. 709 luminance of a linearised pixel. */
export function linearLuminance(r8: number, g8: number, b8: number): number {
  return 0.2126 * srgbToLinear(r8) + 0.7152 * srgbToLinear(g8) + 0.0722 * srgbToLinear(b8);
}

export interface Region {
  /** Normalised 0–1 rectangle within the frame. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WHOLE_FRAME: Region = { x: 0, y: 0, w: 1, h: 1 };

/** Mean linear luminance of a region of an RGBA pixel buffer. */
export function regionLuminance(data: ArrayLike<number>, width: number, height: number, region: Region = WHOLE_FRAME): number {
  const x0 = Math.max(0, Math.floor(region.x * width));
  const y0 = Math.max(0, Math.floor(region.y * height));
  const x1 = Math.min(width, Math.max(x0 + 1, Math.ceil((region.x + region.w) * width)));
  const y1 = Math.min(height, Math.max(y0 + 1, Math.ceil((region.y + region.h) * height)));
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      sum += linearLuminance(data[i], data[i + 1], data[i + 2]);
      n++;
    }
  return n ? sum / n : 0;
}

/** EV at ISO 100 of a camera setting: log2(N²/t) − log2(ISO/100). */
export function settingsEv100(fNumber: number, exposureSec: number, iso: number): number {
  return Math.log2((fNumber * fNumber) / exposureSec) - Math.log2(iso / 100);
}

/** Scene EV from the settings a frame was taken at and how bright it came out (reflective: average = middle grey). */
export function meteredEv100(settingsEv: number, meanLinear: number): number {
  return settingsEv + Math.log2(Math.max(meanLinear, 1e-6) / MID_GREY);
}

/** Stops between two luminances (positive = `a` brighter). */
export function stopsBetween(a: number, b: number): number {
  return Math.log2(Math.max(a, 1e-6) / Math.max(b, 1e-6));
}

export type MeterMode = "average" | "highlight" | "shadow";

/** Where each mode places its reading, in stops relative to middle grey. User-configurable preferences, not rules. */
export interface Placement {
  highlight: number;
  shadow: number;
}

export const DEFAULT_PLACEMENT: Placement = { highlight: 2.5, shadow: -2 };

/**
 * The EV to expose for. `regionEv` is the metered spot (or the whole frame);
 * average mode makes it middle grey; highlight/shadow place it `placement`
 * stops above/below middle grey. `biasStops` is a film preference (+1 = give
 * one stop more exposure, e.g. for colour negative).
 */
export function exposureEv(regionEv: number, mode: MeterMode, placement: Placement = DEFAULT_PLACEMENT, biasStops = 0): number {
  const place = mode === "highlight" ? placement.highlight : mode === "shadow" ? placement.shadow : 0;
  return regionEv - place - biasStops;
}

export interface Stabilizer {
  smoothed: number | null;
  shown: number | null;
}

/**
 * Keeps a static scene's reading steady: an exponential moving average, and a
 * displayed value (rounded to ⅓ EV) that only moves once the average has
 * drifted more than `deadband` from it.
 */
export function stabilize(state: Stabilizer, sample: number, alpha = 0.2, deadband = 1 / 3): Stabilizer {
  const smoothed = state.smoothed === null ? sample : state.smoothed + alpha * (sample - state.smoothed);
  const third = Math.round(smoothed * 3) / 3;
  const shown = state.shown === null || Math.abs(smoothed - state.shown) > deadband ? third : state.shown;
  return { smoothed, shown };
}

export type Lock = { kind: "aperture"; fNumber: number } | { kind: "shutter"; shutterSec: number } | null;

export interface Equivalent {
  fNumber: number;
  shutterSec: number;
  /** Exposure error of this marked pair against the target, stops (0 = exact). */
  errorStops: number;
  locked: boolean;
}

/**
 * Equivalent exposures for `ev100` at `iso` across the lens's apertures, each
 * with the nearest marked shutter speed (the engine's exposure error shows
 * what that rounding costs). With a shutter lock, each aperture is paired with
 * the locked speed instead, so the row that's actually correct stands out.
 */
export function equivalents(ev100: number, iso: number, apertures: number[], speeds: number[], lock: Lock): Equivalent[] {
  return apertures.map((n) => {
    let t: number;
    if (lock?.kind === "shutter") t = lock.shutterSec;
    else {
      const ideal = (n * n) / (2 ** ev100 * (iso / 100));
      t = speeds.reduce((best, s) => (Math.abs(Math.log(s / ideal)) < Math.abs(Math.log(best / ideal)) ? s : best));
    }
    const locked = lock?.kind === "aperture" ? lock.fNumber === n : lock?.kind === "shutter" ? Math.abs(exposureError(ev100, n, t, iso)) < 1 / 6 : false;
    return { fNumber: n, shutterSec: t, errorStops: exposureError(ev100, n, t, iso), locked };
  });
}

/**
 * Map a point on an element showing a frame with `object-fit: cover` (cropped
 * to fill) back to normalised coordinates in the full frame, which is what the
 * meter samples.
 */
export function coverToFrame(px: number, py: number, elemW: number, elemH: number, srcW: number, srcH: number): { x: number; y: number } {
  if (!srcW || !srcH) return { x: px / elemW, y: py / elemH };
  const scale = Math.max(elemW / srcW, elemH / srcH);
  const offX = (elemW - srcW * scale) / 2;
  const offY = (elemH - srcH * scale) / 2;
  return { x: (px - offX) / (srcW * scale), y: (py - offY) / (srcH * scale) };
}
