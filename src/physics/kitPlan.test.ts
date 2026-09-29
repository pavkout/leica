import { describe, expect, it } from "vitest";
import { findBody, lensesForBody, type Lens } from "../data/gear";
import { TRIPS, analyseKit, recommendPair } from "./kitPlan";

const m6 = findBody("m6");
const all = lensesForBody(m6);
const byFocal = (f: number) => all.find((l) => l.focalMm === f)!;
const trip = (id: string) => TRIPS.find((t) => t.id === id)!;

describe("kit planner", () => {
  it("finds gaps, overlaps and missing frame lines", () => {
    const kit: Lens[] = [byFocal(21), byFocal(35), all.filter((l) => l.focalMm === 35)[1] ?? byFocal(35), byFocal(90)];
    const r = analyseKit(m6, kit, trip("city"));
    // 35 → 90 is a 2.6× jump; 21 → 35 (1.7×) is a normal step.
    expect(r.gaps).toEqual([[35, 90]]);
    expect(r.overlaps.length).toBe(1);
    // The M6 has no 21 mm frame lines.
    expect(r.noFrameline.map((l) => l.focalMm)).toContain(21);
  });

  it("reports which of the trip's two jobs the kit covers", () => {
    expect(analyseKit(m6, [byFocal(35)], trip("city")).covers).toEqual([true, false]);
    expect(analyseKit(m6, [byFocal(35), byFocal(50)], trip("city")).covers).toEqual([true, true]);
  });

  it("recommends one lens per band, fast ones for night", () => {
    const [a, b] = recommendPair(m6, all, trip("night"));
    expect(a && a.focalMm >= 28 && a.focalMm <= 35).toBe(true);
    expect(b?.focalMm).toBe(50);
    expect(a!.maxAperture).toBeLessThanOrEqual(1.4);
    expect(b!.maxAperture).toBeLessThanOrEqual(1.4);
  });

  it("recommends from what's offered, and says nothing when a band can't be filled", () => {
    const [a, b] = recommendPair(m6, [byFocal(35)], trip("portrait"));
    expect(a?.focalMm).toBe(35);
    expect(b).toBeNull();
  });
});
