import { describe, expect, it } from "vitest";
import { correctShutter, exposureError, meterLeds, settingEv, shakeBlurMm } from "./exposure";

describe("exposure", () => {
  it("follows sunny 16: f/16 at 1/ISO in EV 15 sun", () => {
    expect(exposureError(15, 16, 1 / 100, 100)).toBeCloseTo(0.36, 2); // 1/100 vs exact 1/128: log2(128/100)
    expect(exposureError(15, 16, 1 / 128, 100)).toBeCloseTo(0, 1);
  });

  it("counts one stop per doubling of ISO or shutter time", () => {
    const base = exposureError(8, 2, 1 / 60, 400);
    expect(exposureError(8, 2, 1 / 30, 400)).toBeCloseTo(base + 1, 9);
    expect(exposureError(8, 2, 1 / 60, 800)).toBeCloseTo(base + 1, 9);
    expect(exposureError(8, 2.8, 1 / 60, 400)).toBeCloseTo(base - 0.97, 1);
  });

  it("aperture priority lands on zero error", () => {
    const t = correctShutter(5, 1.4, 400);
    expect(exposureError(5, 1.4, t, 400)).toBeCloseTo(0, 9);
    // Night street, Portra 400, f/1.4: about 1/60 s.
    expect(1 / t).toBeGreaterThan(50);
    expect(1 / t).toBeLessThan(80);
  });

  it("computes setting EV", () => {
    expect(settingEv(1, 1)).toBe(0);
    expect(settingEv(2, 1)).toBe(2);
  });
});

describe("shake", () => {
  it("is one CoC at 1/focal length and grows with time", () => {
    expect(shakeBlurMm(1 / 50, 50)).toBeCloseTo(0.03, 9);
    expect(shakeBlurMm(1 / 8, 50)).toBeGreaterThan(0.15);
  });
});

describe("meterLeds", () => {
  it("lights the dot alone when spot on", () => {
    expect(meterLeds(0)).toEqual({ under: false, ok: true, over: false });
  });
  it("shows dot plus arrow for half a stop, arrow alone beyond", () => {
    expect(meterLeds(0.5)).toEqual({ under: false, ok: true, over: true });
    expect(meterLeds(-2)).toEqual({ under: true, ok: false, over: false });
  });
});
