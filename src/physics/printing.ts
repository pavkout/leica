// Darkroom printing helpers (#52). Pure arithmetic: f-stop test strips,
// changing print size, and mixing chemistry. No chemistry capacities are
// assumed; the owner enters their bottle's figure.

/** Times for an f-stop test strip: `count` strips, each `step` stops more than the last. */
export function testStripTimes(base: number, step: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => round1(base * 2 ** (i * step)));
}

/**
 * The covering method: expose the whole sheet, cover one strip, expose again…
 * Each exposure is the difference between one strip's total and the one
 * before, so strip i ends with `totals[i]`.
 */
export function stripIncrements(totals: number[]): number[] {
  return totals.map((x, i) => round1(i === 0 ? x : x - totals[i - 1]));
}

/** A time made `stops` stops brighter (+) or darker (−). */
export function adjustStops(time: number, stops: number): number {
  return round1(time * 2 ** stops);
}

/**
 * The new time when the print size changes, from the magnifications
 * (print width ÷ negative width): the light spreads as (m + 1)².
 */
export function newSizeTime(time: number, fromPrintMm: number, toPrintMm: number, negativeMm = 36): number {
  const m1 = fromPrintMm / negativeMm;
  const m2 = toPrintMm / negativeMm;
  return round1(time * ((m2 + 1) / (m1 + 1)) ** 2);
}

/** "1+9", "1:9", "1 + 31" → parts of water per part of concentrate. */
export function parseDilution(text: string): number | null {
  const m = /^\s*1\s*[+:]\s*(\d+(?:[.,]\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return n >= 0 ? n : null;
}

/** Concentrate and water for `volumeMl` of a 1+n working solution. */
export function mix(volumeMl: number, waterParts: number): { concentrate: number; water: number } {
  const concentrate = volumeMl / (1 + waterParts);
  return { concentrate: round1(concentrate), water: round1(volumeMl - concentrate) };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
