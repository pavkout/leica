// Sunny 16 trainer: drill exposure estimation without a meter. Scenarios are
// the standard EV guide ("Sunny 16" and its usual extensions), not memorized
// one-off answers — the same `exposureError` the rest of the app uses grades
// the guess, so a correct answer here is correct on the main simulator too.

import type { Provenance } from "../data/provenance";
import { exposureError } from "./exposure";

export interface LightCondition {
  id: string;
  label: string;
  /** Scene brightness, EV at ISO 100. */
  ev100: number;
  hint: string;
}

export const LIGHT_CONDITIONS_PROVENANCE: Provenance = {
  kind: "published",
  notes: "Standard EV guide / Sunny-16-rule values. A real scene's actual brightness varies with latitude, season and surroundings.",
};

export const LIGHT_CONDITIONS: LightCondition[] = [
  { id: "sunny16", label: "Bright sun, hard-edged shadows", ev100: 15, hint: "The rule's namesake: f/16 at 1/ISO." },
  { id: "hazy11", label: "Hazy sun, soft-edged shadows", ev100: 14, hint: "One stop more open than full sun." },
  { id: "cloudy-bright8", label: "Cloudy bright, no shadows", ev100: 13, hint: "Overcast but the sky is still bright." },
  { id: "cloudy-dull56", label: "Heavy overcast", ev100: 12, hint: "Flat, dim daylight." },
  { id: "open-shade", label: "Open shade on a sunny day", ev100: 11, hint: "Subject in shade, but lit by open sky." },
  { id: "interior", label: "Bright interior, window light", ev100: 8, hint: "Indoors, near a window." },
  { id: "sunset", label: "Sunset", ev100: 9, hint: "The sun is low; light is warm and dropping fast." },
  { id: "dusk-street", label: "Well-lit city street at dusk", ev100: 5, hint: "Streetlights and shopfronts, no daylight left." },
  { id: "night-street", label: "Night street under sodium lights", ev100: 3, hint: "Little light, and what's there is uneven." },
];

export type Tolerance = "precise" | "standard" | "relaxed";

export const TOLERANCE_STOPS: Record<Tolerance, number> = {
  precise: 1 / 3,
  standard: 2 / 3,
  relaxed: 1,
};

export const TOLERANCE_LABELS: Record<Tolerance, string> = {
  precise: "Precise (± ⅓ stop)",
  standard: "Standard (± ⅔ stop)",
  relaxed: "Relaxed (± 1 stop)",
};

export function pickCondition(random: () => number = Math.random): LightCondition {
  const i = Math.floor(random() * LIGHT_CONDITIONS.length);
  return LIGHT_CONDITIONS[Math.min(i, LIGHT_CONDITIONS.length - 1)];
}

export interface Guess {
  errorStops: number;
  correct: boolean;
}

/** Grades a guessed (aperture, shutter) against the scene, at the given ISO and tolerance. */
export function scoreGuess(sceneEv100: number, fNumber: number, shutterSec: number, iso: number, tolerance: Tolerance): Guess {
  const errorStops = exposureError(sceneEv100, fNumber, shutterSec, iso);
  return { errorStops, correct: Math.abs(errorStops) <= TOLERANCE_STOPS[tolerance] };
}

/** Every (aperture, shutter) pair from the given stops/speeds that would also have scored correct. */
export function equivalentCombos(
  sceneEv100: number,
  iso: number,
  tolerance: Tolerance,
  apertures: number[],
  shutters: number[]
): { fNumber: number; shutterSec: number }[] {
  const combos: { fNumber: number; shutterSec: number }[] = [];
  for (const fNumber of apertures) {
    for (const shutterSec of shutters) {
      if (Math.abs(exposureError(sceneEv100, fNumber, shutterSec, iso)) <= TOLERANCE_STOPS[tolerance]) {
        combos.push({ fNumber, shutterSec });
      }
    }
  }
  return combos;
}
