import { describe, expect, it } from "vitest";
import { LENSES, apertureStops, findBody, findLens, shutterSpeeds } from "../data/gear";
import {
  FOCUS_THROW_RAD,
  LEVER_STROKE_RAD,
  RING_RAD_PER_STOP,
  STROKE_BACK_S,
  STROKE_OUT_S,
  advanceLeverAngle,
  apertureRingAngle,
  apertureRingMarks,
  chooseQualityTier,
  dialDetents,
  dialStep,
  focusRingAngle,
  focusRingMarks,
  irisOpening,
  lensProfile,
  shutterDialAngle,
} from "./rig";

const summilux50 = findLens("m-50-1.4");

describe("aperture ring pose", () => {
  it("is 0 wide open and turns one step per stop", () => {
    expect(apertureRingAngle(summilux50, 1.4)).toBe(0);
    expect(apertureRingAngle(summilux50, 2.8)).toBeCloseTo(2 * RING_RAD_PER_STOP);
    expect(apertureRingAngle(summilux50, 16)).toBeCloseTo(7 * RING_RAD_PER_STOP, 1);
  });

  it("turns monotonically through every selectable stop, deterministically", () => {
    for (const lens of LENSES) {
      const angles = apertureStops(lens).map((n) => apertureRingAngle(lens, n));
      for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1]);
      expect(apertureStops(lens).map((n) => apertureRingAngle(lens, n))).toEqual(angles);
    }
  });

  it("puts each engraved mark under the index exactly when that stop is set", () => {
    for (const { label, angle } of apertureRingMarks(summilux50)) {
      expect(angle + apertureRingAngle(summilux50, Number(label))).toBeCloseTo(0);
    }
  });

  it("engraves wide open plus full stops only", () => {
    expect(apertureRingMarks(summilux50).map((m) => m.label)).toEqual(["1.4", "2", "2.8", "4", "5.6", "8", "11", "16"]);
  });
});

describe("iris opening", () => {
  it("is full wide open and scales as 1/f-number", () => {
    expect(irisOpening(summilux50, 1.4)).toBe(1);
    expect(irisOpening(summilux50, 2.8)).toBeCloseTo(0.5);
  });
});

describe("lens profile", () => {
  it("fits both rings inside every catalogue lens without overlapping", () => {
    for (const lens of LENSES) {
      const p = lensProfile(lens);
      expect(p.focusRing[0]).toBeGreaterThan(0);
      expect(p.focusRing[1]).toBeLessThanOrEqual(p.apertureRing[0]);
      expect(p.apertureRing[1]).toBeLessThan(p.length);
      expect(p.frontRadius).toBeLessThan(p.radius);
      expect(p.mountRadius).toBeLessThanOrEqual(p.radius);
    }
  });

  it("uses the catalogue's size in metres", () => {
    const p = lensProfile(summilux50);
    expect(p.length).toBeCloseTo(summilux50.look.lengthMm / 1000);
    expect(p.radius).toBeCloseTo(summilux50.look.diameterMm / 2000);
  });
});

describe("quality tier", () => {
  it("falls back to 2D without WebGL", () => {
    expect(chooseQualityTier({ webgl: false, webgl2: false })).toBe("fallback");
  });

  it("reduces on WebGL1, data saver, or weak hardware", () => {
    expect(chooseQualityTier({ webgl: true, webgl2: false })).toBe("reduced");
    expect(chooseQualityTier({ webgl: true, webgl2: true, saveData: true })).toBe("reduced");
    expect(chooseQualityTier({ webgl: true, webgl2: true, deviceMemory: 2 })).toBe("reduced");
    expect(chooseQualityTier({ webgl: true, webgl2: true, hardwareConcurrency: 2 })).toBe("reduced");
  });

  it("is full on a capable device, including Safari, which hides deviceMemory", () => {
    expect(chooseQualityTier({ webgl: true, webgl2: true, hardwareConcurrency: 6 })).toBe("full");
    expect(chooseQualityTier({ webgl: true, webgl2: true })).toBe("full");
  });
});

