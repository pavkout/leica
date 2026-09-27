import { describe, expect, it } from "vitest";
import { LENSES } from "../data/gear";
import { BREATHING_PROFILES, PERSPECTIVE_SCENE, breathingPercent, effectiveFocal, focalForSameSubject, imageHeight, project, relativeSize, type BreathingProfile } from "./perspective";

const person = PERSPECTIVE_SCENE.find((o) => o.id === "person")!;
const building = PERSPECTIVE_SCENE.find((o) => o.id === "building")!;

describe("pinhole projection", () => {
  it("projects f·X/Z", () => {
    expect(project({ x: 1, y: 1.5, depth: 0 }, 2, 50)).toEqual({ x: 25, y: 0 });
    expect(project({ x: 0, y: 0, depth: -5 }, 2, 50)).toBeNull(); // behind the camera
  });

  it("scales everything uniformly with focal length", () => {
    expect(imageHeight(building, 3, 100) / imageHeight(building, 3, 50)).toBeCloseTo(2);
    expect(imageHeight(person, 3, 100) / imageHeight(person, 3, 50)).toBeCloseTo(2);
  });
});

describe("perspective (acceptance: changes only with camera position)", () => {
  it("relative size doesn't depend on focal length at all", () => {
    for (const f of [21, 35, 50, 90, 135]) {
      expect(imageHeight(building, 4, f) / imageHeight(person, 4, f)).toBeCloseTo(relativeSize(building, person, 4));
    }
  });

  it("moving the camera changes relative size", () => {
    // Closer to the subject, the background shrinks relative to the person.
    expect(relativeSize(building, person, 1.5)).toBeLessThan(relativeSize(building, person, 6));
  });

  it("dolly zoom keeps the subject's size while the background changes", () => {
    const target = imageHeight(person, 3, 50);
    for (const d of [1.5, 3, 6, 10]) {
      const f = focalForSameSubject(person, target, d);
      expect(imageHeight(person, d, f)).toBeCloseTo(target);
    }
    const near = imageHeight(building, 1.5, focalForSameSubject(person, target, 1.5));
    const far = imageHeight(building, 10, focalForSameSubject(person, target, 10));
    expect(far).toBeGreaterThan(near);
  });

  it("resetting to the starting distance and focal length gives identical framing", () => {
    const start = PERSPECTIVE_SCENE.map((o) => project(o.base, 3, 50));
    const moved = PERSPECTIVE_SCENE.map((o) => project(o.base, 7, 90));
    const back = PERSPECTIVE_SCENE.map((o) => project(o.base, 3, 50));
    expect(moved).not.toEqual(start);
    expect(back).toEqual(start);
  });
});

describe("breathing (acceptance: no fake percentage without data)", () => {
  it("has no breathing data for any catalogue lens, so it's not modelled", () => {
    expect(Object.keys(BREATHING_PROFILES)).toEqual([]);
    for (const l of LENSES) expect(breathingPercent(BREATHING_PROFILES[l.id], l.focalMm, 1000)).toBeNull();
  });

  it("interpolates a sourced curve when one exists", () => {
    const p: BreathingProfile = { points: [[700, 48], [2000, 49.5], [1e9, 50]], provenance: { kind: "measured", notes: "test" } };
    expect(effectiveFocal(p, 700)).toBe(48);
    expect(effectiveFocal(p, 1350)).toBeCloseTo(48.75);
    expect(breathingPercent(p, 50, 700)).toBeCloseTo((50 / 48 - 1) * 100);
  });
});
