// Flare Lab (feature #25): an artistic flare kernel. Deterministic and pure.
//
// What's calculated vs artistic:
// - calculated: the light's field angle (from the lens's real angle of view),
//   whether it's inside the frame, the hood only acting on light from outside
//   the frame's angle of view, ghosts taking the iris shape at the current
//   aperture, and the diffraction-star spike count (n for an even blade count,
//   2n for an odd one).
// - artistic: ghost positions, sizes, brightness, veiling glare and the hood's
//   exact falloff. Not ray-traced; no lens has a measured flare profile yet.

import type { Lens } from "../data/gear";
import type { Provenance } from "../data/provenance";
import { apertureShape } from "../preview/aperture";

export interface FlareGhost {
  /** Centre in frame coordinates: x, y in [-1, 1] across the frame's width/height. */
  x: number;
  y: number;
  /** Radius as a fraction of the frame height. */
  r: number;
  alpha: number;
  /** Tint, degrees of hue (coatings tint ghosts). */
  hue: number;
}

export interface FlareResult {
  /** Field angle of the light from the lens axis, degrees. */
  angleDeg: number;
  inFrame: boolean;
  /** Share of stray light the hood lets through (1 without a hood). */
  hoodTransmission: number;
  ghosts: FlareGhost[];
  /** Overall haze over the frame, 0–1. */
  veil: number;
  spikes: { count: number; length: number; alpha: number };
  /** Iris shape the ghosts take. */
  shape: ReturnType<typeof apertureShape>;
}

/** A flare profile: where ghosts sit along the source–centre line, how big and bright they are. */
export interface FlareProfile {
  provenance: Provenance;
  /** Ghost positions as multiples of the source position (negative = mirrored across the centre). */
  ghosts: { t: number; size: number; weight: number; hue: number }[];
}

/** The default profile for every lens: an artistic approximation. Measured profiles can be added per lens later. */
export const ARTISTIC_FLARE_PROFILE: FlareProfile = {
  provenance: {
    kind: "illustrative",
    notes: "Artistic approximation — not ray-traced and not measured for this lens. Ghost shapes follow the iris, spike counts follow the blade count, and the hood acts only on light from outside the frame; brightness, sizes and positions are illustrative.",
  },
  ghosts: [
    { t: 0.55, size: 0.05, weight: 0.35, hue: 40 },
    { t: -0.25, size: 0.09, weight: 0.25, hue: 140 },
    { t: -0.6, size: 0.06, weight: 0.3, hue: 200 },
    { t: -1.0, size: 0.13, weight: 0.18, hue: 280 },
    { t: -1.45, size: 0.08, weight: 0.22, hue: 20 },
  ],
};

/** Measured/calibrated profiles by lens id. Empty: none have been measured. */
export const FLARE_PROFILES: Record<string, FlareProfile> = {};

export function flareProfileFor(lensId: string): FlareProfile {
  return FLARE_PROFILES[lensId] ?? ARTISTIC_FLARE_PROFILE;
}

export interface FrameMm {
  width: number;
  height: number;
}

/** Field angle (degrees) of a point at frame coordinates (x, y), for an ideal lens of this focal length. */
export function fieldAngleDeg(x: number, y: number, focalMm: number, frame: FrameMm): number {
  return (Math.atan(Math.hypot((x * frame.width) / 2, (y * frame.height) / 2) / focalMm) * 180) / Math.PI;
}

/** Diffraction-star spikes from straight blade edges: n for an even blade count, 2n for an odd one. */
export function spikeCount(blades: number): number {
  return blades % 2 === 0 ? blades : 2 * blades;
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Hood effect on stray light arriving at `angleDeg`. A hood can't block light
 * from inside the frame's angle of view (that light forms the image); it cuts
 * light from beyond the frame corner. The falloff beyond the corner is illustrative.
 */
export function hoodTransmission(angleDeg: number, focalMm: number, frame: FrameMm, hood: boolean): number {
  if (!hood) return 1;
  const cornerDeg = fieldAngleDeg(1, 1, focalMm, frame);
  return 1 - 0.9 * smoothstep(cornerDeg, cornerDeg * 1.35, angleDeg);
}

export interface FlareInput {
  lens: Lens;
  fNumber: number;
  frame: FrameMm;
  /** Light position in frame coordinates; beyond ±1 is outside the frame. */
  x: number;
  y: number;
  /** Source brightness, 0–1. */
  intensity: number;
  hood: boolean;
  profile?: FlareProfile;
}

export function flareKernel({ lens, fNumber, frame, x, y, intensity, hood, profile = flareProfileFor(lens.id) }: FlareInput): FlareResult {
  const angleDeg = fieldAngleDeg(x, y, lens.focalMm, frame);
  const inFrame = Math.abs(x) <= 1 && Math.abs(y) <= 1;
  const transmission = hoodTransmission(angleDeg, lens.focalMm, frame, hood);
  const shape = apertureShape(lens, fNumber);
  // Ghosts are images of the aperture: they shrink as the lens stops down.
  const pupil = Math.sqrt(lens.maxAperture / fNumber);
  // Stray light is strongest from a source near or just beyond the frame edge (illustrative).
  const edge = Math.max(Math.abs(x), Math.abs(y));
  const angular = 0.45 + 0.55 * smoothstep(0.2, 1.05, edge) * (1 - smoothstep(1.35, 2, edge));
  const strength = intensity * transmission * angular;

  const ghosts = profile.ghosts.map((g) => ({ x: x * g.t, y: y * g.t, r: g.size * (0.35 + 0.65 * pupil), alpha: Math.min(1, g.weight * strength), hue: g.hue }));
  const veil = Math.min(0.6, 0.35 * strength);
  // Spikes show once blades have straight edges, growing as the lens stops down; hidden behind the hood when the source is out of frame.
  const straightness = 1 - shape.roundness;
  const spikes = { count: spikeCount(shape.blades), length: 0.08 + 0.4 * straightness, alpha: inFrame ? Math.min(1, intensity * straightness * 1.6) : 0 };

  return { angleDeg, inFrame, hoodTransmission: transmission, ghosts, veil, spikes, shape };
}
