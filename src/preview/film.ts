// Film stocks and sensor looks for the develop stage.
//
// These are approximations inspired by each stock's published character
// (speed, latitude, contrast, colour, grain); the names are trademarks of
// their owners. The tone curve works in stops around middle grey:
// y = 0.5 + 0.5·tanh((stops + bias) / softness).

import type { Body } from "../data/gear";
import type { Provenance } from "../data/provenance";
import { PUSH_PULL_PROVENANCE, grainMultiplier, softnessForPush } from "../physics/pushPull";

export type LookKind = "color-negative" | "slide" | "bw" | "digital";

export interface FilmLook {
  id: string;
  name: string;
  kind: LookKind;
  /** How this look's tone/color/grain parameters were derived. */
  provenance: Provenance;
  iso: number;
  /** Stops of under- and overexposure the stock tolerates. */
  latitude: [number, number];
  description: string;
  mono: boolean;
  /** Tone-curve softness: higher is flatter with more latitude. Digital uses a clip instead. */
  softness: number;
  bias: number;
  saturation: number;
  /** Colour balance applied in linear light. */
  balance: [number, number, number];
  shadowTint: [number, number, number];
  highlightTint: [number, number, number];
  /** Grain (film) or noise (digital) strength at the stock's own speed. */
  grain: number;
  /** Red glow around highlights, strong on film without an anti-halation layer. */
  halation: number;
  /** Lifted black of a scanned negative. */
  blackLift: number;
  /** Canister colours for the illustration. */
  colors: [string, string];
}

/** Every film look here is a visual approximation, not a scan-calibrated profile. */
const APPROXIMATE_LOOK: Provenance = {
  kind: "approximate",
  notes: "Tone curve, colour and grain are approximated from the stock's published character, not derived from calibrated scans.",
};

export const FILM_STOCKS: FilmLook[] = [
  {
    id: "portra400", name: "Portra 400", kind: "color-negative", provenance: APPROXIMATE_LOOK, iso: 400, latitude: [2, 3],
    description: "Soft, warm skin tones and huge overexposure latitude. The portrait standard.",
    mono: false, softness: 3.2, bias: 0.15, saturation: 0.9, balance: [1.04, 1, 0.94],
    shadowTint: [0.0, 0.01, 0.02], highlightTint: [0.02, 0.01, -0.01], grain: 0.5, halation: 0.12, blackLift: 0.035,
    colors: ["#e9dcc0", "#b8862e"],
  },
  {
    id: "ektar100", name: "Ektar 100", kind: "color-negative", provenance: APPROXIMATE_LOOK, iso: 100, latitude: [1, 2],
    description: "Vivid, saturated colour and the finest grain of any colour negative.",
    mono: false, softness: 2.3, bias: 0.05, saturation: 1.35, balance: [1.02, 1, 0.97],
    shadowTint: [0.0, 0.0, 0.015], highlightTint: [0.015, 0.005, -0.01], grain: 0.28, halation: 0.08, blackLift: 0.02,
    colors: ["#f2f2f2", "#c8392b"],
  },
  {
    id: "gold200", name: "Gold 200", kind: "color-negative", provenance: APPROXIMATE_LOOK, iso: 200, latitude: [1.5, 2.5],
    description: "Golden, nostalgic warmth with visible grain. Summer holiday colour.",
    mono: false, softness: 2.7, bias: 0.1, saturation: 1.1, balance: [1.08, 1.02, 0.86],
    shadowTint: [0.01, 0.005, -0.01], highlightTint: [0.03, 0.02, -0.02], grain: 0.62, halation: 0.12, blackLift: 0.03,
    colors: ["#f3c230", "#b5261e"],
  },
  {
    id: "cinestill800t", name: "CineStill 800T", kind: "color-negative", provenance: APPROXIMATE_LOOK, iso: 800, latitude: [1.5, 2.5],
    description: "Tungsten-balanced cinema film with no anti-halation layer: red glows around every light.",
    mono: false, softness: 2.6, bias: 0.1, saturation: 1.05, balance: [0.86, 0.98, 1.16],
    shadowTint: [-0.01, 0.01, 0.03], highlightTint: [0.02, 0.0, -0.01], grain: 0.72, halation: 1, blackLift: 0.03,
    colors: ["#1f2a44", "#cf2e25"],
  },
  {
    id: "velvia50", name: "Velvia 50", kind: "slide", provenance: APPROXIMATE_LOOK, iso: 50, latitude: [0.5, 0.5],
    description: "Slide film: saturated, contrasty and unforgiving. Half a stop off shows.",
    mono: false, softness: 1.6, bias: 0, saturation: 1.5, balance: [1, 1.01, 1.02],
    shadowTint: [0.0, 0.0, 0.02], highlightTint: [0, 0, 0], grain: 0.22, halation: 0.05, blackLift: 0,
    colors: ["#2d6a3e", "#e8e8e8"],
  },
  {
    id: "trix400", name: "Tri-X 400", kind: "bw", provenance: APPROXIMATE_LOOK, iso: 400, latitude: [2, 3],
    description: "Classic black and white: punchy contrast and gritty grain. Street photography's film.",
    mono: true, softness: 2.3, bias: 0.05, saturation: 0, balance: [1, 1, 1],
    shadowTint: [0, 0, 0], highlightTint: [0, 0, 0], grain: 0.85, halation: 0, blackLift: 0.02,
    colors: ["#f1c21b", "#1b1b1b"],
  },
  {
    id: "hp5", name: "HP5 Plus", kind: "bw", provenance: APPROXIMATE_LOOK, iso: 400, latitude: [2, 3],
    description: "Gentler black and white with softer contrast and forgiving latitude.",
    mono: true, softness: 2.9, bias: 0.1, saturation: 0, balance: [1, 1, 1],
    shadowTint: [0, 0, 0], highlightTint: [0, 0, 0], grain: 0.75, halation: 0, blackLift: 0.03,
    colors: ["#f4f4f4", "#1b1b1b"],
  },
  {
    id: "delta3200", name: "Delta 3200", kind: "bw", provenance: APPROXIMATE_LOOK, iso: 3200, latitude: [1.5, 2.5],
    description: "Ultra-fast black and white for night: big, beautiful grain.",
    mono: true, softness: 2.5, bias: 0.1, saturation: 0, balance: [1, 1, 1],
    shadowTint: [0, 0, 0], highlightTint: [0, 0, 0], grain: 1.3, halation: 0, blackLift: 0.03,
    colors: ["#f4f4f4", "#3b5ba5"],
  },
];

