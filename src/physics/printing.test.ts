import { describe, expect, it } from "vitest";
import { adjustStops, mix, newSizeTime, parseDilution, stripIncrements, testStripTimes } from "./printing";

describe("printing arithmetic", () => {
  it("makes f-stop test strips and the covering increments", () => {
    const t = testStripTimes(8, 1 / 3, 4);
    expect(t).toEqual([8, 10.1, 12.7, 16]);
    expect(stripIncrements(t)).toEqual([8, 2.1, 2.6, 3.3]);
    expect(stripIncrements(t).reduce((a, b) => a + b, 0)).toBeCloseTo(16, 5);
  });
  it("adjusts by stops", () => {
    expect(adjustStops(10, 1)).toBe(20);
    expect(adjustStops(10, -0.5)).toBe(7.1);
  });
  it("scales for a bigger print", () => {
    // 18 × 24 cm from 24 × 36: long edge 240 → 360 mm.
    expect(newSizeTime(10, 240, 360)).toBeCloseTo(10 * (11 / 7.667) ** 2, 0);
    expect(newSizeTime(10, 240, 240)).toBe(10);
  });
  it("mixes chemistry", () => {
    expect(parseDilution("1+9")).toBe(9);
    expect(parseDilution("1:31")).toBe(31);
    expect(parseDilution(" 1 + 4 ")).toBe(4);
    expect(parseDilution("stock")).toBeNull();
    expect(mix(500, 9)).toEqual({ concentrate: 50, water: 450 });
    expect(mix(1000, 4)).toEqual({ concentrate: 200, water: 800 });
  });
});
