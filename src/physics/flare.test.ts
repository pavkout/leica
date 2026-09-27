import { describe, expect, it } from "vitest";
import { LENSES, findLens } from "../data/gear";
import { apertureShape } from "../preview/aperture";
import { ARTISTIC_FLARE_PROFILE, FLARE_PROFILES, fieldAngleDeg, flareKernel, flareProfileFor, hoodTransmission, spikeCount } from "./flare";

const FF = { width: 36, height: 24 };
const lux50 = findLens("m-50-1.4");
const base = { lens: lux50, fNumber: 2.8, frame: FF, x: 0.7, y: -0.4, intensity: 0.8, hood: false };

describe("field angle", () => {
  it("is 0 on axis and matches the half angle of view at the frame edge", () => {
    expect(fieldAngleDeg(0, 0, 50, FF)).toBe(0);
    expect(fieldAngleDeg(1, 0, 50, FF)).toBeCloseTo((Math.atan(18 / 50) * 180) / Math.PI);
  });

  it("is wider on a wide-angle lens for the same frame position", () => {
    expect(fieldAngleDeg(1, 1, 21, FF)).toBeGreaterThan(fieldAngleDeg(1, 1, 50, FF));
  });
});

describe("diffraction spikes", () => {
  it("are n for an even blade count and 2n for an odd one", () => {
    expect(spikeCount(10)).toBe(10);
    expect(spikeCount(9)).toBe(18);
    expect(spikeCount(11)).toBe(22);
  });
});

describe("hood", () => {
  it("can't block light from inside the frame's angle of view", () => {
    expect(hoodTransmission(fieldAngleDeg(0.9, 0.9, 50, FF), 50, FF, true)).toBe(1);
  });

  it("cuts light from well outside the frame", () => {
    expect(hoodTransmission(fieldAngleDeg(2, 2, 50, FF), 50, FF, true)).toBeLessThan(0.2);
    expect(hoodTransmission(fieldAngleDeg(2, 2, 50, FF), 50, FF, false)).toBe(1);
  });

  it("changes only brightness: the same ghosts, in the same places", () => {
    const off = flareKernel({ ...base, x: 1.4, y: 0.6 });
    const on = flareKernel({ ...base, x: 1.4, y: 0.6, hood: true });
    expect(on.ghosts.map((g) => [g.x, g.y, g.r])).toEqual(off.ghosts.map((g) => [g.x, g.y, g.r]));
    expect(on.veil).toBeLessThan(off.veil);
    expect(on.angleDeg).toBe(off.angleDeg);
  });
});

describe("flare kernel", () => {
  it("is deterministic", () => {
    expect(flareKernel(base)).toEqual(flareKernel(base));
  });

  it("changes smoothly as the light moves", () => {
    const a = flareKernel(base);
    const b = flareKernel({ ...base, x: base.x + 0.001 });
    a.ghosts.forEach((g, i) => {
      expect(Math.abs(g.x - b.ghosts[i].x)).toBeLessThan(0.01);
      expect(Math.abs(g.alpha - b.ghosts[i].alpha)).toBeLessThan(0.01);
    });
  });

  it("puts ghosts on the line through the light and the frame centre", () => {
    for (const g of flareKernel(base).ghosts) expect(g.x * base.y - g.y * base.x).toBeCloseTo(0, 10);
  });

  it("gives ghosts the iris shape at the current aperture, and shrinks them stopping down", () => {
    const wide = flareKernel({ ...base, fNumber: 1.4 });
    const narrow = flareKernel({ ...base, fNumber: 8 });
    expect(narrow.shape).toEqual(apertureShape(lux50, 8));
    expect(narrow.ghosts[0].r).toBeLessThan(wide.ghosts[0].r);
  });

  it("shows spikes only with straight-edged blades in frame, and none from out of frame", () => {
    expect(flareKernel({ ...base, fNumber: 1.4 }).spikes.alpha).toBe(0);
    expect(flareKernel({ ...base, fNumber: 11 }).spikes.alpha).toBeGreaterThan(0);
    expect(flareKernel({ ...base, fNumber: 11, x: 1.5 }).spikes.alpha).toBe(0);
  });

  it("uses the artistic profile for every lens, since none is measured", () => {
    expect(Object.keys(FLARE_PROFILES)).toEqual([]);
    for (const lens of LENSES) expect(flareProfileFor(lens.id)).toBe(ARTISTIC_FLARE_PROFILE);
    expect(ARTISTIC_FLARE_PROFILE.provenance.kind).toBe("illustrative");
  });
});
