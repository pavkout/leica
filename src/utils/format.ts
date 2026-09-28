export type Units = "metric" | "imperial";

const MM_PER_INCH = 25.4;

function feetAndInches(mm: number) {
  const totalInches = mm / MM_PER_INCH;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches, totalInches };
}

/** A distance from the camera, e.g. "2.35 m" or "7′ 9″". */
export function formatDistance(mm: number, units: Units): string {
  if (!Number.isFinite(mm) || mm > 1e7) return "∞";
  if (units === "metric") {
    const m = mm / 1000;
    if (m < 10) return `${m.toFixed(2)} m`;
    if (m < 100) return `${m.toFixed(1)} m`;
    return `${Math.round(m)} m`;
  }
  const { feet, inches } = feetAndInches(mm);
  if (feet >= 30) return `${Math.round(mm / MM_PER_INCH / 12)}′`;
  return inches ? `${feet}′ ${inches}″` : `${feet}′`;
}

/** A length that can be tiny, like a depth of field at close focus. */
export function formatLength(mm: number, units: Units): string {
  if (!Number.isFinite(mm) || mm > 1e7) return "∞";
  if (units === "metric") {
    if (mm < 10) return `${mm.toFixed(1)} mm`;
    if (mm < 1000) return `${(mm / 10).toFixed(mm < 100 ? 1 : 0)} cm`;
    return formatDistance(mm, units);
  }
  const inches = mm / MM_PER_INCH;
  if (inches < 12) return `${inches.toFixed(inches < 2 ? 2 : 1)}″`;
  return formatDistance(mm, units);
}

export function formatFNumber(n: number) {
  return `f/${n < 1 ? n.toFixed(2).replace(/0$/, "") : Number.isInteger(n) ? n : n.toFixed(1)}`;
}

/** Scale labels for the lens barrel, in mm. */
export const METRIC_SCALE_MM = [0.16, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1, 1.2, 1.5, 2, 3, 5, 10].map((m) => m * 1000);
export const IMPERIAL_SCALE_MM = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 5, 7, 10, 15, 30].map((ft) => ft * 12 * MM_PER_INCH);

export function scaleLabel(mm: number, units: Units) {
  if (units === "metric") return String(+(mm / 1000).toFixed(2));
  return String(+(mm / MM_PER_INCH / 12).toFixed(2));
}

/**
 * Inverse of `scaleLabel`: a typed distance in the current unit (metres or
 * feet) to millimetres. `null` for anything that isn't a positive number —
 * callers should leave the focus distance unchanged rather than accept it.
 */
export function parseDistanceInput(text: string, units: Units): number | null {
  const value = Number(text.trim());
  if (!Number.isFinite(value) || value <= 0) return null;
  return units === "metric" ? value * 1000 : value * 12 * MM_PER_INCH;
}

/**
 * A lens name as its front ring engraves it: "Summilux-M 35 f/1.4 ASPH." →
 * "Summilux-M 1:1.4/35 ASPH.". Notes in brackets ("(pre-ASPH)") are the
 * catalogue's, not the engraving's, so they're dropped. Names that don't
 * follow the pattern are returned unchanged.
 */
export function lensEngraving(name: string): string {
  const m = /^(.+?) (\d+) f\/([\d.]+)((?: ASPH\.)?)/.exec(name);
  if (!m) return name;
  const [, family, focal, aperture, asph] = m;
  return `${family} 1:${aperture}/${focal}${asph}`;
}

/** Ends a sentence on a name without doubling the stop: "… ASPH." stays "… ASPH.", "… f/2" becomes "… f/2.". */
export function sentenceEnd(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}
