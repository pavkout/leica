// Intent-based shooting assistant: translate a photographic goal into a
// concrete (aperture, shutter) recommendation, deterministically. No model,
// no opaque scoring — every recommendation traces back to the same
// `exposureError`/`correctShutter` the rest of the app uses, plus an
// explicit, readable reason.

import { nearestStop } from "../data/gear";
import { correctShutter, exposureError } from "./exposure";

export type IntentId = "freeze-motion" | "shallow-background" | "maximum-depth" | "street-zone-focus";

export interface IntentCard {
  id: IntentId;
  label: string;
  description: string;
}

export const INTENT_CARDS: IntentCard[] = [
  { id: "freeze-motion", label: "Freeze motion", description: "The fastest shutter speed the light allows." },
  { id: "shallow-background", label: "Shallow background", description: "The widest aperture, for the least depth of field." },
  { id: "maximum-depth", label: "Maximum depth", description: "The narrowest aperture that still holds handheld." },
  { id: "street-zone-focus", label: "Street / zone focus", description: "A middle aperture and hyperfocal distance, so you don't have to focus at all." },
];

const TOLERANCE_STOPS = 1 / 3;

export type Lock = { kind: "aperture"; value: number } | { kind: "shutter"; value: number };

export interface IntentInput {
  sceneEv100: number;
  iso: number;
  /** The lens's available aperture stops. */
  apertures: number[];
  /** The body's available shutter speeds, in seconds. */
  shutters: number[];
  focalMm: number;
  /** Current hyperfocal distance, for the street/zone-focus focus suggestion. */
  hyperfocalMm?: number;
  lock?: Lock;
}

export interface IntentResult {
  fNumber: number;
  shutterSec: number;
  focusMm?: number;
  errorStops: number;
  reason: string;
  /** The scene's light doesn't let this intent be met within a third of a stop. */
  compromised: boolean;
}

export interface IntentRecommendation {
  primary: IntentResult;
  alternatives: IntentResult[];
}

/** The shutter speed (from `shutters`) that best exposes at `fNumber`. */
function exposureForAperture(fNumber: number, sceneEv100: number, iso: number, shutters: number[]) {
  const shutterSec = nearestStop(shutters, correctShutter(sceneEv100, fNumber, iso));
  return { fNumber, shutterSec, errorStops: exposureError(sceneEv100, fNumber, shutterSec, iso) };
}

/** The aperture (from `apertures`) that best exposes at `shutterSec`. */
function exposureForShutter(shutterSec: number, sceneEv100: number, iso: number, apertures: number[]) {
  const target = Math.sqrt(shutterSec * 2 ** (sceneEv100 + Math.log2(iso / 100)));
  const fNumber = nearestStop(apertures, target);
  return { fNumber, shutterSec, errorStops: exposureError(sceneEv100, fNumber, shutterSec, iso) };
}

function toResult(
  fromAperture: { fNumber: number; shutterSec: number; errorStops: number },
  reason: string,
  focusMm?: number
): IntentResult {
  return { ...fromAperture, reason, focusMm, compromised: Math.abs(fromAperture.errorStops) > TOLERANCE_STOPS };
}

export function solveIntent(intentId: IntentId, input: IntentInput): IntentRecommendation {
  const { sceneEv100, iso, focalMm, hyperfocalMm, lock } = input;
  const apertures = [...input.apertures].sort((a, b) => a - b); // widest (smallest f-number) first
  const shutters = [...input.shutters].sort((a, b) => a - b); // fastest (smallest duration) first
  const wantsFocus = intentId === "street-zone-focus" ? hyperfocalMm : undefined;

  // A locked parameter removes the choice this intent would otherwise make:
  // there's only one exposure-correct value left for the other one.
  if (lock?.kind === "aperture") {
    const primary = toResult(exposureForAperture(lock.value, sceneEv100, iso, shutters), "Aperture locked; shutter set for correct exposure.", wantsFocus);
    return { primary, alternatives: [] };
  }
  if (lock?.kind === "shutter") {
    const primary = toResult(exposureForShutter(lock.value, sceneEv100, iso, apertures), "Shutter locked; aperture set for correct exposure.", wantsFocus);
    return { primary, alternatives: [] };
  }

  switch (intentId) {
    case "shallow-background": {
      const primary = toResult(exposureForAperture(apertures[0], sceneEv100, iso, shutters), "Widest aperture: the least depth of field this lens can give.", wantsFocus);
      const alternatives = apertures
        .slice(1, 3)
        .map((f) => toResult(exposureForAperture(f, sceneEv100, iso, shutters), "A stop or two down: a little more depth of field.", wantsFocus));
      return { primary, alternatives };
    }

    case "maximum-depth": {
      const handheldLimitSec = 1 / focalMm;
      const narrowToWide = [...apertures].reverse();
      const handheldSafe = narrowToWide.find((f) => exposureForAperture(f, sceneEv100, iso, shutters).shutterSec <= handheldLimitSec);
      const chosen = handheldSafe ?? apertures[apertures.length - 1];
      const primary = toResult(
        exposureForAperture(chosen, sceneEv100, iso, shutters),
        handheldSafe
          ? "Narrowest aperture that still keeps the shutter handheld-safe at this light."
          : "Narrowest available aperture — even so, this light needs a tripod at this focal length.",
        wantsFocus
      );
      const alternatives = apertures
        .filter((f) => f !== chosen)
        .sort((a, b) => Math.abs(a - chosen) - Math.abs(b - chosen))
        .slice(0, 2)
        .map((f) => toResult(exposureForAperture(f, sceneEv100, iso, shutters), "A nearby aperture, trading depth for handheld margin.", wantsFocus));
      return { primary, alternatives };
    }

    case "freeze-motion": {
      let best: ReturnType<typeof exposureForShutter> | null = null;
      for (const t of shutters) {
        const candidate = exposureForShutter(t, sceneEv100, iso, apertures);
        if (Math.abs(candidate.errorStops) <= TOLERANCE_STOPS) {
          best = candidate;
          break;
        }
      }
      const fallback = best ?? exposureForShutter(shutters[0], sceneEv100, iso, apertures);
      const primary = toResult(
        fallback,
        best ? "Fastest shutter this light supports at a correctly exposed aperture." : "Fastest available shutter — this light can't fully expose even wide open.",
        wantsFocus
      );
      const alternatives = shutters
        .filter((t) => t !== fallback.shutterSec && t > fallback.shutterSec)
        .sort((a, b) => a - b)
        .slice(0, 2)
        .map((t) => toResult(exposureForShutter(t, sceneEv100, iso, apertures), "A slower alternative, with more exposure margin.", wantsFocus));
      return { primary, alternatives };
    }

    case "street-zone-focus": {
      const target = nearestStop(apertures, 8);
      const primary = toResult(exposureForAperture(target, sceneEv100, iso, shutters), "A middle aperture with enough depth to zone-focus without adjusting per shot.", hyperfocalMm);
      const alternatives = apertures
        .filter((f) => f !== target)
        .sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
        .slice(0, 2)
        .map((f) => toResult(exposureForAperture(f, sceneEv100, iso, shutters), "An alternative aperture for the same zone-focus approach.", hyperfocalMm));
      return { primary, alternatives };
    }
  }
}
