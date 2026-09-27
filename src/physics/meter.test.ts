import { describe, expect, it } from "vitest";
import { correctShutter, exposureError } from "./exposure";
import { DEFAULT_PLACEMENT, MID_GREY, equivalents, exposureEv, linearLuminance, meteredEv100, regionLuminance, settingsEv100, srgbToLinear, stabilize, stopsBetween } from "./meter";

function frame(w: number, h: number, fill: (x: number, y: number) => number) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = fill(x, y);
      d.set([v, v, v, 255], (y * w + x) * 4);
    }
  return d;
}

describe("luminance", () => {
  it("linearises sRGB, so sRGB 118 is about middle grey", () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(255)).toBeCloseTo(1);
    expect(linearLuminance(118, 118, 118)).toBeCloseTo(MID_GREY, 1);
  });

  it("averages a region of the frame", () => {
    const d = frame(10, 10, (x) => (x < 5 ? 0 : 255));
    expect(regionLuminance(d, 10, 10, { x: 0, y: 0, w: 0.5, h: 1 })).toBeCloseTo(0);
    expect(regionLuminance(d, 10, 10, { x: 0.5, y: 0, w: 0.5, h: 1 })).toBeCloseTo(1);
    expect(regionLuminance(d, 10, 10)).toBeCloseTo(0.5);
  });

  it("measures within-frame ratios in stops", () => {
    expect(stopsBetween(0.72, 0.18)).toBeCloseTo(2);
  });
});

describe("metering", () => {
  it("computes the EV of a setting (f/8, 1/125, ISO 100 ≈ EV 13)", () => {
    expect(settingsEv100(8, 1 / 125, 100)).toBeCloseTo(12.97, 2);
    expect(settingsEv100(8, 1 / 125, 400)).toBeCloseTo(10.97, 2);
  });

  it("reads the scene at the settings' EV when the frame averages middle grey, and adjusts by brightness", () => {
    expect(meteredEv100(13, MID_GREY)).toBeCloseTo(13);
    expect(meteredEv100(13, MID_GREY * 2)).toBeCloseTo(14);
  });

  it("round-trips with the exposure engine: the recommended setting has zero error", () => {
    const ev = meteredEv100(settingsEv100(2, 1 / 60, 800), 0.1);
    expect(exposureError(ev, 5.6, correctShutter(ev, 5.6, 400), 400)).toBeCloseTo(0);
  });
});

describe("priority modes and bias (preferences, not rules)", () => {
  it("average makes the reading middle grey", () => {
    expect(exposureEv(12, "average")).toBe(12);
  });

  it("highlight priority places the spot 2.5 stops above middle grey; shadow 2 below", () => {
    expect(exposureEv(15, "highlight")).toBe(15 - DEFAULT_PLACEMENT.highlight);
    expect(exposureEv(8, "shadow")).toBe(8 + 2);
    expect(exposureEv(15, "highlight", { highlight: 3, shadow: -2 })).toBe(12);
  });

  it("a +1 film bias gives one stop more exposure", () => {
    expect(exposureEv(12, "average", DEFAULT_PLACEMENT, 1)).toBe(11);
  });
});

describe("stability (acceptance: a static scene doesn't oscillate)", () => {
  it("holds its displayed value through sensor noise", () => {
    let s = { smoothed: null as number | null, shown: null as number | null };
    const shown = new Set<number>();
    for (let i = 0; i < 200; i++) {
      s = stabilize(s, 12 + Math.sin(i * 1.7) * 0.25 + (i % 3 === 0 ? 0.1 : -0.1));
      if (i > 5) shown.add(s.shown!);
    }
    expect(shown.size).toBe(1);
  });

  it("follows a real change in light", () => {
    let s = { smoothed: null as number | null, shown: null as number | null };
    for (let i = 0; i < 20; i++) s = stabilize(s, 12);
    for (let i = 0; i < 40; i++) s = stabilize(s, 15);
    expect(s.shown).toBeCloseTo(15, 0);
  });
});

describe("equivalent exposures", () => {
  const apertures = [2, 2.8, 4, 5.6, 8, 11, 16];
  const speeds = [1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000];

  it("lists each aperture with its nearest marked speed, within half a stop", () => {
    const rows = equivalents(15, 400, apertures, speeds, null);
    expect(rows).toHaveLength(apertures.length);
    for (const r of rows.filter((x) => x.fNumber >= 11)) expect(Math.abs(r.errorStops)).toBeLessThanOrEqual(0.5);
    // f/5.6 would need 1/4000 s; this camera stops at 1/1000, and the row says it's 2 stops over.
    expect(rows.find((r) => r.fNumber === 5.6)!.errorStops).toBeCloseTo(2, 0);
    expect(rows.find((r) => r.fNumber === 16)!.shutterSec).toBe(1 / 500); // sunny 16 at ISO 400
  });

  it("marks the locked aperture", () => {
    const rows = equivalents(15, 400, apertures, speeds, { kind: "aperture", fNumber: 8 });
    expect(rows.filter((r) => r.locked).map((r) => r.fNumber)).toEqual([8]);
  });

  it("with a shutter lock, pairs every aperture with that speed and marks the correct one", () => {
    const rows = equivalents(15, 400, apertures, speeds, { kind: "shutter", shutterSec: 1 / 500 });
    expect(rows.every((r) => r.shutterSec === 1 / 500)).toBe(true);
    expect(rows.filter((r) => r.locked).map((r) => r.fNumber)).toEqual([16]);
  });
});

describe("tap mapping (object-fit: cover)", () => {
  it("maps the element centre to the frame centre", async () => {
    const { coverToFrame } = await import("./meter");
    expect(coverToFrame(200, 300, 400, 600, 1920, 1080)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("accounts for the cropped sides of a landscape frame in a portrait element", async () => {
    const { coverToFrame } = await import("./meter");
    // 1920×1080 scaled to fill 400×600: height fits (scale 0.5556), width 1066.7 px, 333 px cropped each side.
    const left = coverToFrame(0, 300, 400, 600, 1920, 1080);
    expect(left.x).toBeCloseTo(333.33 / 1066.67, 3);
    expect(left.y).toBeCloseTo(0.5);
  });
});
