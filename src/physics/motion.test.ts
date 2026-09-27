import { describe, expect, it } from "vitest";
import { shakeBlurMm } from "./exposure";
import { magnification } from "./optics";
import { MOTION_ARCHETYPES, MOTION_PROVENANCE, angularBlurMm, blurBand, motionResult, subjectBlurMm, trailSamples } from "./motion";

const walk = MOTION_ARCHETYPES.find((a) => a.id === "walk")!;
const base = { speedMps: walk.speedMps, focalMm: 50, distanceMm: 5000, cocMm: 0.03, subjectMotion: true, cameraShake: true };

describe("subject blur", () => {
  it("is speed × time × magnification on the image plane", () => {
    expect(subjectBlurMm(1.4, 1 / 15, 50, 5000)).toBeCloseTo(1400 * (1 / 15) * magnification(50, 5000));
  });

  it("freezes a walker at 1/1000 and streaks it at 1/15 (acceptance criterion)", () => {
    const fast = motionResult({ ...base, shutterSec: 1 / 1000 });
    const slow = motionResult({ ...base, shutterSec: 1 / 15 });
    expect(blurBand(fast.subjectRatio)).toBe("frozen");
    expect(blurBand(slow.subjectRatio)).toBe("streaked");
    expect(slow.subjectBlurMm / fast.subjectBlurMm).toBeCloseTo(1000 / 15);
  });

  it("grows with speed and shrinks with distance", () => {
    expect(subjectBlurMm(13.9, 1 / 250, 50, 5000)).toBeGreaterThan(subjectBlurMm(1.4, 1 / 250, 50, 5000));
    expect(subjectBlurMm(1.4, 1 / 250, 50, 20000)).toBeLessThan(subjectBlurMm(1.4, 1 / 250, 50, 5000));
  });

  it("handles a custom angular speed (f × ω × t)", () => {
    expect(angularBlurMm(10, 1 / 30, 50)).toBeCloseTo(50 * ((10 * Math.PI) / 180) / 30);
  });
});

describe("independence (acceptance criterion)", () => {
  it("switching camera shake off leaves subject blur unchanged, and vice versa", () => {
    const both = motionResult({ ...base, shutterSec: 1 / 30 });
    const noShake = motionResult({ ...base, shutterSec: 1 / 30, cameraShake: false });
    const noSubject = motionResult({ ...base, shutterSec: 1 / 30, subjectMotion: false });
    expect(noShake.subjectBlurMm).toBe(both.subjectBlurMm);
    expect(noShake.shakeBlurMm).toBe(0);
    expect(noSubject.shakeBlurMm).toBe(both.shakeBlurMm);
    expect(noSubject.subjectBlurMm).toBe(0);
  });

  it("takes camera shake from the shared shake model", () => {
    expect(motionResult({ ...base, shutterSec: 1 / 30 }).shakeBlurMm).toBe(shakeBlurMm(1 / 30, 50));
  });
});

describe("continuum and rendering budget", () => {
  it("describes blur as bands on a continuum", () => {
    expect([0.5, 2, 6, 20].map(blurBand)).toEqual(["frozen", "slight", "visible", "streaked"]);
  });

  it("uses fewer samples while dragging, and never zero", () => {
    expect(trailSamples(200, false)).toBe(64);
    expect(trailSamples(200, true)).toBe(12);
    expect(trailSamples(0, false)).toBe(1);
  });

  it("labels archetype speeds as approximate", () => {
    expect(MOTION_PROVENANCE.kind).toBe("approximate");
  });
});
