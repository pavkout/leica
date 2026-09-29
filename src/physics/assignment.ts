// Today's assignment, grading and the streak. Pure: dates come in as
// "YYYY-MM-DD" strings in the viewer's own time zone.

import { ASSIGNMENTS, type Assignment } from "../data/assignments";
import type { FrameMeta } from "../state/rollExport";

/** "YYYY-MM-DD" for a date in local time. */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days since 1970-01-01 for a "YYYY-MM-DD" day (calendar days, time zone free). */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The same brief for everyone on a given day, cycling through the list. */
export function assignmentFor(day: string, list: Assignment[] = ASSIGNMENTS): Assignment {
  const n = dayNumber(day);
  return list[((n % list.length) + list.length) % list.length];
}

export interface Grade {
  checks: { label: string; pass: boolean }[];
  passed: number;
  complete: boolean;
}

export function gradeFrame(a: Assignment, meta: FrameMeta): Grade {
  const checks = a.rules.map((r) => ({ label: r.label, pass: r.test(meta) }));
  const passed = checks.filter((c) => c.pass).length;
  return { checks, passed, complete: passed === checks.length };
}

/**
 * Days in a row with a completed assignment, counting back from today. A
 * streak survives until the end of today: yesterday's streak still counts
 * while today's brief is open.
 */
export function streak(completedDays: string[], today: string): number {
  const done = new Set(completedDays.map(dayNumber));
  let n = dayNumber(today);
  if (!done.has(n)) n -= 1;
  let count = 0;
  while (done.has(n)) {
    count++;
    n--;
  }
  return count;
}
