import { describe, expect, it } from "vitest";
import { doubleImageOffset, finderFieldDeg, framelineParallax, framelinePair } from "./rangefinder";

describe("framelinePair", () => {
  it("brings up the pair containing the lens", () => {
    expect(framelinePair(28)).toEqual([28, 90]);
    expect(framelinePair(90)).toEqual([28, 90]);
    expect(framelinePair(35)).toEqual([35, 135]);
    expect(framelinePair(75)).toEqual([50, 75]);
  });

  it("has no frame for lenses wider than the finder", () => {
    expect(framelinePair(21)).toBeNull();
  });
});

describe("doubleImageOffset", () => {
  it("vanishes when the object is at the focus distance", () => {
    expect(doubleImageOffset(2, 2)).toBe(0);
    expect(doubleImageOffset(Infinity, Infinity)).toBe(0);
  });

  it("has opposite signs in front of and behind the focus", () => {
    expect(doubleImageOffset(1.5, 2)).toBeGreaterThan(0);
    expect(doubleImageOffset(3, 2)).toBeLessThan(0);
  });

  it("matches the base divided by distance for focus at infinity", () => {
    expect(doubleImageOffset(2, Infinity)).toBeCloseTo(0.06925 / 2, 12);
  });
});

describe("finder field", () => {
  it("is just wider than a 28mm frame and narrows with the magnifier", () => {
    const frame28 = (2 * Math.atan(18 / 28) * 180) / Math.PI;
    expect(finderFieldDeg()).toBeGreaterThan(frame28);
    expect(finderFieldDeg(1.4)).toBeLessThan(finderFieldDeg());
  });
});

describe("framelineParallax", () => {
  it("shrinks with distance and is zero at infinity", () => {
    expect(framelineParallax(0.7).x).toBeGreaterThan(framelineParallax(2).x);
    expect(framelineParallax(Infinity)).toEqual({ x: 0, y: 0 });
  });
});
