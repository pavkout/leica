import { describe, expect, it } from "vitest";
import {
  BODIES,
  LENSES,
  apertureStops,
  findBody,
  findLens,
  formatShutter,
  framelinesFor,
  isAdapted,
  isFullStop,
  lensesForBody,
  nearestStop,
} from "./gear";

describe("findBody/findLens", () => {
  it("finds a known id", () => {
    expect(findBody("m11").name).toBe("M11");
    expect(findLens("m-50-1.4").name).toContain("Summilux-M 50");
  });

  it("falls back to the first row for an unknown id", () => {
    expect(findBody("not-a-real-body")).toBe(BODIES[0]);
    expect(findLens("not-a-real-lens")).toBe(LENSES[0]);
  });
});

describe("lensesForBody", () => {
  it("returns only the fixed lens for a fixed-lens body", () => {
    const q3 = findBody("q3");
    const lenses = lensesForBody(q3);
    expect(lenses).toHaveLength(1);
    expect(lenses[0].id).toBe(q3.fixedLensId);
  });

  it("lists native-mount lenses for an M body", () => {
    const m11 = findBody("m11");
    const lenses = lensesForBody(m11);
    expect(lenses.length).toBeGreaterThan(1);
    expect(lenses.every((l) => l.mount === "M")).toBe(true);
  });

  it("puts native mounts before adapted mounts", () => {
    const sl3 = findBody("sl3");
    const lenses = lensesForBody(sl3);
    const firstAdaptedIndex = lenses.findIndex((l) => isAdapted(sl3, l));
    const lastNativeIndex = lenses.map((l) => !isAdapted(sl3, l)).lastIndexOf(true);
    expect(firstAdaptedIndex).toBeGreaterThan(lastNativeIndex);
  });
});

describe("isAdapted", () => {
  it("is false for a body's native mount", () => {
    const m11 = findBody("m11");
    expect(isAdapted(m11, findLens("m-50-1.4"))).toBe(false);
  });

  it("is true for a lens only reachable through adaptedMounts", () => {
    const sl3 = findBody("sl3");
    expect(isAdapted(sl3, findLens("m-50-1.4"))).toBe(true);
  });
});

describe("framelinesFor", () => {
  it("returns the pair containing the lens's focal length", () => {
    const m11 = findBody("m11");
    expect(framelinesFor(m11, 50)).toEqual([50, 75]);
    expect(framelinesFor(m11, 35)).toEqual([35, 135]);
  });

  it("returns null when the focal length has no frameline (or the body has no finder)", () => {
    const m11 = findBody("m11");
    expect(framelinesFor(m11, 21)).toBeNull();
    const q3 = findBody("q3");
    expect(framelinesFor(q3, 28)).toBeNull();
  });
});

describe("apertureStops", () => {
  it("starts at the lens's maximum aperture", () => {
    const lens = findLens("m-50-1.4");
    expect(apertureStops(lens)[0]).toBe(lens.maxAperture);
  });

  it("ends at the lens's minimum aperture", () => {
    const lens = findLens("m-50-1.4");
    const stops = apertureStops(lens);
    expect(stops[stops.length - 1]).toBe(lens.minAperture);
  });

  it("is strictly increasing with no duplicate near the max aperture", () => {
    const lens = findLens("m-50-0.95"); // maxAperture 0.95, close to the 1.2 marked stop
    const stops = apertureStops(lens);
    for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThan(stops[i - 1]);
  });
});

describe("isFullStop", () => {
  it("recognises full stops and rejects half stops", () => {
    expect(isFullStop(2.8)).toBe(true);
    expect(isFullStop(0.95)).toBe(true);
    expect(isFullStop(3.4)).toBe(false);
  });
});

describe("nearestStop", () => {
  it("picks the closest stop on a log scale", () => {
    const stops = [1.4, 2, 2.8, 4, 5.6, 8];
    expect(nearestStop(stops, 2.1)).toBe(2);
    expect(nearestStop(stops, 3.9)).toBe(4);
  });

  it("returns the value itself when it's already a listed stop", () => {
    const stops = [1.4, 2, 2.8, 4];
    expect(nearestStop(stops, 2.8)).toBe(2.8);
  });
});

describe("formatShutter", () => {
  it("formats sub-second speeds as a fraction", () => {
    expect(formatShutter(1 / 125)).toBe("1/125");
  });

  it("formats whole seconds with an 's' suffix", () => {
    expect(formatShutter(2)).toBe("2s");
  });

  it("snaps a stepless aperture-priority time to the nearest marked speed", () => {
    // Close to 1/125 (within the 1/6-stop tolerance) should read as the marked speed.
    expect(formatShutter(1 / 123)).toBe("1/125");
  });

  it("shows an unmarked, rounded (2 significant figures) fraction when far from any marked speed", () => {
    // 1/347s sits roughly midway between the 1/250 and 1/500 marked speeds.
    expect(formatShutter(1 / 347)).toBe("1/350");
  });
});
