// Long Exposure Lab (feature #36): a single light moves on a black screen and
// the user's own camera, on a tripod, builds the trail. Everything here is
// pure: pattern geometry, time-driven phase (never frame-driven, so a cycle
// lasts its stated duration at any refresh rate or after dropped frames), and
// the starting-point settings, which are approximate by nature because the
// screen's luminance is unknown.

import { settingEv } from "./exposure";
import { srgbToLinear } from "./meter";
import { distanceForField } from "./lensTrial";

export type PatternId = "circle" | "infinity" | "hsweep" | "vsweep" | "spiral" | "lissajous" | "drawn" | "text";

export interface Pt {
  x: number;
  y: number;
}

export interface PatternParams {
  /** Spiral: turns from the centre outwards. */
  turns: number;
  /** Lissajous frequencies (integers close the curve in one cycle). */
  a: number;
  b: number;
  /** Drawn and text patterns: strokes in the unit box. The light jumps (dark) between strokes. */
  strokes?: Pt[][];
}

export const DEFAULT_PATTERN_PARAMS: PatternParams = { turns: 3, a: 3, b: 2 };

export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "infinity", label: "Infinity" },
  { id: "hsweep", label: "Horizontal sweep" },
  { id: "vsweep", label: "Vertical sweep" },
  { id: "spiral", label: "Spiral" },
  { id: "lissajous", label: "Lissajous" },
  { id: "drawn", label: "Your drawing" },
  { id: "text", label: "Words" },
];

/** Where the light is along a set of strokes at `phase`, at constant speed; `stroke` says which one. */
export function strokeSample(strokes: Pt[][], phase: number): Pt & { stroke: number } {
  const lens = strokes.map((st) => st.slice(1).reduce((sum, q, i) => sum + Math.hypot(q.x - st[i].x, q.y - st[i].y), 0));
  const total = lens.reduce((a, b) => a + b, 0);
  if (strokes.length === 0 || total === 0) return { x: 0, y: 0, stroke: -1 };
  let d = Math.min(1, Math.max(0, phase)) * total;
  for (let k = 0; k < strokes.length; k++) {
    const st = strokes[k];
    if (d <= lens[k] || k === strokes.length - 1) {
      for (let i = 1; i < st.length; i++) {
        const seg = Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y);
        if (d <= seg || i === st.length - 1) {
          const f = seg > 0 ? Math.min(1, d / seg) : 0;
          return { x: st[i - 1].x + (st[i].x - st[i - 1].x) * f, y: st[i - 1].y + (st[i].y - st[i - 1].y) * f, stroke: k };
        }
        d -= seg;
      }
      return { ...st[st.length - 1], stroke: k };
    }
    d -= lens[k];
  }
  return { x: 0, y: 0, stroke: -1 };
}

/**
 * Clean up a hand-drawn stroke list for playback: drop points closer than
 * `minStep`, drop strokes with no length, and keep everything inside the box.
 */
export function tidyStrokes(strokes: Pt[][], minStep = 0.012): Pt[][] {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return strokes
    .map((st) =>
      st
        .map((q) => ({ x: clamp(q.x), y: clamp(q.y) }))
        .filter((q, i, arr) => i === 0 || Math.hypot(q.x - arr[i - 1].x, q.y - arr[i - 1].y) >= minStep),
    )
    .filter((st) => st.length > 1);
}

/** Position in the unit box [-1, 1]² (y up) at `phase` ∈ [0, 1] of a cycle. */
export function patternPoint(id: PatternId, phase: number, p: PatternParams = DEFAULT_PATTERN_PARAMS): { x: number; y: number } {
  const t = 2 * Math.PI * phase;
  // Ping-pong for the sweeps: out and back in one cycle, so a loop never jumps.
  const tri = 1 - 4 * Math.abs(phase - 0.5);
  switch (id) {
    case "circle":
      return { x: Math.sin(t), y: Math.cos(t) };
    case "infinity":
      // Lemniscate of Gerono: a figure-eight, closed once per cycle.
      return { x: Math.sin(t), y: Math.sin(2 * t) / 2 };
    case "hsweep":
      return { x: -tri, y: 0 };
    case "vsweep":
      return { x: 0, y: -tri };
    case "spiral":
      return { x: phase * Math.sin(p.turns * t), y: phase * Math.cos(p.turns * t) };
    case "lissajous":
      return { x: Math.sin(p.a * t + Math.PI / 2), y: Math.sin(p.b * t) };
    case "drawn":
    case "text": {
      const q = strokeSample(p.strokes ?? [], phase);
      return { x: q.x, y: q.y };
    }
  }
}