const DIGITAL_COLOR: FilmLook = {
  id: "digital", name: "Leica colour", kind: "digital",
  provenance: { kind: "calculated", notes: "Noise model derived from a generic shot-noise-vs-gain curve, not measured against a specific sensor." },
  iso: 100, latitude: [3, 1],
  description: "Neutral digital colour. Highlights clip, shadows recover.",
  mono: false, softness: 0, bias: 0, saturation: 1, balance: [1, 1, 1],
  shadowTint: [0, 0, 0], highlightTint: [0, 0, 0], grain: 0.18, halation: 0, blackLift: 0, colors: ["#222", "#cf2e25"],
};

const DIGITAL_MONO: FilmLook = {
  ...DIGITAL_COLOR, id: "digital-mono", name: "Monochrom sensor", mono: true,
  description: "No colour filter array: every pixel records luminance, so it's cleaner and sharper at high ISO.",
  provenance: { kind: "approximate", notes: "The cleaner-at-high-ISO advantage is real; the exact noise reduction is an estimate, not measured against a specific Monochrom sensor." },
  grain: 0.1,
};

export function findFilm(id: string) {
  return FILM_STOCKS.find((f) => f.id === id) ?? FILM_STOCKS[0];
}

/** The look for a body: the loaded film, or its sensor. */
export function lookFor(body: Body, filmId: string, iso: number): FilmLook {
  if (body.medium === "film") return findFilm(filmId);
  const base = body.medium === "mono" ? DIGITAL_MONO : DIGITAL_COLOR;
  return { ...base, iso };
}

/** Noise/grain strength at the ISO in use, relative to the look's base. */
export function grainStrength(look: FilmLook, body: Body) {
  if (look.kind !== "digital") return look.grain;
  // Sensor noise grows with gain above base ISO (shot noise ∝ √gain).
  const base = body.isoRange?.[0] ?? 100;
  return look.grain * Math.sqrt(Math.max(1, look.iso / base)) * 0.6;
}

/**
 * A film look after push/pull development compensation (`developStops`: 0 =
 * normal, positive = pushed, negative = pulled). Digital sensors don't get
 * "developed" in this sense, so it's a no-op for them; `look.iso` and
 * exposure itself are unaffected either way — this only reshapes the
 * response curve and grain, matching "push/pull as film-development
 * response parameters" in the master plan.
 */
export function developedLook(look: FilmLook, developStops: number): FilmLook {
  if (look.kind === "digital" || developStops === 0) return look;
  return {
    ...look,
    softness: softnessForPush(look.softness, developStops),
    grain: look.grain * grainMultiplier(developStops),
    provenance: PUSH_PULL_PROVENANCE,
  };
}
