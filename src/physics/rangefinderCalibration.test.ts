import { describe, expect, it } from "vitest";
import { blurDiscMm } from "./optics";
import { ALIGNED, CALIBRATION_ASSUMPTIONS, FORBIDDEN_ADVICE, RF_BASE_MM, chartDistances, focusError, indicatedFocus } from "./rangefinderCalibration";

describe("zero offsets (acceptance: exactly normal focus)", () => {
  it("focuses exactly on the subject with no blur, at every distance", () => {
    for (const d of [700, 1000, 3000, 10000, 1e6]) {
      expect(indicatedFocus(d, ALIGNED)).toEqual({ focusMm: d, pastInfinity: false });
      expect(focusError(50, 1.4, 0.03, d, ALIGNED)).toMatchObject({ deviationMm: 0, blurMm: 0, blurRatio: 0 });
    }
  });

  it("a vertical offset alone changes nothing about focus", () => {
    expect(indicatedFocus(2000, { ...ALIGNED, verticalArcmin: 8 })).toEqual({ focusMm: 2000, pastInfinity: false });
  });
});

describe("horizontal misalignment", () => {
  it("follows 1/d′ = 1/d + δ/B", () => {
    const d = 3000;
    const delta = (2 * Math.PI) / (180 * 60);
    expect(indicatedFocus(d, { ...ALIGNED, horizontalArcmin: 2 }).focusMm).toBeCloseTo(1 / (1 / d + delta / RF_BASE_MM), 6);
  });

  it("stops short of infinity when reading close, and can't align past infinity when reading far", () => {
    expect(indicatedFocus(1e9, { ...ALIGNED, horizontalArcmin: 2 }).focusMm).toBeLessThan(200000);
    expect(indicatedFocus(1e9, { ...ALIGNED, horizontalArcmin: -2 })).toEqual({ focusMm: Infinity, pastInfinity: true });
  });

  it("uses the shared blur engine", () => {
    const r = focusError(50, 2, 0.03, 2000, { ...ALIGNED, horizontalArcmin: 3 });
    expect(r.blurMm).toBeCloseTo(blurDiscMm(50, 2, r.focusMm, 2000));
  });
});

describe("sensitivity (acceptance: recalculated with focal length)", () => {
  const m = { ...ALIGNED, horizontalArcmin: 2 };
  it("hurts longer lenses more at the same distance and aperture", () => {
    const ratios = [28, 35, 50, 75, 90].map((f) => focusError(f, 2, 0.03, 3000, m).blurRatio);
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]).toBeGreaterThan(ratios[i - 1]);
  });

  it("hurts wider apertures more", () => {
    expect(focusError(50, 1.4, 0.03, 3000, m).blurRatio).toBeGreaterThan(focusError(50, 8, 0.03, 3000, m).blurRatio);
  });

  it("a baseline error grows with distance in focus terms", () => {
    const b = { ...ALIGNED, baselineErrorPct: 2 };
    expect(Math.abs(focusError(50, 2, 0.03, 5000, b).deviationMm)).toBeGreaterThan(Math.abs(focusError(50, 2, 0.03, 1000, b).deviationMm));
  });
});

describe("chart and wording", () => {
  it("spaces chart distances logarithmically between the limits", () => {
    const d = chartDistances(700, 20000, 5);
    expect(d[0]).toBeCloseTo(700);
    expect(d[4]).toBeCloseTo(20000);
    expect(d[1] / d[0]).toBeCloseTo(d[2] / d[1]);
  });

  it("states its assumptions as approximate", () => {
    expect(CALIBRATION_ASSUMPTIONS.kind).toBe("approximate");
  });

  it("recognises repair instructions so the UI can be checked for them", () => {
    expect(FORBIDDEN_ADVICE.test("Remove the top plate and adjust the screw")).toBe(true);
    expect(FORBIDDEN_ADVICE.test("Have a qualified technician check the rangefinder")).toBe(false);
  });
});

describe("effect at infinity", () => {
  it("reading close: set to infinity, the lens focuses at B/δ", async () => {
    const { infinityEffect } = await import("./rangefinderCalibration");
    const e = infinityEffect({ ...ALIGNED, horizontalArcmin: 2 });
    expect(e).toEqual({ kind: "stops-short", focusMm: RF_BASE_MM / ((2 * Math.PI) / (180 * 60)) });
    // Consistent with the indicated focus of a very distant subject.
    expect(indicatedFocus(1e12, { ...ALIGNED, horizontalArcmin: 2 }).focusMm).toBeCloseTo((e as { focusMm: number }).focusMm, 0);
  });

  it("reading far: nothing beyond B/δ can be aligned", async () => {
    const { infinityEffect } = await import("./rangefinderCalibration");
    const e = infinityEffect({ ...ALIGNED, horizontalArcmin: -8 }) as { kind: string; distanceMm: number };
    expect(e.kind).toBe("cannot-align-beyond");
    expect(indicatedFocus(e.distanceMm * 1.01, { ...ALIGNED, horizontalArcmin: -8 }).pastInfinity).toBe(true);
    expect(indicatedFocus(e.distanceMm * 0.99, { ...ALIGNED, horizontalArcmin: -8 }).pastInfinity).toBe(false);
  });

  it("is nothing without a horizontal offset", async () => {
    const { infinityEffect } = await import("./rangefinderCalibration");
    expect(infinityEffect({ ...ALIGNED, verticalArcmin: 5, baselineErrorPct: 2 })).toBeNull();
  });
});
