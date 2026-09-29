// Kit planner: for a kind of trip and a set of lenses, what's covered, what's
// missing, what doubles up, and which two lenses to take. The trip profiles
// are this app's own rules of thumb (the focal lengths photographers commonly
// pair for each kind of shooting), stated as such, never as Leica advice.

import { framelinesFor, type Body, type Lens } from "../data/gear";

export type TripId = "city" | "travel" | "portrait" | "night" | "everyday";

export interface Trip {
  id: TripId;
  label: string;
  /** What the trip asks of the lenses, in plain words. */
  need: string;
  /** Two focal-length bands to cover, as [min, max] mm; one lens each. */
  bands: [[number, number], [number, number]];
  /** Wider apertures score higher (low light, shallow focus). */
  fastMatters: boolean;
}

export const TRIPS: Trip[] = [
  { id: "city", label: "City and street", need: "A wide-normal lens for the street, a normal one for details and people.", bands: [[28, 35], [50, 50]], fastMatters: false },
  { id: "travel", label: "Travel and landscape", need: "A wide lens for places, something longer to pick out a detail far away.", bands: [[21, 28], [50, 90]], fastMatters: false },
  { id: "portrait", label: "Portraits", need: "A normal lens for environmental portraits, a short tele for heads and shoulders, both fast.", bands: [[35, 50], [75, 90]], fastMatters: true },
  { id: "night", label: "Night and low light", need: "Two fast lenses: every stop counts after dark.", bands: [[28, 35], [50, 50]], fastMatters: true },
  { id: "everyday", label: "Everyday, one bag", need: "A versatile normal pair you'll actually carry.", bands: [[35, 35], [50, 75]], fastMatters: false },
];

export interface KitReport {
  /** Focal lengths in the kit, shortest first. */
  focals: number[];
  /** Big jumps between neighbouring focal lengths (ratio above 1.8×). */
  gaps: [number, number][];
  /** Lenses that do nearly the same job (within 1.2× of each other). */
  overlaps: [Lens, Lens][];
  /** Lenses that bring up no frame lines in this body's finder. */
  noFrameline: Lens[];
  /** Which of the trip's two bands the kit covers. */
  covers: [boolean, boolean];
}

const inBand = (f: number, [lo, hi]: [number, number]) => f >= lo && f <= hi;

export function analyseKit(body: Body, kit: Lens[], trip: Trip): KitReport {
  const sorted = [...kit].sort((a, b) => a.focalMm - b.focalMm || a.maxAperture - b.maxAperture);
  const focals = [...new Set(sorted.map((l) => l.focalMm))];
  const gaps: [number, number][] = [];
  for (let i = 1; i < focals.length; i++) if (focals[i] / focals[i - 1] > 1.8) gaps.push([focals[i - 1], focals[i]]);
  const overlaps: [Lens, Lens][] = [];
  for (let i = 1; i < sorted.length; i++) if (sorted[i].focalMm / sorted[i - 1].focalMm < 1.2) overlaps.push([sorted[i - 1], sorted[i]]);
  const noFrameline = body.rangefinder ? sorted.filter((l) => !framelinesFor(body, l.focalMm)) : [];
  const covers: [boolean, boolean] = [sorted.some((l) => inBand(l.focalMm, trip.bands[0])), sorted.some((l) => inBand(l.focalMm, trip.bands[1]))];
  return { focals, gaps, overlaps, noFrameline, covers };
}

/** How well one lens fills a band: in the band, with frame lines, fast when it matters. */
function fit(body: Body, l: Lens, band: [number, number], fastMatters: boolean): number {
  if (!inBand(l.focalMm, band)) return -Infinity;
  let score = 10;
  if (body.rangefinder && !framelinesFor(body, l.focalMm)) score -= 4;
  // Faster is better when light or shallow focus matters; otherwise a small preference for compact, slower lenses.
  score += fastMatters ? (2.8 - l.maxAperture) * 3 : (l.maxAperture - 1.4) * 0.5;
  // A current design over a classic when all else is equal.
  if (!l.classic) score += 0.5;
  return score;
}

/** The two lenses to take: the best fit for each band, from the lenses offered. */
export function recommendPair(body: Body, lenses: Lens[], trip: Trip): [Lens | null, Lens | null] {
  const best = (band: [number, number], not?: Lens | null) =>
    lenses
      .filter((l) => l !== not)
      .map((l) => ({ l, s: fit(body, l, band, trip.fastMatters) }))
      .filter((x) => Number.isFinite(x.s))
      .sort((a, b) => b.s - a.s)[0]?.l ?? null;
  const first = best(trip.bands[0]);
  return [first, best(trip.bands[1], first)];
}
