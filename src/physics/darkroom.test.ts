import { describe, expect, it } from "vitest";
import { FORBIDDEN_ADVICE } from "./rangefinderCalibration";
import { findFilm } from "../preview/film";
import {
  AGITATIONS,
  DEVELOPER_TYPES,
  DILUTIONS,
  FOG,
  REFERENCE_CHOICE,
  colourProcess,
  conceptualResult,
  densityAt,
  describeRecord,
  parseRecord,
} from "./darkroom";

const trix = findFilm("trix400");

describe("conceptual result", () => {
  it("normal development is the reference", () => {
    const r = conceptualResult(trix, REFERENCE_CHOICE, 0);
    expect(r).toMatchObject({ contrast: 1, grain: 1, acutance: 1, highlights: 1, shadowLossStops: 0, timeDirection: "reference", unevenRisk: false });
    expect(r.provenance.kind).toBe("illustrative");
  });

  it("push raises contrast and grain; pull lowers contrast (shared push/pull curve)", () => {
    const push = conceptualResult(trix, { ...REFERENCE_CHOICE, developStops: 2 }, 2);
    const pull = conceptualResult(trix, { ...REFERENCE_CHOICE, developStops: -1 }, -1);
    expect(push.contrast).toBeGreaterThan(1);
    expect(push.grain).toBeGreaterThan(1);
    expect(pull.contrast).toBeLessThan(1);
  });

  it("pushing never recovers shadow detail lost to underexposure", () => {
    expect(conceptualResult(trix, { ...REFERENCE_CHOICE, developStops: 2 }, 2).shadowLossStops).toBe(2);
    expect(conceptualResult(trix, { ...REFERENCE_CHOICE, developStops: -1 }, -1).shadowLossStops).toBe(0);
  });

  it("directions follow darkroom teaching", () => {
    expect(conceptualResult(trix, { ...REFERENCE_CHOICE, developer: "fine-grain" }, 0).grain).toBeLessThan(1);
    expect(conceptualResult(trix, { ...REFERENCE_CHOICE, developer: "acutance" }, 0).acutance).toBeGreaterThan(1);
    const stand = conceptualResult(trix, { ...REFERENCE_CHOICE, agitation: "minimal", dilution: "1+3" }, 0);
    expect(stand.highlights).toBeLessThan(1);
    expect(stand.unevenRisk).toBe(true);
    expect(conceptualResult(trix, { ...REFERENCE_CHOICE, temperatureC: 24 }, 0).timeDirection).toBe("shorter");
    expect(conceptualResult(trix, { ...REFERENCE_CHOICE, temperatureC: 18 }, 0).timeDirection).toBe("longer");
  });

  it("temperature changes only the time direction, not the conceptual result", () => {
    const a = conceptualResult(trix, REFERENCE_CHOICE, 0);
    const b = conceptualResult(trix, { ...REFERENCE_CHOICE, temperatureC: 24 }, 0);
    expect({ ...b, timeDirection: "reference" }).toEqual(a);
  });
});

describe("characteristic curve (illustrative)", () => {
  const normal = conceptualResult(trix, REFERENCE_CHOICE, 0);
  it("rises monotonically from fog", () => {
    let prev = 0;
    for (let x = -3; x <= 3; x += 0.1) {
      const d = densityAt(x, normal, 0);
      expect(d).toBeGreaterThan(prev);
      expect(d).toBeGreaterThanOrEqual(FOG);
      prev = d;
    }
  });

  it("underexposure shifts shadows down; push steepens the slope", () => {
    expect(densityAt(-1, normal, 2)).toBeLessThan(densityAt(-1, normal, 0));
    const push = conceptualResult(trix, { ...REFERENCE_CHOICE, developStops: 2 }, 2);
    const slope = (r: typeof normal) => densityAt(0.6, r, 0) - densityAt(0.4, r, 0);
    expect(slope(push)).toBeGreaterThan(slope(normal));
  });
});

describe("colour films and wording", () => {
  it("colour films use standardised processes", () => {
    expect(colourProcess(findFilm("portra400"))).toBe("C-41");
    expect(colourProcess(findFilm("velvia50"))).toBe("E-6");
    expect(colourProcess(trix)).toBeNull();
  });

  it("gives no hands-on instructions in its notes", () => {
    const text = [...DEVELOPER_TYPES, ...DILUTIONS, ...AGITATIONS].map((x) => x.note).join(" ");
    expect(FORBIDDEN_ADVICE.test(text)).toBe(false);
    expect(/\b\d+(\.\d+)? ?min/.test(text)).toBe(false);
  });
});

describe("roll record", () => {
  it("round-trips and describes itself as conceptual", () => {
    const r = { filmId: "trix400", filmName: "Tri-X 400", frames: 12, choice: { ...REFERENCE_CHOICE, developStops: 1 }, recordedAt: "2026-09-27" };
    expect(parseRecord(JSON.stringify(r))).toEqual(r);
    expect(parseRecord("{bad")).toBeNull();
    expect(describeRecord(r)).toMatch(/Tri-X 400, 12 frames: push \+1 .*\(conceptual\)/);
  });
});
