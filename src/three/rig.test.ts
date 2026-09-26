import { describe, expect, it } from "vitest";
import { LENSES, apertureStops, findLens } from "../data/gear";
import { RING_RAD_PER_STOP, apertureRingAngle, apertureRingMarks, chooseQualityTier, irisOpening, lensProfile } from "./rig";

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
