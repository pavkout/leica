// Push/pull processing (RANGEFINDER_MASTER_PLAN.md feature #11): rating a
// film away from its box speed changes what light reaches the negative
// (exposure physics, handled by the existing exposure engine using the
// exposure index as the metering ISO); compensating in development changes
// only how that captured image is rendered — contrast, shadow separation,
// grain and highlight headroom. The two are kept separate on purpose per the
// spec's own engineering requirement.
//
// The response curve below is a single generic approximation, not a
// per-stock characteristic curve — this project doesn't invent specific
// developer/process numbers it can't source. `pushPullSupport` instead
// scopes each stock to the stops range where push/pull is common,
// predictable real-world practice; outside that range the same generic
// curve still renders (so the preview never just freezes), but callers
// should present it as an unsupported/unpredictable combination.

import type { FilmLook } from "../preview/film";

export type DevelopmentIntent = "normal" | "push" | "pull";

/** Whole-stop rating choices offered in the UI, relative to box speed. */
export const EI_STOP_RANGE = [-2, -1, 0, 1, 2, 3] as const;
export type EiStop = (typeof EI_STOP_RANGE)[number];

export interface PushPullSupport {
  /** Stops of push commonly done for this stock/process before results become unpredictable. */
  maxPush: number;
  /** Stops of pull commonly done for this stock/process. */
  maxPull: number;
}

/**
 * Black-and-white push/pull (extended or reduced development time) is a
 * mature, predictable technique over a wide range. Slide (E-6) push/pull is
 * common but the stock's own latitude is already narrow. Colour negative
 * (C-41) push is uncommon and inconsistent across labs, so it gets a narrow
 * allowance and pull essentially none. Digital has no development step.
 */
export function pushPullSupport(look: FilmLook): PushPullSupport {
  if (look.kind === "digital") return { maxPush: 0, maxPull: 0 };
  if (look.kind === "bw") return { maxPush: 3, maxPull: 2 };
  if (look.kind === "slide") return { maxPush: 1, maxPull: 1 };
  return { maxPush: 1, maxPull: 0 };
}

export function developmentIntent(stops: number): DevelopmentIntent {
  if (stops > 0) return "push";
  if (stops < 0) return "pull";
  return "normal";
}

export function isCommonPractice(look: FilmLook, stops: number): boolean {
  const { maxPush, maxPull } = pushPullSupport(look);
  return stops >= -maxPull && stops <= maxPush;
}

/** The rated ISO used for metering: box speed shifted by the chosen stops. */
export function exposureIndex(boxIso: number, stops: number): number {
  return boxIso * 2 ** stops;
}

export interface DevelopmentResponse {
  /** Multiplier on the look's tone-curve softness (<1 is more contrasty, >1 flatter). */
  softnessScale: number;
  /** Added to the look's blackLift: pushing loses shadow separation, pulling deepens it. */
  blackLiftDelta: number;
  /** Multiplier on the look's grain/noise strength. */
  grainScale: number;
  /** Subtracted from the look's overexposure latitude: pushing compresses highlight headroom, pulling extends it. */
  highlightLatitudeDelta: number;
  /** Whether `stops` is within `pushPullSupport(look)` — otherwise this is a generic fallback, not this stock's real character. */
  commonPractice: boolean;
}

const PER_STOP = {
  push: { softness: 0.18, blackLift: 0.012, grain: 0.22, highlight: 0.35 },
  pull: { softness: 0.12, blackLift: 0.006, grain: 0.08, highlight: 0.2 },
};

/**
 * Development-side compensation for a given rating, applied to a film look's
 * rendering parameters. `stops` is signed: positive pushes, negative pulls.
 */
export function developmentResponse(look: FilmLook, stops: number): DevelopmentResponse {
  const sign = Math.sign(stops);
  const magnitude = Math.abs(stops);
  const per = stops >= 0 ? PER_STOP.push : PER_STOP.pull;
  return {
    softnessScale: Math.max(0.35, 1 - sign * per.softness * magnitude),
    blackLiftDelta: sign * per.blackLift * magnitude,
    grainScale: Math.max(0.5, 1 + sign * per.grain * magnitude),
    highlightLatitudeDelta: sign * per.highlight * magnitude,
    commonPractice: isCommonPractice(look, stops),
  };
}

/** Applies a `DevelopmentResponse` to a look, producing the look actually rendered. */
export function developedLook(look: FilmLook, stops: number): FilmLook {
  if (stops === 0 || look.kind === "digital") return look;
  const r = developmentResponse(look, stops);
  return {
    ...look,
    softness: Math.max(0.1, look.softness * r.softnessScale),
    blackLift: Math.min(1, Math.max(0, look.blackLift + r.blackLiftDelta)),
    grain: Math.max(0, look.grain * r.grainScale),
    latitude: [look.latitude[0], Math.max(0.25, look.latitude[1] - r.highlightLatitudeDelta)],
  };
}
