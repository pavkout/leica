import { describe, expect, it } from "vitest";
import { blurDiscMm } from "../../physics/optics";
import { accumulationAlpha, blurCoefficients, blurPx, focusForTap, liveSceneEv, noiseFor, relDepthToInvM } from "./liveMath";

describe("shutter on the live camera", () => {
  it("fast shutters show each frame; slow ones integrate several", () => {
    expect(accumulationAlpha(1 / 60, 1 / 250)).toBe(1);
    expect(accumulationAlpha(1 / 60, 1 / 60)).toBe(1);
    expect(accumulationAlpha(1 / 60, 1 / 8)).toBeCloseTo(8 / 60, 9);
    expect(accumulationAlpha(1 / 60, 30)).toBe(0.01);
  });
});

describe("live metering", () => {
  it("is measured when the phone reports its exposure, estimated otherwise", () => {
    const m = liveSceneEv({ exposureSec: 1 / 100, iso: 100 }, 0.18, 12);
    expect(m.measured).toBe(true);
    expect(Number.isFinite(m.ev)).toBe(true);
    expect(liveSceneEv(null, 0.18, 12)).toEqual({ ev: 12, measured: false });
  });
});

describe("depth of field from a depth map", () => {
  it("matches the still renderer's blur disc exactly", () => {
    for (const [z, f] of [[3000, 2000], [10000, 2000], [1500, 5000]] as const) {
      const px = blurPx(1000 / z, f, 50, 2, 36, 1000);
      expect(px).toBeCloseTo((blurDiscMm(50, 2, f, z) / 36) * 1000, 6);
    }
  });

  it("is zero on the focus plane and grows away from it", () => {
    expect(blurPx(1000 / 2000, 2000, 50, 1.4, 36, 1000)).toBeCloseTo(0, 9);
    expect(blurPx(1000 / 8000, 2000, 50, 1.4, 36, 1000)).toBeGreaterThan(blurPx(1000 / 4000, 2000, 50, 1.4, 36, 1000));
    // Stopping down shrinks it.
    expect(blurPx(1000 / 8000, 2000, 50, 8, 36, 1000)).toBeLessThan(blurPx(1000 / 8000, 2000, 50, 1.4, 36, 1000));
  });

  it("the shader's coefficients give the same numbers", () => {
    const { a, b } = blurCoefficients(2500, 35, 2, 36, 800);
    for (const invZ of [0, 0.2, 0.4, 1, 2]) expect(Math.abs(invZ * a - b)).toBeCloseTo(blurPx(invZ, 2500, 35, 2, 36, 800), 9);
  });

  it("tap to focus lands the focus plane on the tapped depth", () => {
    const d = 0.3;
    const f = focusForTap(d, 700);
    expect(blurPx(relDepthToInvM(d), f, 50, 1.4, 36, 1000)).toBeCloseTo(0, 6);
    expect(focusForTap(0, 700)).toBe(Infinity);
    expect(focusForTap(1, 700)).toBe(700);
  });
});

describe("framing the phone's picture for the lens", () => {
  it("cover-fits a 16:9 frame into 3:2 without stretching", async () => {
    const { liveCrop } = await import("./liveMath");
    const { crop } = liveCrop(1920, 1080, 36, 24, 150, 69);
    expect(crop[1]).toBe(1);
    expect(crop[0]).toBeCloseTo(1.5 / (16 / 9), 9);
  });

  it("crops in for a longer lens, keeping the shape", async () => {
    const { liveCrop } = await import("./liveMath");
    const wide = liveCrop(1920, 1080, 36, 24, 60, 69);
    const tele = liveCrop(1920, 1080, 36, 24, 20, 69);
    expect(tele.crop[0]).toBeLessThan(wide.crop[0]);
    expect(tele.crop[0] / tele.crop[1]).toBeCloseTo(wide.crop[0] / wide.crop[1], 9);
  });

  it("says when the lens sees more than the phone", async () => {
    const { liveCrop } = await import("./liveMath");
    expect(liveCrop(1920, 1080, 36, 24, 90, 69).wider).toBe(true);
    expect(liveCrop(1920, 1080, 36, 24, 20, 69).wider).toBe(false);
  });
});

describe("noise", () => {
  it("grows with ISO above base, film grainier than sensor noise", () => {
    expect(noiseFor(3200, 100, false)).toBeGreaterThan(noiseFor(400, 100, false));
    expect(noiseFor(50, 100, false)).toBe(noiseFor(100, 100, false));
    expect(noiseFor(400, 400, true)).toBeGreaterThan(noiseFor(400, 400, false));
  });
});
