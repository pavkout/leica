// Photography Lab (#43): exercises for the camera in your hands. Each one
// sets a job, predicts with the app's engines what the picture should show,
// and checks what can be checked from the settings (read from the file's
// EXIF or typed in for film). The picture's content can't be judged by the
// app, so each exercise ends with the photographer's own look at the
// result against the prediction. The exercises are this app's own teaching.
// Words live in the i18n dictionaries under lab.ex.<id>.*.

import { hyperfocal, depthOfField } from "../physics/optics";
import { settingEv, shakeBlurMm } from "../physics/exposure";

export interface RealShot {
  fNumber?: number;
  shutterSec?: number;
  iso?: number;
  focalMm?: number;
  /** Where the lens was focused, in metres; Infinity for ∞. */
  focusM?: number;
}

export type Field = keyof RealShot;

export interface LabRule {
  /** i18n key, with `vars` filled in. */
  key: string;
  vars?: Record<string, string | number>;
  needs: Field[];
  test: (s: Required<RealShot>) => boolean;
}

export interface Prediction {
  key: string;
  vars: Record<string, string | number>;
}

export interface Exercise {
  id: string;
  level: number;
  /** The settings this exercise needs from the photographer. */
  needs: Field[];
  rules: LabRule[];
  predict: (s: Required<RealShot>) => Prediction[];
}

export const LEVELS = [1, 2, 3, 4] as const;
/** Passed exercises in a level that open the next. */
export const TO_UNLOCK = 2;

const COC = 0.03;
const eps = 1e-9;
/** The EV a setting gives, referred back to ISO 100: what the scene measured. */
const sceneEv = (s: Required<RealShot>) => settingEv(s.fNumber, s.shutterSec) - Math.log2(s.iso / 100);
const r1 = (x: number) => Math.round(x * 10) / 10;
const m = (mm: number) => (Number.isFinite(mm) ? r1(mm / 1000) : "∞");
const speed = (t: number) => (t >= 1 ? `${r1(t)} s` : `1/${Math.round(1 / t)} s`);
const focusMm = (s: Required<RealShot>) => (Number.isFinite(s.focusM) ? s.focusM * 1000 : Infinity);

const dofPrediction = (s: Required<RealShot>): Prediction => {
  const d = depthOfField(s.focalMm, s.fNumber, COC, focusMm(s));
  return Number.isFinite(d.farMm)
    ? { key: "lab.predict.dof", vars: { near: m(d.nearMm), far: m(d.farMm) } }
    : { key: "lab.predict.dofInf", vars: { near: m(d.nearMm) } };
};
const shakePrediction = (s: Required<RealShot>): Prediction => {
  const ratio = shakeBlurMm(s.shutterSec, s.focalMm) / COC;
  return { key: ratio <= 1 ? "lab.predict.steady" : ratio <= 2 ? "lab.predict.shakeRisk" : "lab.predict.shake", vars: { limit: speed(1 / s.focalMm) } };
};
const evPrediction = (s: Required<RealShot>): Prediction => ({ key: "lab.predict.ev", vars: { ev: r1(sceneEv(s)) } });

