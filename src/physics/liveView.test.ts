import { describe, expect, it } from "vitest";
import { frameCropRatio } from "./liveView";

describe("frameCropRatio", () => {
  it("is 1 when the lens matches the reference field of view", () => {
    expect(frameCropRatio(69, 69)).toBeCloseTo(1, 6);
  });

  it("is less than 1 for a narrower (more telephoto) lens", () => {
    expect(frameCropRatio(30, 69)).toBeLessThan(1);
  });

  it("is greater than 1 for a lens wider than the reference camera can see", () => {
    expect(frameCropRatio(100, 69)).toBeGreaterThan(1);
  });

  it("increases monotonically with the lens field of view", () => {
    const ratios = [10, 30, 50, 69, 90].map((fov) => frameCropRatio(fov, 69));
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]).toBeGreaterThan(ratios[i - 1]);
  });
});