describe("focus ring pose", () => {
  it("is 0 at infinity and the full throw at closest focus", () => {
    expect(focusRingAngle(summilux50, Infinity)).toBe(0);
    expect(focusRingAngle(summilux50, summilux50.minFocusMm)).toBeCloseTo(FOCUS_THROW_RAD);
  });

  it("turns monotonically as focus comes closer, and clamps inside closest focus", () => {
    const ds = [Infinity, 10000, 5000, 2000, 1000, 700];
    const a = ds.map((d) => focusRingAngle(summilux50, d));
    for (let i = 1; i < a.length; i++) expect(a[i]).toBeGreaterThan(a[i - 1]);
    expect(focusRingAngle(summilux50, 300)).toBeCloseTo(FOCUS_THROW_RAD);
  });

  it("crowds the scale toward infinity, like a helicoid", () => {
    const farGap = focusRingAngle(summilux50, 5000) - focusRingAngle(summilux50, 10000);
    const nearGap = focusRingAngle(summilux50, 700) - focusRingAngle(summilux50, 1000);
    expect(nearGap).toBeGreaterThan(farGap);
  });

  it("engraves ∞ and the closest distance, with no overlapping labels, on every lens", () => {
    for (const lens of LENSES) {
      const marks = focusRingMarks(lens);
      expect(marks[0].label).toBe("∞");
      expect(Number(marks[marks.length - 1].label)).toBeCloseTo(lens.minFocusMm / 1000);
      for (let i = 1; i < marks.length; i++) expect(Math.abs(marks[i].angle - marks[i - 1].angle)).toBeGreaterThanOrEqual((16 * Math.PI) / 180 - 1e-9);
      for (const m of marks) if (m.label !== "∞") expect(m.angle + focusRingAngle(lens, Number(m.label) * 1000)).toBeCloseTo(0);
    }
  });
});

describe("shutter dial pose", () => {
  const m6 = findBody("m6");
  const m11 = findBody("m11");

  it("puts the slowest speed at 0 and turns one detent per faster speed", () => {
    const speeds = shutterSpeeds(m6);
    const step = dialStep(dialDetents(speeds, m6.autoExposure).length);
    expect(shutterDialAngle(speeds, Math.max(...speeds), false, m6.autoExposure)).toBe(0);
    expect(shutterDialAngle(speeds, 1 / 125, false, m6.autoExposure)).toBeCloseTo(dialDetents(speeds, false).findIndex((d) => d.label === "125") * step);
  });

  it("sits at A on automatic exposure, only on bodies that have it", () => {
    const speeds = shutterSpeeds(m11);
    const detents = dialDetents(speeds, true);
    expect(detents[detents.length - 1].label).toBe("A");
    expect(shutterDialAngle(speeds, 1 / 60, true, true)).toBeCloseTo((detents.length - 1) * dialStep(detents.length));
    expect(dialDetents(shutterSpeeds(m6), false).some((d) => d.label === "A")).toBe(false);
  });

  it("fits every position within 330° even on long digital dials", () => {
    for (const body of [m6, m11]) {
      const n = dialDetents(shutterSpeeds(body), body.autoExposure).length;
      expect((n - 1) * dialStep(n)).toBeLessThanOrEqual((330 * Math.PI) / 180 + 1e-9);
    }
  });

  it("labels slow speeds in seconds and fast ones as reciprocals", () => {
    const labels = dialDetents([2, 1, 1 / 2, 1 / 1000], false).map((d) => d.label);
    expect(labels).toEqual(["2s", "1", "2", "1000"]);
  });
});

describe("advance lever stroke", () => {
  it("rests at 0, peaks at the full stroke, and springs back", () => {
    expect(advanceLeverAngle(0)).toBe(0);
    expect(advanceLeverAngle(STROKE_OUT_S)).toBeCloseTo(LEVER_STROKE_RAD);
    expect(advanceLeverAngle(STROKE_OUT_S + STROKE_BACK_S)).toBe(0);
    expect(advanceLeverAngle(STROKE_OUT_S / 2)).toBeGreaterThan(0);
    expect(advanceLeverAngle(STROKE_OUT_S / 2)).toBeLessThan(LEVER_STROKE_RAD);
  });
});
