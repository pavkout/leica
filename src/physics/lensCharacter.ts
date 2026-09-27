// Lens DNA (feature #4): a per-lens "character" readout built only from what
// can be backed — physics calculated from the lens's geometry, published
// specs, sourced profiles — with every row carrying its provenance. Where
// nothing backs a characteristic (distortion, flare, sharpness from
// aberrations, until measured data is added), the row says "no data" rather
// than guessing. No adjectives are generated here: descriptive copy lives in
// content data with a source.

import type { Lens } from "../data/gear";
import { apertureShape, GENERIC_BLADES, stopsDown } from "../preview/aperture";
import { diffractionLimitedFNumber } from "./optics";

export type CharacterProvenance = "calculated" | "published" | "measured" | "community" | "approximate" | "none";

/**
 * Sourced, lens-specific character data, separate from optical geometry.
 * Every value must come with a source; add entries only from measurements or
 * manufacturer publications that have actually been read.
 */
export interface LensCharacterProfile {
  /** Distortion at the frame corner, percent (negative = barrel). */
  distortionPct?: { value: number; provenance: "measured" | "published"; source: string };
  /** Corner illumination wide open, stops below the centre. */
  vignettingWideOpenStops?: { value: number; provenance: "measured" | "published"; source: string };
  /** Rendering notes with their source (reviews, manufacturer copy, community). */
  notes?: { text: string; provenance: "published" | "community"; source: string }[];
}

/** Sourced profiles by lens id. Empty until real, sourced data is added — nothing here is estimated. */
export const LENS_CHARACTER_PROFILES: Record<string, LensCharacterProfile> = {};

export interface DnaContext {
  fNumber: number;
  /** Circle of confusion in use (the app's sharpness standard), mm. */
  cocMm: number;
  /** Half-diagonal of the frame, mm (21.6 for 36 × 24). */
  frameHalfDiagonalMm: number;
  /** Digital bodies correct most lens vignetting in-camera. */
  digital?: boolean;
}

export interface DnaRow {
  key: "minFocus" | "apertures" | "bokeh" | "naturalVignetting" | "mechanicalVignetting" | "diffraction" | "sharpness" | "distortion" | "flare" | "notes";
  label: string;
  /** Structured value for the UI to format; null when there's no data. */
  value: number | string | null;
  /** Secondary numeric detail where useful (e.g. blade count). */
  detail?: number;
  provenance: CharacterProvenance;
  note: string;
}

/**
 * Corner darkening the simulated preview applies, in stops: strong on fast
 * lenses wide open, gone about 3 stops down. A heuristic (approximate), not a
 * measurement. Digital Ms read the lens code and correct most of it.
 */
export function vignetteStops(lens: Lens, fNumber: number, digital: boolean) {
  const wideOpen = lens.maxAperture <= 1 ? 2 : lens.maxAperture <= 1.4 ? 1.6 : lens.maxAperture <= 2 ? 1.2 : lens.maxAperture <= 2.8 ? 0.9 : 0.6;
  return wideOpen * Math.max(0, 1 - stopsDown(lens, fNumber) / 3) * (digital ? 0.35 : 1);
}

/** Light falloff at the frame corner for an ideal lens (cos⁴ law), in stops. */
export function naturalVignettingStops(focalMm: number, halfDiagonalMm: number): number {
  const theta = Math.atan(halfDiagonalMm / focalMm);
  return -Math.log2(Math.cos(theta) ** 4);
}

/** The f-number the lens can actually be set to closest to `fNumber` (for comparing lenses of different speed). */
export function reachableFNumber(lens: Lens, fNumber: number): number {
  return Math.min(Math.max(fNumber, lens.maxAperture), lens.minAperture);
}

export function lensDNA(lens: Lens, ctx: DnaContext, profile: LensCharacterProfile | undefined = LENS_CHARACTER_PROFILES[lens.id]): DnaRow[] {
  const n = reachableFNumber(lens, ctx.fNumber);
  const shape = apertureShape(lens, n);
  const publishedBlades = lens.apertureBlades !== undefined;
  const diffractionN = diffractionLimitedFNumber(ctx.cocMm);

  const rows: DnaRow[] = [
    { key: "minFocus", label: "Closest focus", value: lens.minFocusMm, provenance: "published", note: "From the lens's specifications in the catalogue." },
    { key: "apertures", label: "Aperture range", value: `${lens.maxAperture}–${lens.minAperture}`, provenance: "published", note: "From the lens's specifications in the catalogue." },
    {
      key: "bokeh",
      label: "Out-of-focus highlight shape",
      value: shape.roundness,
      detail: shape.blades,
      provenance: publishedBlades ? "published" : "approximate",
      note: publishedBlades
        ? `${shape.blades} blades (published). Roundness at this aperture follows the simulator's rounded-blade model.`
        : `Blade count isn't published for this lens: a generic ${GENERIC_BLADES}-blade iris is shown. Roundness follows the simulator's rounded-blade model.`,
    },
    {
      key: "naturalVignetting",
      label: "Corner falloff (ideal lens)",
      value: naturalVignettingStops(lens.focalMm, ctx.frameHalfDiagonalMm),
      provenance: "calculated",
      note: "The cos⁴ law for an ideal lens at this focal length: the unavoidable part of corner darkening. Real designs differ — some wide-angles correct it, retrofocus designs have less.",
    },
    {
      key: "mechanicalVignetting",
      label: "Corner darkening in the preview",
      value: vignetteStops(lens, n, !!ctx.digital),
      detail: shape.catEye,
      provenance: "approximate",
      note: `The simulated photo's heuristic, by maximum aperture: strongest wide open on fast lenses, gone about 3 stops down (${stopsDown(lens, n).toFixed(1)} stops down now)${ctx.digital ? "; digital Ms correct most of it in-camera" : ""}. Corner highlights also turn "cat's-eye" wide open. Not measured for this lens.`,
    },
    {
      key: "diffraction",
      label: "Diffraction softening from",
      value: diffractionN,
      provenance: "calculated",
      note: "The f-number where the Airy disc outgrows the circle of confusion of the current sharpness standard. Same for every lens: it's physics, not character.",
    },
    { key: "sharpness", label: "Sharpness vs aperture", value: null, provenance: "none", note: "No measured sharpness data for this lens in the app. Not estimated." },
    profile?.distortionPct
      ? { key: "distortion", label: "Distortion", value: profile.distortionPct.value, provenance: profile.distortionPct.provenance, note: profile.distortionPct.source }
      : { key: "distortion", label: "Distortion", value: null, provenance: "none", note: "No measured or published distortion figure in the app's data. Not estimated." },
    { key: "flare", label: "Flare susceptibility", value: null, provenance: "none", note: "No flare data in the app. Not estimated." },
  ];

  const notes = [
    ...(lens.nickname ? [{ text: lens.nickname, provenance: "community" as const, source: "Photographers' nickname, from the catalogue" }] : []),
    ...(profile?.notes ?? []),
  ];
  rows.push(
    notes.length
      ? { key: "notes", label: "Rendering notes", value: notes.map((x) => x.text).join(" · "), provenance: notes.some((x) => x.provenance === "published") ? "published" : "community", note: notes.map((x) => x.source).join("; ") }
      : { key: "notes", label: "Rendering notes", value: null, provenance: "none", note: "No sourced rendering notes for this lens." },
  );
  return rows;
}
