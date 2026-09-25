import { describe, expect, it } from "vitest";
import { findBody, framelinesFor } from "../data/gear";
import { doubleImageOffset, finderFieldDeg, framelineParallax } from "./rangefinder";

describe("framelinesFor", () => {
  const m6 = findBody("m6");
  it("brings up the set containing the lens", () => {
    expect(framelinesFor(m6, 28)).toEqual([28, 90]);
    expect(framelinesFor(m6, 90)).toEqual([28, 90]);
    expect(framelinesFor(m6, 35)).toEqual([35, 135]);
    expect(framelinesFor(m6, 75)).toEqual([50, 75]);
  });

  it("has no frame for lenses wider than the finder", () => {
    expect(framelinesFor(m6, 21)).toBeNull();
  });

  it("uses the M3's own frames, which have no 35", () => {
    const m3 = findBody("m3");
    expect(framelinesFor(m3, 50)).toEqual([50]);
    expect(framelinesFor(m3, 90)).toEqual([50, 90]);
    expect(framelinesFor(m3, 35)).toBeNull();
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
    expect(finderFieldDeg(0.72)).toBeGreaterThan(frame28);
    expect(finderFieldDeg(0.72, 1.4)).toBeLessThan(finderFieldDeg(0.72));
    // The M3's 0.91× finder is built around the 50 mm frame.
    const frame50 = (2 * Math.atan(18 / 50) * 180) / Math.PI;
    expect(finderFieldDeg(0.91)).toBeGreaterThan(frame50);
    expect(finderFieldDeg(0.91)).toBeLessThan(frame28);
  });
});

describe("framelineParallax", () => {
  it("shrinks with distance and is zero at infinity", () => {
    expect(framelineParallax(0.7).x).toBeGreaterThan(framelineParallax(2).x);
    expect(framelineParallax(Infinity)).toEqual({ x: 0, y: 0 });
  });
});
