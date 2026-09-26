import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMED_HEIGHT_M, FRAMINGS, requiredDistanceMm, scaledSubjectHeightM } from "./portrait";

const FULL_FRAME_HEIGHT_MM = 24; // 36×24mm

describe("requiredDistanceMm", () => {
  it("matches the well-known rule of thumb: ~3.6 m for a full-body portrait on a 50mm full-frame lens", () => {
    const mm = requiredDistanceMm(50, FULL_FRAME_HEIGHT_MM, DEFAULT_ASSUMED_HEIGHT_M);
    expect(mm / 1000).toBeCloseTo(3.59, 1);
  });

  it("requires a closer distance for a tighter framing (smaller subject height) at the same focal length", () => {
    const head = requiredDistanceMm(50, FULL_FRAME_HEIGHT_MM, 0.24);
    const fullBody = requiredDistanceMm(50, FULL_FRAME_HEIGHT_MM, 1.7);
    expect(head).toBeLessThan(fullBody);
  });

  it("requires a farther distance for a longer focal length at the same framing", () => {
    const wide = requiredDistanceMm(35, FULL_FRAME_HEIGHT_MM, 1.7);
    const tele = requiredDistanceMm(90, FULL_FRAME_HEIGHT_MM, 1.7);
    expect(tele).toBeGreaterThan(wide);
  });

  it("scales required distance proportionally with a taller subject", () => {
    const shorter = requiredDistanceMm(50, FULL_FRAME_HEIGHT_MM, 1.2);
    const taller = requiredDistanceMm(50, FULL_FRAME_HEIGHT_MM, 1.8);
    expect(taller).toBeGreaterThan(shorter);
  });
});

describe("scaledSubjectHeightM", () => {
  it("is unchanged at the default assumed height", () => {
    for (const framing of FRAMINGS) {
      expect(scaledSubjectHeightM(framing, DEFAULT_ASSUMED_HEIGHT_M)).toBeCloseTo(framing.subjectHeightM, 9);
    }
  });

  it("scales proportionally for a shorter assumed height", () => {
    const framing = FRAMINGS.find((f) => f.id === "full-body")!;
    expect(scaledSubjectHeightM(framing, 1.2)).toBeCloseTo(1.2, 9);
  });

  it("preserves the relative ordering of framings regardless of assumed height", () => {
    for (const assumedHeightM of [1.1, 1.7, 2.0]) {
      const heights = FRAMINGS.map((f) => scaledSubjectHeightM(f, assumedHeightM));
      for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
  });
});

describe("FRAMINGS", () => {
  it("is ordered from tightest to widest framing", () => {
    for (let i = 1; i < FRAMINGS.length; i++) {
      expect(FRAMINGS[i].subjectHeightM).toBeGreaterThan(FRAMINGS[i - 1].subjectHeightM);
    }
  });

  it("'full body' matches the default assumed height exactly", () => {
    expect(FRAMINGS.find((f) => f.id === "full-body")!.subjectHeightM).toBe(DEFAULT_ASSUMED_HEIGHT_M);
  });
});
