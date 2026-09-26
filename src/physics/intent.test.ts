import { describe, expect, it } from "vitest";
import { solveIntent } from "./intent";

const apertures = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const shutters = [1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000];
// A dim interior/evening scene: realistic for "shoot wide open" without needing
// a faster shutter than any real camera has (bright sun at f/1.4 genuinely
// needs an ND filter — that's not a solver bug, it's why ND filters exist).
const base = { sceneEv100: 9, iso: 400, apertures, shutters, focalMm: 50 };

describe("shallow-background", () => {
  it("picks the widest aperture and a correctly exposed shutter", () => {
    const { primary } = solveIntent("shallow-background", base);
    expect(primary.fNumber).toBe(1.4);
    expect(Math.abs(primary.errorStops)).toBeLessThan(1 / 3);
    expect(primary.compromised).toBe(false);
  });

  it("offers alternatives one/two stops down", () => {
    const { alternatives } = solveIntent("shallow-background", base);
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.every((a) => a.fNumber > 1.4)).toBe(true);
  });
});

describe("maximum-depth", () => {
  it("picks the narrowest aperture that stays handheld-safe (shutter <= 1/focalMm)", () => {
    const { primary } = solveIntent("maximum-depth", { ...base, sceneEv100: 15 });
    expect(primary.shutterSec).toBeLessThanOrEqual(1 / 50);
    expect(primary.compromised).toBe(false);
  });

  it("falls back to the narrowest aperture and flags a compromise in very low light", () => {
    const { primary } = solveIntent("maximum-depth", { ...base, sceneEv100: 2 });
    expect(primary.fNumber).toBe(16);
    expect(primary.reason).toMatch(/tripod/i);
  });

  it("alternatives are near the chosen aperture, not just the two narrowest in the whole list", () => {
    // Regression: alternatives used to be sliced from the raw sorted array,
    // so they were always the two narrowest apertures regardless of which
    // one was actually chosen.
    const { primary, alternatives } = solveIntent("maximum-depth", { ...base, sceneEv100: 15 });
    const sorted = [...apertures].sort((a, b) => a - b);
    const primaryIndex = sorted.indexOf(primary.fNumber);
    for (const alt of alternatives) {
      expect(Math.abs(sorted.indexOf(alt.fNumber) - primaryIndex)).toBeLessThanOrEqual(2);
    }
  });
});

describe("freeze-motion", () => {
  it("picks the fastest shutter reachable at a correctly exposed aperture", () => {
    const { primary } = solveIntent("freeze-motion", { ...base, sceneEv100: 15 });
    expect(Math.abs(primary.errorStops)).toBeLessThan(1 / 3);
    // Should be meaningfully fast, not the slowest speed in the list.
    expect(primary.shutterSec).toBeLessThanOrEqual(1 / 250);
  });

  it("still returns a usable (if compromised) answer when the light can't support any fast shutter", () => {
    const { primary } = solveIntent("freeze-motion", { ...base, sceneEv100: -2 });
    expect(primary.shutterSec).toBe(Math.min(...shutters));
    expect(primary.compromised).toBe(true);
  });

  it("alternatives are slower than the primary (more exposure margin), not just the fastest speeds in the list", () => {
    // Regression: alternatives used to be sliced from the raw sorted array,
    // so a "slower alternative" label could point at a faster speed than
    // the primary recommendation.
    const { primary, alternatives } = solveIntent("freeze-motion", base);
    expect(alternatives.length).toBeGreaterThan(0);
    for (const alt of alternatives) {
      expect(alt.shutterSec).toBeGreaterThan(primary.shutterSec);
    }
  });
});

describe("street-zone-focus", () => {
  it("picks an aperture near f/8 and suggests the hyperfocal distance", () => {
    const { primary } = solveIntent("street-zone-focus", { ...base, hyperfocalMm: 4200 });
    expect(primary.fNumber).toBe(8);
    expect(primary.focusMm).toBe(4200);
  });

  it("omits focusMm when no hyperfocal distance is given", () => {
    const { primary } = solveIntent("street-zone-focus", base);
    expect(primary.focusMm).toBeUndefined();
  });
});

describe("locking a parameter", () => {
  it("locking aperture adapts the shutter and returns no alternatives", () => {
    const { primary, alternatives } = solveIntent("freeze-motion", { ...base, lock: { kind: "aperture", value: 2.8 } });
    expect(primary.fNumber).toBe(2.8);
    expect(alternatives).toEqual([]);
  });

  it("locking shutter adapts the aperture and returns no alternatives", () => {
    const { primary, alternatives } = solveIntent("shallow-background", { ...base, lock: { kind: "shutter", value: 1 / 500 } });
    expect(primary.shutterSec).toBe(1 / 500);
    expect(alternatives).toEqual([]);
  });

  it("locking still applies to every intent identically, since only one free parameter remains", () => {
    const a = solveIntent("shallow-background", { ...base, lock: { kind: "aperture", value: 5.6 } });
    const b = solveIntent("maximum-depth", { ...base, lock: { kind: "aperture", value: 5.6 } });
    expect(a.primary.shutterSec).toBe(b.primary.shutterSec);
  });

  it("preserves the exposure target when locking, same as the main simulator's exposure equation", () => {
    const { primary } = solveIntent("street-zone-focus", { ...base, lock: { kind: "aperture", value: 4 } });
    expect(Math.abs(primary.errorStops)).toBeLessThan(1 / 3);
  });
});
