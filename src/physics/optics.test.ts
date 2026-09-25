import { describe, expect, it } from "vitest";
import {
  airyDiscMm,
  angleOfView,
  blurDiscMm,
  depthOfField,
  diffractionLimitedFNumber,
  distanceFromExtension,
  focusExtension,
  hyperfocal,
} from "./optics";

describe("hyperfocal", () => {
  it("matches the textbook value for 28mm f/8 at 0.03mm", () => {
    // 28² / (8 × 0.03) + 28 = 3294.67mm
    expect(hyperfocal(28, 8, 0.03)).toBeCloseTo(3294.67, 1);
  });
});

describe("depthOfField", () => {
  it("covers half the hyperfocal distance to infinity when focused at H", () => {
    const H = hyperfocal(35, 5.6, 0.03);
    const dof = depthOfField(35, 5.6, 0.03, H);
    expect(dof.nearMm).toBeCloseTo(H / 2, 6);
    expect(dof.farMm).toBe(Infinity);
  });

  it("brackets the focus distance", () => {
    const dof = depthOfField(50, 1.4, 0.03, 2000);
    expect(dof.nearMm).toBeLessThan(2000);
    expect(dof.farMm).toBeGreaterThan(2000);
    // Hand-computed: H = 50²/(1.4 × 0.03) + 50 = 59 573mm → 1.937–2.068m.
    expect(dof.nearMm / 1000).toBeCloseTo(1.937, 3);
    expect(dof.farMm / 1000).toBeCloseTo(2.068, 3);
  });

  it("goes past infinity (negative signed far) beyond the hyperfocal distance", () => {
    const H = hyperfocal(28, 8, 0.03);
    const dof = depthOfField(28, 8, 0.03, H * 2);
    expect(dof.farMm).toBe(Infinity);
    expect(dof.farSignedMm).toBeLessThan(0);
  });

  it("is continuous at infinity focus", () => {
    const atInf = depthOfField(50, 2, 0.03, Infinity);
    const nearlyInf = depthOfField(50, 2, 0.03, 1e12);
    expect(atInf.nearMm).toBeCloseTo(nearlyInf.nearMm, 1);
  });
});

describe("blurDiscMm", () => {
  it("is zero at the focus distance", () => {
    expect(blurDiscMm(50, 2, 3000, 3000)).toBe(0);
  });

  it("equals aperture × magnification for a background at infinity", () => {
    // 50/1.4 × 50/(2000−50)
    expect(blurDiscMm(50, 1.4, 2000, Infinity)).toBeCloseTo((50 / 1.4) * (50 / 1950), 9);
  });

  it("is continuous as focus approaches infinity", () => {
    expect(blurDiscMm(50, 2, Infinity, 5000)).toBeCloseTo(blurDiscMm(50, 2, 1e12, 5000), 6);
  });

  it("equals the circle of confusion at the DoF limits", () => {
    const dof = depthOfField(90, 2, 0.03, 3000);
    expect(blurDiscMm(90, 2, 3000, dof.nearMm)).toBeCloseTo(0.03, 3);
    expect(blurDiscMm(90, 2, 3000, dof.farMm)).toBeCloseTo(0.03, 3);
  });
});

describe("diffraction", () => {
  it("puts the M11 pixel-level limit near f/5.6", () => {
    const pitch = Math.sqrt((36 * 24) / 60e6); // ≈ 3.79µm
    const n = diffractionLimitedFNumber(2 * pitch);
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(6.5);
  });

  it("grows with magnification", () => {
    expect(airyDiscMm(8, 1)).toBeCloseTo(2 * airyDiscMm(8, 0), 9);
  });
});

describe("focus extension", () => {
  it("round-trips distances", () => {
    for (const d of [300, 700, 1000, 5000, 100000]) {
      expect(distanceFromExtension(50, focusExtension(50, d))).toBeCloseTo(d, 6);
    }
    expect(distanceFromExtension(50, 0)).toBe(Infinity);
  });
});

describe("angleOfView", () => {
  it("gives ~75° horizontal for 28mm on full frame", () => {
    expect(angleOfView(28, 36)).toBeCloseTo(65.47, 1);
    expect(angleOfView(28, Math.hypot(36, 24))).toBeCloseTo(75.38, 1);
  });
});