export const EXERCISES: Exercise[] = [
  // Level 1: light, without a meter.
  {
    id: "sunny16",
    level: 1,
    needs: ["fNumber", "shutterSec", "iso"],
    rules: [
      { key: "lab.rule.fBetween", vars: { lo: 11, hi: 22 }, needs: ["fNumber"], test: (s) => s.fNumber >= 11 - eps && s.fNumber <= 22 + eps },
      { key: "lab.rule.sunny16", needs: ["shutterSec", "iso", "fNumber"], test: (s) => Math.abs(sceneEv(s) - 15) <= 1 + eps },
    ],
    predict: (s) => [evPrediction(s), { key: "lab.predict.sunny16", vars: { t: speed(1 / s.iso) } }],
  },
  {
    id: "shade",
    level: 1,
    needs: ["fNumber", "shutterSec", "iso"],
    rules: [{ key: "lab.rule.evNear", vars: { ev: 12 }, needs: ["fNumber", "shutterSec", "iso"], test: (s) => Math.abs(sceneEv(s) - 12) <= 1 + eps }],
    predict: (s) => [evPrediction(s)],
  },
  {
    id: "night",
    level: 1,
    needs: ["fNumber", "shutterSec", "iso", "focalMm"],
    rules: [
      { key: "lab.rule.evRange", vars: { lo: 4, hi: 8 }, needs: ["fNumber", "shutterSec", "iso"], test: (s) => sceneEv(s) >= 4 - eps && sceneEv(s) <= 8 + eps },
      { key: "lab.rule.handheld", needs: ["shutterSec", "focalMm"], test: (s) => shakeBlurMm(s.shutterSec, s.focalMm) / COC <= 2 },
    ],
    predict: (s) => [evPrediction(s), shakePrediction(s)],
  },

  // Level 2: focus.
  {
    id: "zone",
    level: 2,
    needs: ["fNumber", "shutterSec", "focalMm", "focusM"],
    rules: [
      { key: "lab.rule.focusBetween", vars: { lo: 2.5, hi: 3.5 }, needs: ["focusM"], test: (s) => s.focusM >= 2.5 && s.focusM <= 3.5 },
      { key: "lab.rule.fAtLeast", vars: { f: 8 }, needs: ["fNumber"], test: (s) => s.fNumber >= 8 - eps },
      { key: "lab.rule.fasterThan", vars: { t: "1/250 s" }, needs: ["shutterSec"], test: (s) => s.shutterSec <= 1 / 250 + eps },
    ],
    predict: (s) => [dofPrediction(s)],
  },
  {
    id: "portrait",
    level: 2,
    needs: ["fNumber", "focalMm", "focusM"],
    rules: [
      { key: "lab.rule.fAtMost", vars: { f: 2 }, needs: ["fNumber"], test: (s) => s.fNumber <= 2 + eps },
      { key: "lab.rule.focusAtMost", vars: { d: 2 }, needs: ["focusM"], test: (s) => s.focusM <= 2 },
    ],
    predict: (s) => {
      const d = depthOfField(s.focalMm, s.fNumber, COC, focusMm(s));
      return [{ key: "lab.predict.depthCm", vars: { cm: Math.round(d.totalMm / 10) } }];
    },
  },
  {
    id: "hyperfocal",
    level: 2,
    needs: ["fNumber", "focalMm", "focusM"],
    rules: [
      { key: "lab.rule.fAtLeast", vars: { f: 8 }, needs: ["fNumber"], test: (s) => s.fNumber >= 8 - eps },
      {
        key: "lab.rule.atHyperfocal",
        needs: ["fNumber", "focalMm", "focusM"],
        test: (s) => {
          const h = hyperfocal(s.focalMm, s.fNumber, COC) / 1000;
          return Number.isFinite(s.focusM) && Math.abs(s.focusM - h) / h <= 0.25;
        },
      },
    ],
    predict: (s) => [{ key: "lab.predict.hyperfocal", vars: { h: m(hyperfocal(s.focalMm, s.fNumber, COC)), near: m(hyperfocal(s.focalMm, s.fNumber, COC) / 2) } }, dofPrediction(s)],
  },

  // Level 3: time.
  {
    id: "freeze",
    level: 3,
    needs: ["shutterSec"],
    rules: [{ key: "lab.rule.fasterThan", vars: { t: "1/500 s" }, needs: ["shutterSec"], test: (s) => s.shutterSec <= 1 / 500 + eps }],
    predict: (s) => [{ key: "lab.predict.freeze", vars: { mm: r1(s.shutterSec * 10_000) } }],
  },
  {
    id: "pan",
    level: 3,
    needs: ["shutterSec"],
    rules: [{ key: "lab.rule.shutterBetween", vars: { lo: "1/60 s", hi: "1/15 s" }, needs: ["shutterSec"], test: (s) => s.shutterSec >= 1 / 60 - eps && s.shutterSec <= 1 / 15 + eps }],
    predict: (s) => [{ key: "lab.predict.pan", vars: { cm: Math.round(s.shutterSec * 1000) } }],
  },
  {
    id: "limit",
    level: 3,
    needs: ["shutterSec", "focalMm"],
    rules: [
      {
        key: "lab.rule.slowerThanFocal",
        needs: ["shutterSec", "focalMm"],
        test: (s) => s.shutterSec >= 1 / s.focalMm - eps && s.shutterSec <= 4 / s.focalMm + eps,
      },
    ],
    predict: (s) => [shakePrediction(s)],
  },

  // Level 4: lens and light.
  {
    id: "tele",
    level: 4,
    needs: ["fNumber", "focalMm", "focusM"],
    rules: [
      { key: "lab.rule.focalAtLeast", vars: { mm: 75 }, needs: ["focalMm"], test: (s) => s.focalMm >= 75 },
      { key: "lab.rule.fAtMost", vars: { f: 2.8 }, needs: ["fNumber"], test: (s) => s.fNumber <= 2.8 + eps },
      { key: "lab.rule.focusAtMost", vars: { d: 3 }, needs: ["focusM"], test: (s) => s.focusM <= 3 },
    ],
    predict: (s) => [dofPrediction(s)],
  },
  {
    id: "wideClose",
    level: 4,
    needs: ["fNumber", "focalMm", "focusM"],
    rules: [
      { key: "lab.rule.focalAtMost", vars: { mm: 28 }, needs: ["focalMm"], test: (s) => s.focalMm <= 28 },
      { key: "lab.rule.focusAtMost", vars: { d: 1 }, needs: ["focusM"], test: (s) => s.focusM <= 1 },
      { key: "lab.rule.fAtLeast", vars: { f: 8 }, needs: ["fNumber"], test: (s) => s.fNumber >= 8 - eps },
    ],
    predict: (s) => [dofPrediction(s)],
  },
  {
    id: "available",
    level: 4,
    needs: ["fNumber", "shutterSec", "iso", "focalMm"],
    rules: [
      { key: "lab.rule.fAtMost", vars: { f: 2 }, needs: ["fNumber"], test: (s) => s.fNumber <= 2 + eps },
      { key: "lab.rule.isoAtLeast", vars: { iso: 800 }, needs: ["iso"], test: (s) => s.iso >= 800 },
      { key: "lab.rule.handheld", needs: ["shutterSec", "focalMm"], test: (s) => shakeBlurMm(s.shutterSec, s.focalMm) / COC <= 2 },
    ],
    predict: (s) => [evPrediction(s), shakePrediction(s)],
  },
];

