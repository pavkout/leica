import { describe, expect, it } from "vitest";
import { correct } from "../data/reciprocity";
import { densityStops, factorStops, flashAperture, flashReach, formatLong, parseTime, ringAperture, withNd } from "./exposureCalc";

describe("ND filters", () => {
  it("converts density and factor to stops", () => {
    expect(densityStops(0.9)).toBeCloseTo(3, 1);
    expect(densityStops(3)).toBeCloseTo(10, 0);
    expect(factorStops(1000)).toBeCloseTo(10, 0);
    expect(withNd(1 / 125, 10)).toBeCloseTo(8.19, 2);
  });
});

describe("reciprocity", () => {
  it("follows Ilford's power law above one second", () => {
    expect(correct("hp5", 0.5)).toMatchObject({ ok: true, seconds: 0.5 });
    const r = correct("hp5", 10);
    expect(r.ok && r.seconds).toBeCloseTo(10 ** 1.31, 3);
  });
  it("follows Kodak's Tri-X table through its published points", () => {
    expect(correct("trix400", 1)).toMatchObject({ ok: true, seconds: 2 });
    const ten = correct("trix400", 10);
    expect(ten.ok && ten.seconds).toBeCloseTo(50, 5);
    const between = correct("trix400", 3);
    expect(between.ok && between.seconds > 3 * 2 && between.seconds < 50).toBe(true);
    expect(correct("trix400", 1 / 250)).toMatchObject({ ok: true, stops: 0 });
    expect(correct("trix400", 200)).toEqual({ ok: false, reason: "beyond", upTo: 100 });
  });
  it("says when there's nothing published", () => {
    expect(correct("portra400", 1 / 2)).toMatchObject({ ok: true, stops: 0 });
    expect(correct("portra400", 4)).toEqual({ ok: false, reason: "beyond", upTo: 1 });
    expect(correct("gold200", 4)).toEqual({ ok: false, reason: "unknown" });
    const v = correct("velvia50", 32);
    expect(v.ok && v.stops).toBeCloseTo(1, 5);
    expect(correct("velvia50", 64).ok).toBe(false);
  });
});

describe("flash", () => {
  it("gives the aperture and the reach for a guide number", () => {
    expect(flashAperture(20, 100, 2.5)).toBe(8);
    expect(flashAperture(20, 400, 5)).toBe(8);
    expect(flashReach(20, 100, 4)).toBe(5);
    expect(ringAperture(7.4)).toBe(8);
    expect(ringAperture(5.6)).toBe(5.6);
  });
});

describe("times", () => {
  it("reads and writes long times", () => {
    expect(parseTime("1/125")).toBeCloseTo(1 / 125);
    expect(parseTime("30s")).toBe(30);
    expect(parseTime("2m")).toBe(120);
    expect(parseTime("1:30")).toBe(90);
    expect(parseTime("x")).toBeNull();
    expect(formatLong(1 / 250)).toBe("1/250 s");
    expect(formatLong(8.19)).toBe("8.2 s");
    expect(formatLong(150)).toBe("2 min 30 s");
    expect(formatLong(3900)).toBe("1 h 05 min");
  });
});
