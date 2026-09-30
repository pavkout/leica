// Roll review (#58): the keeper rate of a roll, and the patterns across every
// reviewed roll, from the photographer's own marks (a keeper, or what went
// wrong) set against the settings in the Shot log. Each pattern points to the
// Photography Lab exercise that practises it. Pure logic.

import type { FrameIssue, LogEntry } from "../state/shotLog";

export interface RollStats {
  frames: number;
  reviewed: number;
  picks: number;
  issues: Record<FrameIssue, number>;
}

const reviewed = (e: LogEntry) => e.pick === true || e.issue !== undefined || e.pick === false;

export function rollStats(entries: LogEntry[]): RollStats {
  const issues: Record<FrameIssue, number> = { focus: 0, blur: 0, under: 0, over: 0 };
  for (const e of entries) if (e.issue) issues[e.issue]++;
  return { frames: entries.length, reviewed: entries.filter(reviewed).length, picks: entries.filter((e) => e.pick).length, issues };
}

export interface Pattern {
  /** i18n key describing the group, e.g. "rr.g.slow". */
  group: string;
  issue: FrameIssue;
  count: number;
  of: number;
  /** A Photography Lab exercise id. */
  lab: string;
}

type Group = { key: string; test: (e: LogEntry) => boolean; issues: Partial<Record<FrameIssue, string>> };

/** The groups worth checking, and the exercise for each problem in them. */
const GROUPS: Group[] = [
  { key: "rr.g.slow", test: (e) => e.shutterSec >= 1 / 30 - 1e-9, issues: { blur: "limit", under: "night" } },
  { key: "rr.g.wide", test: (e) => e.fNumber <= 2 + 1e-9, issues: { focus: "portrait", over: "sunny16" } },
  { key: "rr.g.close", test: (e) => e.focusMm !== undefined && Number.isFinite(e.focusMm) && e.focusMm <= 2000, issues: { focus: "portrait" } },
  { key: "rr.g.fast", test: (e) => e.shutterSec <= 1 / 250 + 1e-9, issues: { under: "shade" } },
  { key: "rr.g.all", test: () => true, issues: { focus: "zone", blur: "limit", under: "shade", over: "sunny16" } },
];

/** A pattern is worth mentioning from 4 reviewed frames and when at least 30% of them share the problem. */
export function patterns(entries: LogEntry[], { minFrames = 4, minShare = 0.3 } = {}): Pattern[] {
  const done = entries.filter(reviewed);
  const out: Pattern[] = [];
  for (const g of GROUPS) {
    const inGroup = done.filter(g.test);
    if (inGroup.length < minFrames) continue;
    for (const [issue, lab] of Object.entries(g.issues) as [FrameIssue, string][]) {
      const count = inGroup.filter((e) => e.issue === issue).length;
      if (count / inGroup.length >= minShare && count >= 2) out.push({ group: g.key, issue, count, of: inGroup.length, lab });
    }
  }
  // The overall line only when no narrower group already explains the problem.
  const narrow = new Set(out.filter((p) => p.group !== "rr.g.all").map((p) => p.issue));
  return out.filter((p) => p.group !== "rr.g.all" || !narrow.has(p.issue)).sort((a, b) => b.count / b.of - a.count / a.of);
}