export function exercisesIn(level: number): Exercise[] {
  return EXERCISES.filter((e) => e.level === level);
}

export type RuleResult = { rule: LabRule; pass: boolean | null };

/** Each rule's result; null where a value it needs is missing. */
export function checkRules(ex: Exercise, shot: RealShot): RuleResult[] {
  return ex.rules.map((rule) => (rule.needs.every((f) => shot[f] !== undefined) ? { rule, pass: rule.test(shot as Required<RealShot>) } : { rule, pass: null }));
}

/** The predictions, once every setting the exercise needs is there. */
export function predictionsFor(ex: Exercise, shot: RealShot): Prediction[] | null {
  if (!ex.needs.every((f) => shot[f] !== undefined)) return null;
  return ex.predict(shot as Required<RealShot>);
}

/** Levels open: the first always, then each after `TO_UNLOCK` passes in the one before. */
export function openLevels(passed: ReadonlySet<string>): number[] {
  const open = [1];
  for (const level of LEVELS.slice(1)) {
    const prev = exercisesIn(level - 1).filter((e) => passed.has(e.id)).length;
    if (prev >= TO_UNLOCK) open.push(level);
    else break;
  }
  return open;
}

/** Typed shutter speeds: "1/250", "1/250 s", "0.5", "2s", "1" → seconds. */
export function parseShutter(text: string): number | undefined {
  const s = text.trim().replace(/\s*s(ec)?$/i, "").replace(",", ".");
  const frac = s.match(/^1\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return 1 / Number(frac[1]);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

