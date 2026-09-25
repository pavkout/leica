import { describe, expect, it } from "vitest";
import { findBody, findLens } from "../data/gear";
import { computeShot } from "./model";

const base = {
  body: findBody("m11"),
  lens: findLens("m-50-1.4"),
  fNumber: 1.4,
  focusMm: 2000,
  backgroundOffsetMm: Infinity,
  megapixels: 60,
  cropFocalMm: null,
  standard: "engraved" as const,
};

describe("computeShot subject", () => {
  it("defaults the subject to the focus distance, which is sharp", () => {
    const shot = computeShot(base);
    expect(shot.subjectMm).toBe(2000);
    expect(shot.subjectSharp).toBe(true);
  });

  it("scores a subject inside the depth of field as sharp", () => {
    const shot = computeShot({ ...base, subjectMm: 2040 }); // DoF is 1.94–2.07 m
    expect(shot.subjectSharp).toBe(true);
  });

  it("scores a missed focus", () => {
    expect(computeShot({ ...base, subjectMm: 2300 }).subjectSharp).toBe(false);
    expect(computeShot({ ...base, focusMm: Infinity, subjectMm: 1070 }).subjectSharp).toBe(false);
  });

  it("places the background behind the subject, not the focus", () => {
    const shot = computeShot({ ...base, subjectMm: 3000, backgroundOffsetMm: 2000 });
    expect(shot.backgroundMm).toBe(5000);
  });
});
