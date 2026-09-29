import { describe, expect, it } from "vitest";
import { monthTotal, wouldExceed, type SpendRow } from "./spendLog";

const row = (at: string, usd: number): SpendRow => ({ at, action: "photo", model: "claude-sonnet-5", input: 0, output: 0, searches: 0, usd });

describe("spend log", () => {
  const rows = [row("2026-08-30T10:00:00Z", 5), row("2026-09-02T10:00:00Z", 1.5), row("2026-09-20T10:00:00Z", 2)];
  const now = new Date(2026, 8, 29);

  it("totals the current month only", () => {
    expect(monthTotal(rows, now)).toBeCloseTo(3.5);
  });

  it("refuses a run that would pass the limit, before it runs", () => {
    expect(wouldExceed(rows, 3.6, 0.2, now)).toBe(true);
    expect(wouldExceed(rows, 10, 0.2, now)).toBe(false);
    expect(wouldExceed(rows, null, 100, now)).toBe(false);
  });
});
