// Rangefinder calibration simulator (feature #7): what a misaligned
// rangefinder does to focus. Diagnostic education only — isolated from the
// normal focusing model, which never sees these parameters.
//
// Model (thin lens, small angles):
// - A rangefinder triangulates over its base length B: an object at distance d
//   sits at angle B/d between the two finder windows. The patch looks aligned
//   when the moving image has turned through that angle.
// - Horizontal misalignment δ (radians, object space) shifts that angle, so a
//   visually aligned patch sets the lens to 1/d′ = (1 + ε)/d + δ/B.
// - A baseline (coupling) error ε scales the indicated distance.
// - Vertical misalignment splits the patch up/down: harder to judge, but by
//   itself no focus error.

import type { Provenance } from "../data/provenance";
import { blurDiscMm } from "./optics";

/** Approximate mechanical base length of an M rangefinder, mm (varies slightly by model; not in the catalogue). */
export const RF_BASE_MM = 69;

export const CALIBRATION_ASSUMPTIONS: Provenance = {
  kind: "approximate",
  notes:
    "Base length ≈ 69 mm (approximate, varies by model). Horizontal offset is the rangefinder image's angular error in object space, in arcminutes; baseline error is a percentage error in the distance the coupling reports. Thin-lens blur against the current circle of confusion.",
};

export interface Misalignment {
  /** Horizontal image offset, arcminutes (positive = reads closer than true). */
  horizontalArcmin: number;
  /** Vertical image offset, arcminutes (visual only). */
  verticalArcmin: number;
  /** Baseline / coupling scale error, percent. */
  baselineErrorPct: number;
}

export const ALIGNED: Misalignment = { horizontalArcmin: 0, verticalArcmin: 0, baselineErrorPct: 0 };

const ARCMIN = Math.PI / (180 * 60);

export interface IndicatedFocus {
  /** Where the lens ends up focused when the patch looks aligned on the subject, mm (Infinity allowed). */
  focusMm: number;
  /** The rangefinder would need to go "past infinity" to align: the lens stops at infinity instead. */
  pastInfinity: boolean;
}

/** Focus the lens is set to when the (misaligned) patch looks aligned on a subject at `subjectMm`. */
export function indicatedFocus(subjectMm: number, m: Misalignment, baseMm = RF_BASE_MM): IndicatedFocus {
  if (m.horizontalArcmin === 0 && m.baselineErrorPct === 0) return { focusMm: subjectMm, pastInfinity: false };
  const inv = (1 + m.baselineErrorPct / 100) / subjectMm + (m.horizontalArcmin * ARCMIN) / baseMm;
  if (inv <= 0) return { focusMm: Infinity, pastInfinity: true };
  return { focusMm: 1 / inv, pastInfinity: false };
}

export interface FocusErrorResult {
  focusMm: number;
  pastInfinity: boolean;
  /** Focus plane deviation from the subject, mm (positive = focused behind the subject). */
  deviationMm: number;
  /** Blur of the subject on the sensor, mm, and as a multiple of the circle of confusion. */
  blurMm: number;
  blurRatio: number;
}

export function focusError(focalMm: number, fNumber: number, cocMm: number, subjectMm: number, m: Misalignment): FocusErrorResult {
  const { focusMm, pastInfinity } = indicatedFocus(subjectMm, m);
  const blurMm = focusMm === subjectMm ? 0 : blurDiscMm(focalMm, fNumber, focusMm, subjectMm);
  return { focusMm, pastInfinity, deviationMm: focusMm - subjectMm, blurMm, blurRatio: blurMm / cocMm };
}

/** Subject distances for the chart (log-spaced), mm. */
export function chartDistances(minMm: number, maxMm = 20000, n = 40): number[] {
  const a = Math.log(minMm);
  const b = Math.log(maxMm);
  return Array.from({ length: n }, (_, i) => Math.exp(a + ((b - a) * i) / (n - 1)));
}

/** Text that must never appear in this feature: it's education, not a repair guide. */
export const FORBIDDEN_ADVICE = /\b(open (the|your) camera|remove (the )?top ?plate|adjust (the )?(screw|cam|roller)|turn the (eccentric|screw)|DIY)\b/i;

/**
 * What a horizontal offset does at the far end of the scale: reading close, the
 * lens can't truly reach infinity (it stops at B/δ); reading far, nothing
 * beyond B/δ can be brought into alignment at all.
 */
export function infinityEffect(m: Misalignment, baseMm = RF_BASE_MM): { kind: "stops-short"; focusMm: number } | { kind: "cannot-align-beyond"; distanceMm: number } | null {
  if (m.horizontalArcmin === 0) return null;
  const limit = baseMm / (Math.abs(m.horizontalArcmin) * ARCMIN);
  return m.horizontalArcmin > 0 ? { kind: "stops-short", focusMm: limit } : { kind: "cannot-align-beyond", distanceMm: limit };
}
