import { describe, expect, it } from "vitest";
import { findBody, findLens, apertureStops } from "../data/gear";
import { computeShot } from "./model";
import { backgroundLook, explainShot } from "./explainShot";

const fmt = (mm: number) => (Number.isFinite(mm) ? `${(mm / 1000).toFixed(2)} m` : "∞");
const shot = (fNumber: number, focusMm: number, subjectMm = focusMm, backgroundOffsetMm = 8000) =>
  computeShot({ body: findBody("m11"), lens: findLens("m-50-1.4"), fNumber, focusMm, subjectMm, backgroundOffsetMm, megapixels: null, cropFocalMm: null, standard: "engraved" });
const stops = apertureStops(findLens("m-50-1.4"));

describe("background look", () => {
  it("bands by circles of confusion", () => {
    expect(backgroundLook(0.8)).toBe("sharp");
    expect(backgroundLook(2)).toBe("slightly soft");
    expect(backgroundLook(6)).toBe("soft");
    expect(backgroundLook(30)).toBe("very soft");
  });
});

describe("reading a shot", () => {
  it("states the sharp zone from the depth of field", () => {
    const s = shot(1.4, 2000);
    const r = explainShot(s, stops, fmt);
    expect(r.zone).toContain(fmt(s.dof.nearMm));
    expect(r.zone).toContain(fmt(s.dof.farMm));
    expect(r.subject).toMatch(/inside/);
  });

  it("wide open with a far background: suggests the aperture that makes it readable, which really does", () => {
    const s = shot(1.4, 2000);
    const r = explainShot(s, stops, fmt);
    expect(r.look).toBe("very soft");
    const n = r.suggestion.action?.fNumber;
    expect(n).toBeGreaterThan(1.4);
    const after = explainShot(shot(n!, 2000), stops, fmt);
    expect(after.backgroundRatio).toBeLessThanOrEqual(3);
    // …and it's the widest such stop.
    const before = stops[stops.indexOf(n!) - 1];
    expect(explainShot(shot(before, 2000), stops, fmt).backgroundRatio).toBeGreaterThan(3);
  });

  it("subject out of focus: the suggestion is to focus on it", () => {
    const r = explainShot(shot(1.4, 1000, 3000), stops, fmt);
    expect(r.subject).toMatch(/outside it, behind/);
    expect(r.suggestion.action?.focusMm).toBe(3000);
  });

  it("background already sharp: suggests opening up for separation", () => {
    const r = explainShot(shot(16, 5000, 5000, 2000), stops, fmt);
    expect(["sharp", "slightly soft"]).toContain(r.look);
    expect(r.suggestion.action?.fNumber).toBe(stops[0]);
  });

  it("says infinity when the zone reaches it", () => {
    const s = shot(16, 6000);
    expect(explainShot(s, stops, fmt).zone).toMatch(/to infinity/);
  });
});
