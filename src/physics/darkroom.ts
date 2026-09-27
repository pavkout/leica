// Darkroom mode (feature #34): a conceptual model of black-and-white
// development — how developer type, dilution, agitation, temperature and
// push/pull shift contrast, grain and sharpness *tendencies*. It is not a
// process: it never produces development times. Real times belong to a
// sourced dataset (PROCESS_TIMES, empty until verified manufacturer data is
// added with citations); without an entry the app says so instead of
// guessing. Every effect size here is illustrative.

import type { Provenance } from "../data/provenance";
import type { FilmLook } from "../preview/film";
import { grainMultiplier, softnessForPush } from "./pushPull";

export const DARKROOM_PROVENANCE: Provenance = {
  kind: "illustrative",
  notes:
    "Directions of effect follow standard black-and-white darkroom teaching; the sizes are illustrative, not measured for any film or developer. No development times are modelled.",
};

export type DeveloperType = "fine-grain" | "general" | "acutance";
export type Dilution = "stock" | "1+1" | "1+3";
export type Agitation = "continuous" | "intermittent" | "minimal";

export const DEVELOPER_TYPES: { id: DeveloperType; label: string; note: string }[] = [
  { id: "fine-grain", label: "Fine-grain (solvent)", note: "Dissolves some silver as it develops: finer grain and softer edges, often at a small cost in film speed." },
  { id: "general", label: "General purpose", note: "A balance of grain, sharpness and speed." },
  { id: "acutance", label: "High-acutance", note: "Little solvent action, usually used dilute: crisper edges and more visible grain." },
];

export const DILUTIONS: { id: Dilution; label: string; note: string }[] = [
  { id: "stock", label: "Stock", note: "Strongest solution: shortest times, most solvent effect." },
  { id: "1+1", label: "1+1", note: "Diluted: longer times, a little more edge sharpness, less solvent effect." },
  { id: "1+3", label: "1+3", note: "Very dilute: developer exhausts in dense highlights, restraining them (compensation) and sharpening edges." },
];

export const AGITATIONS: { id: Agitation; label: string; note: string }[] = [
  { id: "continuous", label: "Continuous", note: "Fresh developer everywhere all the time: most contrast, most even." },
  { id: "intermittent", label: "Intermittent", note: "The usual inversions at intervals: the reference." },
  { id: "minimal", label: "Minimal (stand)", note: "Highlights exhaust their local developer: compensation and edge effects, with a real risk of uneven development and streaks." },
];

/** Standardised colour processes: developer, dilution and agitation aren't user choices. */
export function colourProcess(look: FilmLook): "C-41" | "E-6" | null {
  if (look.kind === "color-negative") return "C-41";
  if (look.kind === "slide") return "E-6";
  return null;
}

export interface DevelopChoice {
  developer: DeveloperType;
  dilution: Dilution;
  agitation: Agitation;
  /** Developer temperature, °C. Conceptual only: it moves the time a chart would give, not the result. */
  temperatureC: number;
  /** Push (+) / pull (−) development, stops. */
  developStops: number;
}

export const REFERENCE_CHOICE: DevelopChoice = { developer: "general", dilution: "stock", agitation: "intermittent", temperatureC: 20, developStops: 0 };

const DEV_FACTORS: Record<DeveloperType, { contrast: number; grain: number; acutance: number }> = {
  "fine-grain": { contrast: 0.97, grain: 0.8, acutance: 0.9 },
  general: { contrast: 1, grain: 1, acutance: 1 },
  acutance: { contrast: 1.03, grain: 1.2, acutance: 1.2 },
};
const DIL_FACTORS: Record<Dilution, { highlight: number; grain: number; acutance: number }> = {
  stock: { highlight: 1, grain: 1, acutance: 1 },
  "1+1": { highlight: 0.96, grain: 1.05, acutance: 1.07 },
  "1+3": { highlight: 0.9, grain: 1.1, acutance: 1.15 },
};
const AGIT_FACTORS: Record<Agitation, { contrast: number; highlight: number; acutance: number; unevenRisk: boolean }> = {
  continuous: { contrast: 1.06, highlight: 1.04, acutance: 0.97, unevenRisk: false },
  intermittent: { contrast: 1, highlight: 1, acutance: 1, unevenRisk: false },
  minimal: { contrast: 0.93, highlight: 0.88, acutance: 1.12, unevenRisk: true },
};

