import { describe, expect, it } from "vitest";
import { findLens } from "../data/gear";
import { apertureRadius, apertureShape, irisOutline, kernelSamples, stopsDown } from "./aperture";

const nocti = findLens("m-50-0.95");

describe("apertureShape", () => {
  it("is round and most vignetted wide open", () => {
    const s = apertureShape(nocti, 0.95);
    expect(s.roundness).toBe(1);
    expect(s.blades).toBe(11);
    expect(s.catEye).toBeGreaterThan(0.5);
  });

  it("turns polygonal and loses the cat's eye when stopped down", () => {
    const s = apertureShape(nocti, 5.6);
    expect(stopsDown(nocti, 5.6)).toBeGreaterThan(5);
    expect(s.roundness).toBe(0.35);
    expect(s.catEye).toBe(0);
  });

  it("falls back to a generic iris when blades aren't published", () => {
    expect(apertureShape(findLens("m-35-2"), 2).blades).toBe(9);
  });
});

describe("apertureRadius", () => {
  it("is 1 everywhere for a round opening", () => {
    for (const t of [0, 0.3, 1, 2.5]) {
      expect(apertureRadius(t, { blades: 6, roundness: 1, rotation: 0 })).toBeCloseTo(1, 12);
    }
  });

  it("touches the circle at corners and dips at edge midpoints for a polygon", () => {
    const hex = { blades: 6, roundness: 0, rotation: 0 };
    expect(apertureRadius(0, hex)).toBeCloseTo(1, 9); // corner
    expect(apertureRadius(Math.PI / 6, hex)).toBeCloseTo(Math.cos(Math.PI / 6), 9); // edge midpoint
  });
});

describe("irisOutline", () => {
  it("closes the loop: first and last point coincide", () => {
    const points = irisOutline({ blades: 8, roundness: 0.6, rotation: 0.3 });
    const [x0, y0] = points[0];
    const [xN, yN] = points[points.length - 1];
    expect(xN).toBeCloseTo(x0, 9);
    expect(yN).toBeCloseTo(y0, 9);
  });

  it("traces a perfect circle at roundness 1, regardless of blade count", () => {
    const points = irisOutline({ blades: 5, roundness: 1, rotation: 0 });
    for (const [x, y] of points) expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
  });

  it("every point matches apertureRadius at its own angle (same edge function as the blur kernel)", () => {
    const shape = { blades: 6, roundness: 0.4, rotation: 0.2 };
    const samples = 24;
    for (const [i, [x, y]] of irisOutline(shape, samples).entries()) {
      const theta = (i / samples) * Math.PI * 2;
      expect(Math.hypot(x, y)).toBeCloseTo(apertureRadius(theta, shape), 9);
    }
  });

  it("is deterministic: the same shape always produces the same geometry", () => {
    const shape = { blades: 9, roundness: 0.5, rotation: 1.2 };
    expect(irisOutline(shape)).toEqual(irisOutline(shape));
  });

  it("respects a custom sample count", () => {
    expect(irisOutline({ blades: 6, roundness: 1, rotation: 0 }, 12)).toHaveLength(13);
  });
});

describe("kernelSamples", () => {
  it("keeps every sample inside the opening", () => {
    const shape = { blades: 7, roundness: 0.4, rotation: 0.2, catEye: 0 };
    for (const [x, y] of kernelSamples(64, shape)) {
      const r = Math.hypot(x, y);
      expect(r).toBeLessThanOrEqual(apertureRadius(Math.atan2(y, x), shape) + 1e-9);
    }
  });
});
