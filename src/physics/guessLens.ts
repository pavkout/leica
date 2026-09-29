// Guess the lens: a picture is rendered through a hidden lens and aperture;
// the player names the focal length and roughly how far it was stopped down.
// Pure round logic (no rendering), so it's testable with a seeded random.

import type { Lens } from "../data/gear";

export type ApertureBand = "wide" | "middle" | "stopped";

export const APERTURE_BANDS: { id: ApertureBand; label: string; hint: string }[] = [
  { id: "wide", label: "Wide open", hint: "f/2.8 or faster: the background melts" },
  { id: "middle", label: "Middle", hint: "f/4 to f/5.6: soft, but shapes still read" },
  { id: "stopped", label: "Stopped down", hint: "f/8 or smaller: sharp almost front to back" },
];

export function apertureBand(fNumber: number): ApertureBand {
  if (fNumber <= 2.85) return "wide";
  if (fNumber <= 5.7) return "middle";
  return "stopped";
}

export interface Round {
  lensId: string;
  focalMm: number;
  fNumber: number;
  /** A sample photo's id, or "street" for the illustrated scene. */
  sceneId: string;
  /** Focal lengths offered, including the right one, shortest first. */
  focalChoices: number[];
}

/** Standard apertures for each band; the round uses the one the lens can actually set. */
const BAND_APERTURES: Record<ApertureBand, number[]> = { wide: [1.4, 2, 2.8], middle: [4, 5.6], stopped: [8, 11] };
const pick = <T,>(list: T[], random: () => number) => list[Math.floor(random() * list.length) % list.length];

/**
 * A new round. `photoMinFocalMm`: lenses wider than this can't be shown on the
 * sample photos (their field of view is wider than the photo's), so they get
 * the illustrated street, which can be rendered at any angle.
 */
export function makeRound(lenses: Lens[], photoSceneIds: string[], random: () => number = Math.random, photoMinFocalMm = 35): Round | null {
  const byFocal = new Map<number, Lens>();
  for (const l of lenses) if (l.focalMm >= 21 && l.focalMm <= 135 && !byFocal.has(l.focalMm)) byFocal.set(l.focalMm, l);
  const focals = [...byFocal.keys()].sort((a, b) => a - b);
  if (focals.length < 2) return null;

  const focalMm = pick(focals, random);
  const lens = byFocal.get(focalMm)!;
  // A band the lens can reach, then the nearest standard stop it has.
  const bands = (Object.keys(BAND_APERTURES) as ApertureBand[]).filter((b) => BAND_APERTURES[b].some((n) => n >= lens.maxAperture - 1e-6 && n <= lens.minAperture + 1e-6));
  const band = pick(bands, random);
  const fNumber = pick(
    BAND_APERTURES[band].filter((n) => n >= lens.maxAperture - 1e-6 && n <= lens.minAperture + 1e-6),
    random,
  );

  const sceneId = focalMm >= photoMinFocalMm && photoSceneIds.length ? pick(photoSceneIds, random) : "street";

  // Up to four choices: the answer and its neighbours, so the choice is about seeing, not guessing wildly.
  const i = focals.indexOf(focalMm);
  const start = Math.max(0, Math.min(focals.length - 4, i - 1 - Math.floor(random() * 2)));
  const focalChoices = focals.slice(start, start + 4);

  return { lensId: lens.id, focalMm, fNumber, sceneId, focalChoices };
}

export interface Score {
  focal: boolean;
  aperture: boolean;
  points: number;
}

export function scoreGuess(round: Round, focalMm: number, band: ApertureBand): Score {
  const focal = focalMm === round.focalMm;
  const aperture = band === apertureBand(round.fNumber);
  return { focal, aperture, points: (focal ? 1 : 0) + (aperture ? 1 : 0) };
}
