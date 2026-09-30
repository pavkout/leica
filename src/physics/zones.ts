// Zone System meter (#60), after Ansel Adams: a tone chosen in the scene is
// placed on a zone (the shadow you want to keep detail in, usually on Zone
// III), and everything else falls a zone higher for every stop brighter.
// Zone V is the meter's mid grey. The highlights' zone then says how to
// develop: N for normal, N−1 or N−2 to hold back bright highlights, N+1 or
// N+2 to lift flat ones. The development changes are the method's own
// conventions; how much time each takes depends on the film and developer,
// and the page says to test.

export const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export const roman = (z: number) => ROMAN[Math.max(0, Math.min(10, Math.round(z)))];

/** The zone a tone falls on, given where another was placed. */
export function zoneOf(pointEv: number, placedEv: number, placedZone: number): number {
  return placedZone + (pointEv - placedEv);
}

/** The exposure (EV at ISO 100) that renders a tone measured at `placedEv` on `placedZone`. */
export function exposureFor(placedEv: number, placedZone: number): number {
  return placedEv + (5 - placedZone);
}

export type Development = "N-2" | "N-1" | "N" | "N+1" | "N+2";

/** Development for the highlights to print as Zone VIII (textured white). */
export function development(highlightZone: number): Development {
  const shift = Math.max(-2, Math.min(2, Math.round(8 - highlightZone)));
  return shift === 0 ? "N" : shift > 0 ? (`N+${shift}` as Development) : (`N${shift}` as Development);
}

/** Stops between two linear luminances. */
export const stops = (lum: number, ref: number) => Math.log2(Math.max(lum, 1e-6) / Math.max(ref, 1e-6));

/**
 * A false-colour zone map: each pixel shown as the flat grey of its zone,
 * with clipped shadows (below 0) blue and blown highlights (above IX) red.
 * Returns RGB for a linear luminance.
 */
export function zoneColour(lum: number, placedLum: number, placedZone: number): [number, number, number] {
  const z = Math.round(placedZone + stops(lum, placedLum));
  if (z <= 0) return [30, 60, 200];
  if (z >= 10) return [220, 40, 30];
  const g = Math.round((z / 10) ** 1.2 * 255);
  return [g, g, g];
}
