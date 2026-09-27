import { describe, expect, it } from "vitest";
import { LENSES, findLens } from "../data/gear";
import { LENS_CHARACTER_PROFILES, lensDNA, naturalVignettingStops, reachableFNumber } from "./lensCharacter";
import { diffractionLimitedFNumber } from "./optics";

const FF = { cocMm: 0.03, frameHalfDiagonalMm: Math.hypot(18, 12) };

describe("natural vignetting", () => {
  it("follows cos⁴ of the corner field angle", () => {
    const theta = Math.atan(Math.hypot(18, 12) / 50);
    expect(naturalVignettingStops(50, Math.hypot(18, 12))).toBeCloseTo(-Math.log2(Math.cos(theta) ** 4), 10);
  });

  it("is about half a stop at 50 mm and about two stops at 21 mm on full frame", () => {
    expect(naturalVignettingStops(50, Math.hypot(18, 12))).toBeCloseTo(0.5, 1);
    expect(naturalVignettingStops(21, Math.hypot(18, 12))).toBeCloseTo(2.08, 1);
  });
});

describe("Lens DNA rows", () => {
  it("renders for every lens from geometric specs alone", () => {
    for (const lens of LENSES) {
      const rows = lensDNA(lens, { ...FF, fNumber: lens.maxAperture });
      expect(rows.map((r) => r.key)).toEqual(["minFocus", "apertures", "bokeh", "naturalVignetting", "mechanicalVignetting", "diffraction", "sharpness", "distortion", "flare", "notes"]);
    }
  });

  it("never presents a value without a provenance, and shows no value where there's no data", () => {
    for (const lens of LENSES) {
      for (const row of lensDNA(lens, { ...FF, fNumber: 4 })) {
        expect(row.provenance).toBeTruthy();
        if (row.provenance === "none") expect(row.value).toBeNull();
        else expect(row.value).not.toBeNull();
        expect(row.note.length).toBeGreaterThan(0);
      }
    }
  });

  it("doesn't label anything as measured without a sourced profile", () => {
    expect(Object.keys(LENS_CHARACTER_PROFILES)).toEqual([]);
    for (const lens of LENSES) expect(lensDNA(lens, { ...FF, fNumber: 2 }).some((r) => r.provenance === "measured")).toBe(false);
  });

  it("uses a published blade count when there is one, and says generic otherwise", () => {
    const apo = findLens("m-50-2-apo");
    expect(lensDNA(apo, { ...FF, fNumber: 2 }).find((r) => r.key === "bokeh")).toMatchObject({ provenance: "published", detail: 11 });
    const generic = LENSES.find((l) => l.apertureBlades === undefined)!;
    expect(lensDNA(generic, { ...FF, fNumber: 4 }).find((r) => r.key === "bokeh")).toMatchObject({ provenance: "approximate", detail: 9 });
  });

  it("takes diffraction from the shared engine and the current sharpness standard", () => {
    const row = lensDNA(findLens("m-50-1.4"), { ...FF, cocMm: 0.0075, fNumber: 2 }).find((r) => r.key === "diffraction")!;
    expect(row.value).toBeCloseTo(diffractionLimitedFNumber(0.0075));
  });

  it("uses sourced profile data when present, with its source", () => {
    const rows = lensDNA(findLens("m-50-1.4"), { ...FF, fNumber: 2 }, { distortionPct: { value: -1.2, provenance: "measured", source: "Test source" } });
    expect(rows.find((r) => r.key === "distortion")).toMatchObject({ value: -1.2, provenance: "measured", note: "Test source" });
  });

  it("shows a catalogue nickname as a community note, not an objective claim", () => {
    const king = LENSES.find((l) => l.nickname === "King of bokeh")!;
    expect(lensDNA(king, { ...FF, fNumber: 2 }).find((r) => r.key === "notes")).toMatchObject({ value: "King of bokeh", provenance: "community" });
  });
});

describe("comparison", () => {
  it("clamps to what each lens can reach", () => {
    const f2 = findLens("m-35-2");
    expect(reachableFNumber(f2, 1.4)).toBe(2);
    expect(reachableFNumber(f2, 4)).toBe(4);
    expect(reachableFNumber(f2, 32)).toBe(f2.minAperture);
  });
});

describe("preview vignetting heuristic", () => {
  it("is strongest wide open on fast lenses, gone 3 stops down, and mostly corrected on digital", async () => {
    const { vignetteStops } = await import("./lensCharacter");
    const lux = findLens("m-50-1.4");
    expect(vignetteStops(lux, 1.4, false)).toBeCloseTo(1.6);
    expect(vignetteStops(lux, 4, false)).toBeCloseTo(0);
    expect(vignetteStops(lux, 1.4, true)).toBeCloseTo(1.6 * 0.35);
  });
});
