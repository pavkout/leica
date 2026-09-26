// Push/pull: shooting film at an exposure index (EI) different from its box
// speed is a metering decision — it changes what the meter/auto-exposure
// recommends, captured by feeding that EI into the same exposure engine
// everything else uses (see physics/exposure.ts: `iso` is already a free
// parameter there). "Push" or "pull" processing is a separate, later
// decision — how the roll is developed — that partially compensates the
// resulting under/over-exposure by changing contrast and grain, not by
// recovering lost light. The two are modeled as independent parameters, as
// the master plan asks, though in practice a photographer usually picks a
// push/pull level that matches how far they rated the roll from box speed.
//
// There's no verified per-stock push/pull data to model individually (film
// manufacturers and labs don't publish curves precise enough for that), so
// one generic response curve is applied to every stock and tagged
// `illustrative` — never measured, never claimed to be stock-specific.

import type { Provenance } from "../data/provenance";

export const PUSH_PULL_PROVENANCE: Provenance = {
  kind: "illustrative",
  notes: "One generic push/pull response curve applied to every stock; real film/developer combinations vary and aren't individually modeled here.",
};

/**
 * Stops the exposure index differs from the stock's box speed. Positive
 * means rated faster than box speed (the capture is under-exposed relative
 * to box speed, before any push development compensates); negative means
 * rated slower (over-exposed, before a pull).
 */
export function eiStops(boxIso: number, ei: number): number {
  return Math.log2(ei / boxIso);
}

export interface DevelopLevel {
  id: string;
  label: string;
  stops: number;
}

export const DEVELOP_LEVELS: DevelopLevel[] = [
  { id: "pull1", label: "Pull 1", stops: -1 },
  { id: "normal", label: "Normal", stops: 0 },
  { id: "push1", label: "Push 1", stops: 1 },
  { id: "push2", label: "Push 2", stops: 2 },
  { id: "push3", label: "Push 3", stops: 3 },
];

/** The development level whose stops are closest to a given value (e.g. an EI deviation, as a helpful default). */
export function nearestDevelopLevel(stops: number): DevelopLevel {
  return DEVELOP_LEVELS.reduce((best, level) => (Math.abs(level.stops - stops) < Math.abs(best.stops - stops) ? level : best));
}

/**
 * Tone-curve softness after development compensation. Push (positive
 * stops) steepens the curve — more contrast, less latitude; pull flattens
 * it. Clamped so it can never reach zero or run away at extreme stops.
 */
export function softnessForPush(baseSoftness: number, developStops: number): number {
  const factor = 1 - developStops * 0.12;
  return Math.max(baseSoftness * 0.35, Math.min(baseSoftness * 2.5, baseSoftness * factor));
}

/**
 * Grain multiplier after development compensation. Both push and pull tend
 * to make grain more visible than a normal-developed frame at box speed.
 */
export function grainMultiplier(developStops: number): number {
  return Math.sqrt(1 + Math.abs(developStops) * 0.5);
}
