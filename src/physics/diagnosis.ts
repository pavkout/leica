// "Why does this frame look like this?" For a frame on the roll, each way a
// photo goes soft or wrongly exposed is checked on its own, from the settings
// recorded with the frame: focus, camera shake, subject movement, depth of
// field, diffraction and exposure. Every finding says how far off it was, as
// a multiple of the circle of confusion (blur) or in stops (exposure).
//
// Pure: no DOM, testable. Subject movement can't be known from settings
// alone, so it's reported as a risk for a walking person at the subject's
// distance, never as a fact.

import { depthOfField, diffractionLimitedFNumber } from "./optics";
import { shakeBlurMm } from "./exposure";
import { MOTION_ARCHETYPES, subjectBlurMm } from "./motion";
import type { OutcomeTag } from "../state/rollExport";

export interface DiagnosisInput {
  focalMm: number;
  fNumber: number;
  shutterSec: number;
  /** `Infinity` for focused at infinity. */
  focusMm: number;
  /** Where the subject stood, when the app knew it (the Studio's scene); unknown for live frames. */
  subjectMm?: number;
  /** The sharpness standard the frame was judged by. */
  cocMm?: number;
  tripod?: boolean;
  /** Stops over (+) or under (−) a metered exposure. */
  evOffset: number;
}

export type FindingKind = "focus" | "shake" | "motion" | "diffraction" | "exposure";

export interface Finding {
  kind: FindingKind;
  /** "problem": this visibly spoils the frame. "risk": it would, for a moving subject. "fine": checked and clear. */
  level: "problem" | "risk" | "fine";
  title: string;
  detail: string;
  /** How big the effect is: blur in circles of confusion, or exposure in stops. */
  amount: number;
}

export interface Diagnosis {
  findings: Finding[];
  /** The outcome tag the physics points to, if one clearly does. */
  suggestedTag?: OutcomeTag;
  /** Older frames were saved before the app recorded enough to judge focus. */
  partial: boolean;
}

const DEFAULT_COC_MM = 0.03;
/** Blur below one circle of confusion reads as sharp; a few is visibly soft. */
const VISIBLE = 1.5;
const WALK = MOTION_ARCHETYPES.find((m) => m.id === "walk")!;

const fmt = (x: number) => (x < 10 ? x.toFixed(1) : Math.round(x).toString());

export function diagnoseFrame(input: DiagnosisInput): Diagnosis {
  const coc = input.cocMm ?? DEFAULT_COC_MM;
  const findings: Finding[] = [];
  const partial = input.subjectMm === undefined || input.cocMm === undefined;

  // Focus: was the subject inside the depth of field?
  if (input.subjectMm !== undefined) {
    const dof = depthOfField(input.focalMm, input.fNumber, coc, input.focusMm);
    const inside = input.subjectMm >= dof.nearMm - 1 && input.subjectMm <= dof.farMm + 1;
    const missM = Math.abs((Number.isFinite(input.focusMm) ? input.focusMm : 1e9) - input.subjectMm) / 1000;
    findings.push(
      inside
        ? { kind: "focus", level: "fine", title: "Focus landed", detail: "The subject was inside the depth of field.", amount: 0 }
        : {
            kind: "focus",
            level: "problem",
            title: "Missed focus",
            detail: `The subject stood ${Number.isFinite(input.focusMm) ? `${fmt(missM)} m ${input.focusMm > input.subjectMm ? "in front of" : "behind"} where you focused` : "much closer than infinity, where you focused"}, outside the depth of field.`,
            amount: missM,
          },
    );
  }

  // Camera shake: hand-held blur from the shutter speed and focal length.
  if (!input.tripod) {
    const ratio = shakeBlurMm(input.shutterSec, input.focalMm) / coc;
    findings.push(
      ratio > VISIBLE
        ? {
            kind: "shake",
            level: "problem",
            title: "Camera shake",
            detail: `Hand-held at this speed, your hands smear the picture about ${fmt(ratio)}× more than reads as sharp. Try 1/${Math.ceil(input.focalMm)} or faster, or a tripod.`,
            amount: ratio,
          }
        : { kind: "shake", level: "fine", title: "Steady enough", detail: "The shutter was fast enough to hold by hand.", amount: ratio },
    );
  }

  // Subject movement: only a risk, for someone walking across the frame at the subject's distance.
  const distance = input.subjectMm ?? (Number.isFinite(input.focusMm) ? input.focusMm : undefined);
  if (distance !== undefined) {
    const ratio = subjectBlurMm(WALK.speedMps, input.shutterSec, input.focalMm, distance) / coc;
    findings.push(
      ratio > VISIBLE
        ? {
            kind: "motion",
            level: "risk",
            title: "Moving subjects would blur",
            detail: `Someone walking across the frame at ${fmt(distance / 1000)} m would smear about ${fmt(ratio)}× past sharp at this speed.`,
            amount: ratio,
          }
        : { kind: "motion", level: "fine", title: "Fast enough for movement", detail: "A walking person at this distance would be frozen.", amount: ratio },
    );
  }

  // Diffraction: stopped down so far the lens itself softens everything.
  const limit = diffractionLimitedFNumber(coc);
  if (input.fNumber > limit * 1.4) {
    findings.push({
      kind: "diffraction",
      level: "problem",
      title: "Softened by diffraction",
      detail: `At f/${input.fNumber} the light spreads more than reads as sharp (from about f/${Math.round(limit)}). Open up a stop or two.`,
      amount: input.fNumber / limit,
    });
  }

  // Exposure.
  const ev = input.evOffset;
  if (Math.abs(ev) >= 1) {
    findings.push({
      kind: "exposure",
      level: "problem",
      title: ev > 0 ? "Overexposed" : "Underexposed",
      detail: `${fmt(Math.abs(ev))} stops ${ev > 0 ? "more" : "less"} light than the meter would give.`,
      amount: ev,
    });
  } else {
    findings.push({ kind: "exposure", level: "fine", title: "Exposure right", detail: "Within a stop of the meter.", amount: ev });
  }

  return { findings, suggestedTag: suggest(findings), partial };
}

/** The tag for the biggest problem, or "good" when nothing is wrong. Risks don't count. */
function suggest(findings: Finding[]): OutcomeTag | undefined {
  const problems = findings.filter((f) => f.level === "problem");
  if (!problems.length) return "good";
  if (problems.some((f) => f.kind === "focus")) return "missed-focus";
  if (problems.some((f) => f.kind === "shake")) return "motion-blur";
  const exp = problems.find((f) => f.kind === "exposure");
  if (exp) return exp.amount > 0 ? "overexposed" : "underexposed";
  return undefined;
}
