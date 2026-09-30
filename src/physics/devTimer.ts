// Development timer (#46): the steps of developing a film or a print, laid
// out on a clock, with the agitation and "start pouring" cues. Pure logic:
// the page runs it from wall-clock time, so a phone that sleeps or a tab in
// the background still shows the right moment when it comes back.
//
// Agitation presets follow the two film makers' own small-tank instructions
// in the app's datasheets (Kodak: every 30 seconds; Ilford: four inversions
// each minute). Stop, fix and wash times are starting points the owner
// should check against their chemistry's instructions; the page says so.

export type StepKind = "presoak" | "develop" | "stop" | "fix" | "wash" | "wetting" | "blix" | "stabilise" | "expose";

export interface Agitation {
  /** Continuous agitation at the start, seconds. */
  first: number;
  /** Then agitate for `for` seconds at the start of every `every` seconds. 0 = no more agitation (stand). */
  every: number;
  for: number;
}

export interface Step {
  id: string;
  kind: StepKind;
  seconds: number;
  agitation?: Agitation;
}

export const AGITATION_PRESETS: { id: "kodak" | "ilford" | "stand" | "continuous"; agitation: Agitation }[] = [
  { id: "kodak", agitation: { first: 30, every: 30, for: 5 } },
  { id: "ilford", agitation: { first: 10, every: 60, for: 10 } },
  { id: "stand", agitation: { first: 30, every: 0, for: 0 } },
  { id: "continuous", agitation: { first: Infinity, every: 0, for: 0 } },
];

/** Seconds before a step ends when the tank should start being emptied. */
export const DRAIN_SEC = 10;

export function filmSteps(developSeconds: number, agitation: Agitation, opts: { presoak?: boolean; stop?: number; fix?: number; wash?: number; wetting?: number } = {}): Step[] {
  const steps: Step[] = [];
  if (opts.presoak) steps.push({ id: "presoak", kind: "presoak", seconds: 60 });
  steps.push({ id: "develop", kind: "develop", seconds: Math.round(developSeconds), agitation });
  steps.push({ id: "stop", kind: "stop", seconds: opts.stop ?? 60, agitation: { first: Infinity, every: 0, for: 0 } });
  steps.push({ id: "fix", kind: "fix", seconds: opts.fix ?? 300, agitation });
  steps.push({ id: "wash", kind: "wash", seconds: opts.wash ?? 600 });
  if (opts.wetting !== 0) steps.push({ id: "wetting", kind: "wetting", seconds: opts.wetting ?? 30 });
  return steps;
}

/**
 * C-41 colour: the developer's 3:15 at 37.8 °C is the process standard; the
 * bleach-fix, wash and stabiliser times depend on the kit, so they start as
 * editable placeholders the page asks the owner to check.
 */
export function c41Steps(agitation: Agitation, opts: { blix?: number; wash?: number; stabilise?: number } = {}): Step[] {
  return [
    { id: "develop", kind: "develop", seconds: 195, agitation },
    { id: "blix", kind: "blix", seconds: opts.blix ?? 390, agitation },
    { id: "wash", kind: "wash", seconds: opts.wash ?? 180 },
    { id: "stabilise", kind: "stabilise", seconds: opts.stabilise ?? 60 },
  ];
}

export function totalSeconds(steps: Step[]): number {
  return steps.reduce((s, x) => s + x.seconds, 0);
}

/** Whether the tank should be agitated `t` seconds into a step. */
export function agitatingAt(a: Agitation | undefined, t: number): boolean {
  if (!a) return false;
  if (t < a.first) return true;
  if (a.every <= 0) return false;
  // The intervals count from the end of the opening agitation: the first comes one interval after it.
  const since = t - a.first;
  return since >= a.every && since % a.every < a.for;
}

export type Cue = { at: number; kind: "agitate" | "rest" | "drain" | "next" | "done"; step: number };

/** Every moment the page should say something, in order, from the start of the run. */
export function cues(steps: Step[]): Cue[] {
  const out: Cue[] = [];
  let start = 0;
  steps.forEach((s, i) => {
    const a = s.agitation;
    if (a) {
      const firstEnd = Math.min(a.first, s.seconds);
      if (Number.isFinite(firstEnd) && firstEnd < s.seconds) out.push({ at: start + firstEnd, kind: "rest", step: i });
      if (a.every > 0 && Number.isFinite(a.first)) {
        for (let t = a.first + a.every; t < s.seconds - DRAIN_SEC; t += a.every) {
          out.push({ at: start + t, kind: "agitate", step: i });
          if (t + a.for < s.seconds) out.push({ at: start + t + a.for, kind: "rest", step: i });
        }
      }
    }
    if (s.seconds > DRAIN_SEC * 2 && s.kind !== "wash" && s.kind !== "expose") out.push({ at: start + s.seconds - DRAIN_SEC, kind: "drain", step: i });
    start += s.seconds;
    out.push({ at: start, kind: i === steps.length - 1 ? "done" : "next", step: i });
  });
  return out.sort((x, y) => x.at - y.at);
}

export interface RunState {
  step: number;
  /** Seconds into the current step. */
  inStep: number;
  /** Seconds left in the current step. */
  left: number;
  agitating: boolean;
  draining: boolean;
  done: boolean;
}

export function stateAt(steps: Step[], elapsed: number): RunState {
  let start = 0;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (elapsed < start + s.seconds) {
      const inStep = Math.max(0, elapsed - start);
      const left = s.seconds - inStep;
      return { step: i, inStep, left, agitating: agitatingAt(s.agitation, inStep), draining: s.kind !== "wash" && s.kind !== "expose" && s.seconds > DRAIN_SEC * 2 && left <= DRAIN_SEC, done: false };
    }
    start += s.seconds;
  }
  return { step: steps.length - 1, inStep: steps[steps.length - 1]?.seconds ?? 0, left: 0, agitating: false, draining: false, done: true };
}

/** "8:30", "1:05:00". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** A run timed by the wall clock, so sleeping or backgrounding doesn't lose time. */
export interface Run {
  startedAt: number;
  /** Total milliseconds spent paused. */
  pausedMs: number;
  pausedAt: number | null;
}

export function elapsedSec(run: Run, now: number): number {
  const end = run.pausedAt ?? now;
  return Math.max(0, (end - run.startedAt - run.pausedMs) / 1000);
}

export function pause(run: Run, now: number): Run {
  return run.pausedAt ? run : { ...run, pausedAt: now };
}

export function resume(run: Run, now: number): Run {
  return run.pausedAt ? { ...run, pausedMs: run.pausedMs + (now - run.pausedAt), pausedAt: null } : run;
}

/** Skips to the start of the next step. */
export function skip(run: Run, steps: Step[], now: number): Run {
  const s = stateAt(steps, elapsedSec(run, now));
  if (s.done) return run;
  return { ...run, startedAt: run.startedAt - s.left * 1000 };
}

/** "8:30", "8.5", "510s" → seconds. */
export function parseMinSec(text: string): number | null {
  const s = text.trim().replace(",", ".");
  const ms = s.match(/^(\d+):([0-5]?\d)$/);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
  const sec = s.match(/^(\d+(?:\.\d+)?)\s*s$/i);
  if (sec) return Math.round(Number(sec[1]));
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && s !== "" ? Math.round(n * 60) : null;
}

