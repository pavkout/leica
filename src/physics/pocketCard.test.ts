import { describe, expect, it } from "vitest";
import { hyperfocal } from "./optics";
import { pocketCard } from "./pocketCard";

const speeds = [1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000];
const stops = [2, 2.8, 4, 5.6, 8, 11, 16];

describe("pocketCard", () => {
  const card = pocketCard({ focalMm: 35, stops, speeds, iso: 400, cocMm: 0.03 });

  it("zone-focus rows use the DoF engine: near limit is half the hyperfocal", () => {
    const f8 = card.zones.find((z) => z.fNumber === 8)!;
    expect(f8.hyperfocalMm).toBeCloseTo(hyperfocal(35, 8, 0.03));
    expect(f8.nearMm).toBeCloseTo(f8.hyperfocalMm / 2);
    expect(f8.zones.map((z) => z.focusMm)).toEqual([2000, 3000, 5000]);
  });

  it("only lists apertures the lens has", () => {
    const narrow = pocketCard({ focalMm: 50, stops: [2, 2.8, 4, 5.6], speeds, iso: 400, cocMm: 0.03 });
    expect(narrow.zones.map((z) => z.fNumber)).toEqual([5.6]);
  });

  it("gives Sunny 16 in full sun at ISO 400: f/16 at about 1/500", () => {
    const sun = card.light.find((l) => l.id === "sunny16")!;
    expect(sun.fNumber).toBe(16);
    expect(sun.shutterSec).toBe(1 / 500);
  });

  it("opens up in dim light instead of dropping below 1/30", () => {
    const night = card.light.find((l) => l.id === "night-street")!;
    expect(night.fNumber).toBe(2);
  });

  it("keeps dim-light rows hand-holdable where it can, and marks the ones that aren't", () => {
    const tele = pocketCard({ focalMm: 90, stops, speeds, iso: 400, cocMm: 0.03 });
    const sunset = tele.light.find((l) => l.id === "sunset")!;
    expect(sunset.shutterSec).toBeLessThanOrEqual(1 / 125);
    expect(sunset.needsSupport).toBe(false);
    expect(tele.light.find((l) => l.id === "night-street")!.needsSupport).toBe(true);
  });

  it("rounds 1/focal length to the next faster speed on the camera", () => {
    expect(card.slowestHandheldSec).toBe(1 / 60);
  });
});
