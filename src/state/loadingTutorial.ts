// Film loading trainer engine (RANGEFINDER_MASTER_PLAN.md, feature #22): a
// finite-state tutorial. Everything body-specific — actions, steps, the
// mechanical state they produce, and the manual they're sourced from — is
// data (data/filmLoading.ts), so adding a body never touches this file.
//
// The only way forward is the expected action, so the user can't reach a
// mechanical state the camera can't be in. The mechanical state is never
// stored: it's derived by folding step patches up to the current index,
// which makes back-step and restart trivially correct.

import type { Provenance } from "../data/provenance";

export type MechValue = string | boolean;
export type MechState = Record<string, MechValue>;

export interface Requirement {
  key: string;
  oneOf: MechValue[];
  /** Why the action is physically impossible when this isn't met — shown as gentle feedback. */
  reason: string;
}

export interface TutorialAction {
  id: string;
  label: string;
  requires?: Requirement[];
}

export interface TutorialStep {
  action: string;
  /** The instruction for this step, following the cited manual. */
  text: string;
  note?: string;
  /** Mechanical state after the step. */
  set: MechState;
}

export type TutorialMode = "load" | "unload";

export interface Tutorial {
  bodyIds: string[];
  mode: TutorialMode;
  initial: MechState;
  steps: TutorialStep[];
  source: Provenance & { sourceName: string; pages: string };
}

export type AttemptOutcome =
  | { kind: "advanced" }
  | { kind: "complete" }
  | { kind: "blocked"; reason: string; expected: TutorialStep }
  | { kind: "out-of-order"; expected: TutorialStep };

/** Mechanical state after the first `stepIndex` steps. */
export function stateAt(tutorial: Tutorial, stepIndex: number): MechState {
  const state = { ...tutorial.initial };
  for (const step of tutorial.steps.slice(0, Math.max(0, stepIndex))) Object.assign(state, step.set);
  return state;
}

/** The first unmet requirement of `action` in `state`, or null if the action is physically possible. */
export function blockingReason(action: TutorialAction, state: MechState): string | null {
  for (const r of action.requires ?? []) {
    if (!r.oneOf.includes(state[r.key])) return r.reason;
  }
  return null;
}

/**
 * Tries `actionId` at `stepIndex`. Only the expected action advances;
 * anything else leaves the index unchanged and says why.
 */
export function attempt(
  tutorial: Tutorial,
  actions: Record<string, TutorialAction>,
  stepIndex: number,
  actionId: string,
): { outcome: AttemptOutcome; stepIndex: number } {
  const expected = tutorial.steps[stepIndex];
  if (!expected) return { outcome: { kind: "complete" }, stepIndex };
  if (actionId === expected.action) {
    const next = stepIndex + 1;
    return { outcome: next >= tutorial.steps.length ? { kind: "complete" } : { kind: "advanced" }, stepIndex: next };
  }
  const action = actions[actionId];
  const reason = action ? blockingReason(action, stateAt(tutorial, stepIndex)) : null;
  return {
    outcome: reason ? { kind: "blocked", reason, expected } : { kind: "out-of-order", expected },
    stepIndex,
  };
}

/** The distinct actions a tutorial uses, in catalog order (not step order, so the palette doesn't give the sequence away). */
export function paletteFor(tutorial: Tutorial, actions: Record<string, TutorialAction>): TutorialAction[] {
  const used = new Set(tutorial.steps.map((s) => s.action));
  return Object.values(actions).filter((a) => used.has(a.id));
}
