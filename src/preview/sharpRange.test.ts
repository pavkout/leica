import { describe, expect, it } from "vitest";
import { findBody, findLens } from "../data/gear";
import { computeShot } from "../physics/model";
import { sharpRangeM } from "./renderer";

describe("sharp-zone mask range", () => {
  it("matches the depth of field the readouts show", () => {
    for (const [n, focus] of [[1.4, 2000], [4, 3000], [8, 1500]] as const) {
      const s = computeShot({ body: findBody("m11"), lens: findLens("m-50-1.4"), fNumber: n, focusMm: focus, subjectMm: focus, backgroundOffsetMm: 8000, megapixels: null, cropFocalMm: null, standard: "engraved" });
      const [near, far] = sharpRangeM(s.focalMm, n, focus, s.cocMm);
      expect(near * 1000).toBeCloseTo(s.dof.nearMm, -1);
      expect(Math.abs(far * 1000 - s.dof.farMm) / s.dof.farMm).toBeLessThan(0.03);
    }
  });

  it("reaches infinity past the hyperfocal distance", () => {
    expect(sharpRangeM(50, 16, 6000, 0.03)[1]).toBe(Infinity);
  });
});