export interface ConceptualResult {
  /** Relative to normal development of the same film (1 = the same). */
  contrast: number;
  grain: number;
  acutance: number;
  /** Highlight density relative to normal (below 1 = compensated, above 1 = denser). */
  highlights: number;
  /** Stops of shadow detail missing because the film was rated faster than box speed; development can't bring it back. */
  shadowLossStops: number;
  /** Which way a sourced time would move with this temperature, relative to the chart's reference. */
  timeDirection: "shorter" | "reference" | "longer";
  unevenRisk: boolean;
  provenance: Provenance;
}

/**
 * The conceptual outcome for a black-and-white film. `eiStops` is how far the
 * roll was rated from box speed (positive = faster, i.e. underexposed).
 */
export function conceptualResult(look: FilmLook, c: DevelopChoice, eiStops: number, chartTempC = 20): ConceptualResult {
  const d = DEV_FACTORS[c.developer];
  const l = DIL_FACTORS[c.dilution];
  const a = AGIT_FACTORS[c.agitation];
  // Push/pull reuses the app's shared response (the same curve the roll preview uses).
  const pushContrast = look.softness / softnessForPush(look.softness, c.developStops);
  return {
    contrast: pushContrast * d.contrast * a.contrast,
    grain: grainMultiplier(c.developStops) * d.grain * l.grain,
    acutance: d.acutance * l.acutance * a.acutance,
    highlights: pushContrast * l.highlight * a.highlight,
    shadowLossStops: Math.max(0, eiStops),
    timeDirection: Math.abs(c.temperatureC - chartTempC) < 0.5 ? "reference" : c.temperatureC > chartTempC ? "shorter" : "longer",
    unevenRisk: a.unevenRisk,
    provenance: DARKROOM_PROVENANCE,
  };
}

/**
 * Illustrative characteristic curve: negative density against relative log
 * exposure (0 = middle grey exposed at box speed). A logistic from fog (0.1)
 * to a shoulder whose height follows the highlight density; its mid-slope
 * (gamma) is 0.62 × the relative contrast. Rating faster shifts every
 * exposure left by 0.3 log units per stop — development can't move it back.
 */
export const FOG = 0.1;
export function densityAt(logE: number, result: Pick<ConceptualResult, "contrast" | "highlights">, eiStops: number): number {
  const x = logE - eiStops * 0.3;
  const dmax = 2.1 * result.highlights;
  const k = (4 * 0.62 * result.contrast) / (dmax - FOG);
  return FOG + (dmax - FOG) / (1 + Math.exp(-k * (x - 0.5)));
}

/** A development time taken from a cited source (manufacturer datasheet or a documented community database). */
export interface SourcedTime {
  filmId: string;
  developer: string;
  dilution: string;
  temperatureC: number;
  developStops: number;
  minutes: number;
  source: string;
  url: string;
}

/**
 * Verified development times. Empty on purpose: the app's developer choices
 * are generic types, not named products, and no times have been checked
 * against a manufacturer's datasheet. Add entries only with a citation.
 */
export const PROCESS_TIMES: SourcedTime[] = [];

/** A sourced time for this exact combination, or null — never an estimate. */
export function lookupTime(filmId: string, developer: string, dilution: string, temperatureC: number, developStops: number, table: SourcedTime[] = PROCESS_TIMES): SourcedTime | null {
  return (
    table.find(
      (t) => t.filmId === filmId && t.developer === developer && t.dilution === dilution && t.temperatureC === temperatureC && t.developStops === developStops && !!t.source && /^https:\/\//.test(t.url),
    ) ?? null
  );
}

/** The development of the current roll, recorded for the Film Roll Companion. */
export interface DevelopmentRecord {
  filmId: string;
  filmName: string;
  frames: number;
  choice: DevelopChoice;
  /** ISO date. */
  recordedAt: string;
}

export function describeRecord(r: DevelopmentRecord): string {
  const push = r.choice.developStops === 0 ? "normal" : r.choice.developStops > 0 ? `push +${r.choice.developStops}` : `pull ${r.choice.developStops}`;
  const dev = DEVELOPER_TYPES.find((d) => d.id === r.choice.developer)!.label;
  return `${r.filmName}, ${r.frames} frame${r.frames === 1 ? "" : "s"}: ${push} · ${dev} ${r.choice.dilution} · ${r.choice.agitation} agitation · ${r.choice.temperatureC} °C (conceptual)`;
}

export function parseRecord(json: string | null): DevelopmentRecord | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as DevelopmentRecord;
    return r && typeof r.filmId === "string" && r.choice && typeof r.choice.developStops === "number" ? r : null;
  } catch {
    return null;
  }
}
