// A line per Claude run, kept on this device: what it was, which model, and
// what it cost. Gives the month's total and enforces the optional limit.

import { getString, setString } from "../persistence";
import type { AiAction, ModelId } from "./pricing";

export interface SpendRow {
  /** ISO timestamp. */
  at: string;
  action: AiAction | "test";
  model: ModelId;
  input: number;
  output: number;
  searches: number;
  usd: number;
}

const KEY = "rangefinder-ai-spend";
const KEEP = 500;

export function loadSpend(): SpendRow[] {
  try {
    const rows = JSON.parse(getString(KEY) ?? "[]");
    return Array.isArray(rows) ? rows.filter((r) => r && typeof r.usd === "number" && typeof r.at === "string") : [];
  } catch {
    return [];
  }
}

export function recordSpend(row: SpendRow): void {
  setString(KEY, JSON.stringify([...loadSpend(), row].slice(-KEEP)));
}

export function monthTotal(rows: SpendRow[], now: Date): number {
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return rows.filter((r) => r.at.slice(0, 7) === ym).reduce((a, r) => a + r.usd, 0);
}

/** True when running something that may cost up to `estimateHigh` would pass the month's limit. */
export function wouldExceed(rows: SpendRow[], limit: number | null, estimateHigh: number, now: Date): boolean {
  if (limit === null) return false;
  return monthTotal(rows, now) + estimateHigh > limit;
}
