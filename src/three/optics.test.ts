import { describe, expect, it } from "vitest";
import { LENSES, findLens } from "../data/gear";
import { M_FLANGE_FOCAL_MM, XRAY_PROVENANCE, unitFocusExtensionMm, xrayLayout } from "./optics";

const summilux50 = findLens("m-50-1.4");

describe("focus extension", () => {
  it("is zero at infinity and grows as focus comes closer", () => {
    expect(unitFocusExtensionMm(50, Infinity)).toBe(0);
    expect(unitFocusExtensionMm(50, 5000)).toBeCloseTo(2500 / 4950);
    expect(unitFocusExtensionMm(50, 700)).toBeGreaterThan(unitFocusExtensionMm(50, 1000));
  });

  it("matches the thin-lens equation 1/f = 1/u + 1/v", () => {
    for (const d of [450, 1000, 3000]) {
      const v = 50 + unitFocusExtensionMm(50, d);
      const u = d; // object distance from the lens, in this model
      expect(1 / u + 1 / v).toBeCloseTo(1 / 50, 10);
    }
  });
});

describe("X-Ray layout", () => {
  it("puts the image plane at the M flange distance behind the mount", () => {
    expect(xrayLayout(summilux50, Infinity, 1.4).imagePlaneY).toBeCloseTo(-M_FLANGE_FOCAL_MM / 1000);
  });

  it("places the ideal lens one focal length in front of the image plane at infinity", () => {
    const l = xrayLayout(summilux50, Infinity, 1.4);
    expect(l.thinLensY - l.imagePlaneY).toBeCloseTo(0.05);
  });

  it("moves the optics out by the extension when focusing closer", () => {
    const far = xrayLayout(summilux50, Infinity, 2);
    const near = xrayLayout(summilux50, 700, 2);
    expect(near.extension).toBeCloseTo(unitFocusExtensionMm(50, 700) / 1000);
    expect(near.thinLensY - far.thinLensY).toBeCloseTo(near.extension);
  });

  it("sizes the ray bundle by the entrance pupil, f/N", () => {
    expect(xrayLayout(summilux50, Infinity, 2).pupilRadius).toBeCloseTo(0.05 / 2 / 2);
    expect(xrayLayout(summilux50, Infinity, 8).pupilRadius).toBeCloseTo(xrayLayout(summilux50, Infinity, 2).pupilRadius / 4);
  });

  it("converges every ray on-axis at the image plane, through the pupil", () => {
    for (const lens of LENSES) {
      const l = xrayLayout(lens, 2000, lens.maxAperture);
      for (const ray of l.rays) {
        const [, mid, end] = ray.points;
        expect(end[0]).toBe(0);
        expect(end[1]).toBeCloseTo(l.imagePlaneY);
        expect(Math.abs(mid[0])).toBeLessThanOrEqual(l.pupilRadius + 1e-12);
      }
    }
  });

  it("keeps schematic groups inside the barrel on every catalogue lens", () => {
    for (const lens of LENSES) {
      const l = xrayLayout(lens, Infinity, lens.maxAperture);
      for (const g of l.groups) {
        expect(g.y).toBeGreaterThan(0);
        expect(g.y).toBeLessThan(lens.look.lengthMm / 1000);
        expect(g.radius).toBeLessThan(lens.look.diameterMm / 2000);
      }
    }
  });

  it("labels the groups as schematic, and focus and rays as calculated", () => {
    expect(XRAY_PROVENANCE.groups.kind).toBe("illustrative");
    expect(XRAY_PROVENANCE.focus.kind).toBe("calculated");
    expect(XRAY_PROVENANCE.rays.kind).toBe("calculated");
  });
});