/** Length of one cycle's path in unit-box units (numerical; jumps between strokes aren't path). */
export function pathLength(id: PatternId, p: PatternParams = DEFAULT_PATTERN_PARAMS, samples = 2000): number {
  if (id === "drawn" || id === "text") {
    return (p.strokes ?? []).reduce((sum, st) => sum + st.slice(1).reduce((s2, q, i) => s2 + Math.hypot(q.x - st[i].x, q.y - st[i].y), 0), 0);
  }
  let len = 0;
  let prev = patternPoint(id, 0, p);
  for (let i = 1; i <= samples; i++) {
    const q = patternPoint(id, i / samples, p);
    len += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  return len;
}

/**
 * Where in the pattern the light is `elapsedMs` after the run started. Driven
 * by elapsed time only. A one-shot run is `done` after one cycle (the light
 * goes out and stays out).
 */
export function phaseAt(elapsedMs: number, cycleMs: number, loop: boolean): { phase: number; cycle: number; done: boolean } {
  const c = Math.max(0, elapsedMs) / cycleMs;
  if (!loop && c >= 1) return { phase: 1, cycle: 1, done: true };
  return { phase: c - Math.floor(c), cycle: Math.floor(c), done: false };
}

/** How many cycles a shutter time records, and what that looks like. */
export function cyclesRecorded(shutterSec: number, cycleSec: number, loop: boolean): { cycles: number; expect: "partial" | "one" | "repeated" } {
  const raw = shutterSec / cycleSec;
  const cycles = loop ? raw : Math.min(raw, 1);
  const expect = cycles < 0.95 ? "partial" : cycles <= 1.05 ? "one" : "repeated";
  return { cycles, expect };
}

export interface LightParams {
  pattern: PatternId;
  params: PatternParams;
  cycleSec: number;
  /** Point diameter on screen, CSS px. */
  sizePx: number;
  /** 0–1. */
  brightness: number;
}

/** The reference run the starting point is quoted for: an infinity, 4 s, 12 px, full brightness at ISO 100, f/8. */
export const REFERENCE_LIGHT: LightParams = { pattern: "infinity", params: DEFAULT_PATTERN_PARAMS, cycleSec: 4, sizePx: 12, brightness: 1 };
export const REFERENCE_SETTING = { iso: 100, fNumber: 8 };

/**
 * Trail exposure relative to the reference run, in stops. With a black
 * background the trail's brightness doesn't depend on the shutter time (a
 * longer exposure repeats the path, it doesn't brighten a pass). It depends on
 * the light's brightness and its dwell time on each spot: point size ÷ speed,
 * where speed = path length ÷ cycle time.
 */
export function trailStops(light: LightParams, ref: LightParams = REFERENCE_LIGHT): number {
  // An empty drawing has no path; treat it as a tiny one rather than dividing by zero.
  const dwell = (l: LightParams) => (l.sizePx * l.cycleSec) / Math.max(0.01, pathLength(l.pattern, l.params));
  return Math.log2(light.brightness / ref.brightness) + Math.log2(dwell(light) / dwell(ref));
}

export interface Suggestion {
  iso: number;
  fNumber: number;
  /** Shutter time for one complete pattern (loop: one cycle). */
  shutterSec: number;
  /** Stops the snapped aperture leaves the trail over (+) or under (−) the reference density. */
  residualStops: number;
  /** The body's slowest marked speed is shorter than the cycle: use B and time it. */
  useBulb: boolean;
  provenance: "approximate";
}

/**
 * A starting point, not a guaranteed exposure: the aperture at `iso` that
 * gives the trail the reference density, via the shared exposure engine's
 * stop arithmetic, snapped to the lens's stops.
 */
export function suggestSettings(light: LightParams, iso: number, stops: number[], slowestSec: number): Suggestion {
  // Trail density ∝ ISO · dwell · brightness / N². Keep it at the reference's.
  const extraStops = Math.log2(iso / REFERENCE_SETTING.iso) + trailStops(light);
  const ideal = REFERENCE_SETTING.fNumber * Math.pow(2, extraStops / 2);
  const fNumber = stops.reduce((best, s) => (Math.abs(Math.log(s / ideal)) < Math.abs(Math.log(best / ideal)) ? s : best), stops[0]);
  // settingEv at a fixed time compares apertures in stops: log2(N²).
  const residualStops = settingEv(ideal, 1) - settingEv(fNumber, 1);
  return { iso, fNumber, shutterSec: light.cycleSec, residualStops, useBulb: light.cycleSec > slowestSec * 1.001, provenance: "approximate" };
}

/** Share of the screen's short side the pattern box uses (the stage draws into this square). */
export const PATTERN_FILL = 0.8;

/**
 * Camera-to-screen distance so the pattern box fills about two-thirds of the
 * frame's short side, never closer than the lens focuses.
 */
export function suggestedDistanceMm(focalMm: number, frameShortMm: number, screenShortMm: number, minFocusMm: number): number {
  const patternMm = screenShortMm * PATTERN_FILL;
  const d = distanceForField(focalMm, patternMm * 1.5, frameShortMm);
  return Math.max(d, minFocusMm);
}

/** A rough guess of the screen's short side from its CSS size (editable; approximate). */
export function guessScreenShortMm(cssShortSide: number): number {
  if (cssShortSide < 500) return 65; // phone
  if (cssShortSide < 900) return 160; // tablet
  return 190; // laptop / monitor
}

export const LIGHT_COLOURS: { id: string; label: string; rgb: [number, number, number] }[] = [
  { id: "white", label: "White", rgb: [255, 255, 255] },
  { id: "red", label: "Red", rgb: [255, 40, 30] },
  { id: "amber", label: "Amber", rgb: [255, 170, 40] },
  { id: "green", label: "Green", rgb: [60, 255, 90] },
  { id: "blue", label: "Blue", rgb: [60, 120, 255] },
];

/** Scale a colour's emitted light by `brightness` (0–1) in linear light, back to sRGB. */
export function dimmedCss(rgb: [number, number, number], brightness: number): string {
  const toLinear = (v8: number) => srgbToLinear(v8);
  const toSrgb = (l: number) => {
    const v = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  const [r, g, b] = rgb.map((c) => toSrgb(toLinear(c) * brightness));
  return `rgb(${r}, ${g}, ${b})`;
}

/** One light in a multi-light run. All lights share the cycle time; each can start part-way round. */
export interface LabLight {
  pattern: PatternId;
  params: PatternParams;
  sizePx: number;
  /** 0–1. */
  brightness: number;
  colourId: string;
  /** Head start as a fraction of the cycle (0–1), so lights can chase each other on one path. */
  offset: number;
}

export const MAX_LIGHTS = 3;

/** Phase of a light at a run phase, with its head start. */
export function lightPhase(runPhase: number, offset: number): number {
  const p = runPhase + offset;
  return p - Math.floor(p);
}

/**
 * The path a light traces during an exposure of `shutterSec` that starts with
 * the run: a list of polylines in time order (one per pass, split wherever the
 * light jumps). Overlapping passes land on the same spot, which is what makes
 * repeats brighter, not longer. Once-only runs stop after one cycle.
 */
export function exposureTrace(light: Pick<LabLight, "pattern" | "params" | "offset">, cycleSec: number, loop: boolean, shutterSec: number, stepsPerCycle = 720): Pt[][] {
  const runSec = loop ? shutterSec : Math.min(shutterSec, cycleSec);
  const steps = Math.max(2, Math.ceil((runSec / cycleSec) * stepsPerCycle));
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let prevStroke = -2;
  let prev: Pt | null = null;
  const stroked = light.pattern === "drawn" || light.pattern === "text";
  for (let i = 0; i <= steps; i++) {
    const phase = lightPhase((i / steps) * (runSec / cycleSec), light.offset);
    const q = stroked ? strokeSample(light.params.strokes ?? [], phase) : { ...patternPoint(light.pattern, phase, light.params), stroke: 0 };
    const jump = prev !== null && (q.stroke !== prevStroke || Math.hypot(q.x - prev.x, q.y - prev.y) > 0.25);
    if (jump && cur.length) {
      out.push(cur);
      cur = [];
    }
    cur.push({ x: q.x, y: q.y });
    prev = q;
    prevStroke = q.stroke;
  }
  if (cur.length) out.push(cur);
  return out.filter((pl) => pl.length > 1);
}
