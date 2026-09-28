import { describe, expect, it } from "vitest";
import { findFilm } from "../preview/film";
import { DATASHEET_TIMES, datasheetOptions, datasheetTime } from "./processTimes";

describe("datasheet development times", () => {
  it("every entry is cited and plausible", () => {
    expect(DATASHEET_TIMES.length).toBeGreaterThan(150);
    for (const t of DATASHEET_TIMES) {
      expect(t.source.length).toBeGreaterThan(10);
      expect(t.url).toMatch(/^https:\/\//);
      expect(t.minutes).toBeGreaterThan(2);
      expect(t.minutes).toBeLessThan(30);
      expect([18, 20, 21, 22, 24]).toContain(t.temperatureC);
      expect(findFilm(t.filmId).kind).toBe("bw");
    }
  });

  it("has no duplicate combinations", () => {
    const keys = DATASHEET_TIMES.map((t) => `${t.filmId}|${t.developer}|${t.dilution}|${t.temperatureC}|${t.ei}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("matches spot checks read from the sources", () => {
    // Kodak F-4017 p. 3: TRI-X 400, D-76 stock, small tank, 20 °C: 6 3/4 min.
    expect(datasheetTime("trix400", "Kodak D-76", "stock", 20, 0)?.minutes).toBe(6.75);
    // p. 5: EI 1600, XTOL 1:1, 22 °C: 11 1/2.
    expect(datasheetTime("trix400", "Kodak XTOL", "1:1", 22, 2)?.minutes).toBe(11.5);
    // p. 5: EI 3200, T-MAX: not recommended except at 24 °C (8 1/4).
    expect(datasheetTime("trix400", "Kodak T-MAX", "stock", 20, 3)).toBeNull();
    expect(datasheetTime("trix400", "Kodak T-MAX", "stock", 24, 3)?.minutes).toBe(8.25);
    // Ilford HP5 PLUS (Nov 2018): ID-11 stock EI 800: 10 1/2; DD-X EI 3200: 20.
    expect(datasheetTime("hp5", "ID-11", "stock", 20, 1)?.minutes).toBe(10.5);
    expect(datasheetTime("hp5", "ILFOTEC DD-X", "1+4", 20, 3)?.minutes).toBe(20);
    // Ilford DELTA 3200 (Jun 2025): MICROPHEN stock EI 3200 20 °C: 9; 24 °C: 7.
    expect(datasheetTime("delta3200", "MICROPHEN", "stock", 20, 0)?.minutes).toBe(9);
    expect(datasheetTime("delta3200", "MICROPHEN", "stock", 24, 0)?.minutes).toBe(7);
  });

  it("carries the sources' own notes", () => {
    expect(datasheetTime("trix400", "Kodak D-76", "stock", 20, 1)?.note).toMatch(/one stop under/);
    expect(datasheetTime("trix400", "Kodak HC-110", "dilution B", 20, 0)?.note).toMatch(/shorter than 5 minutes/);
  });

  it("gives nothing for a combination the datasheet doesn't list (acceptance)", () => {
    expect(datasheetTime("hp5", "Kodak D-76", "stock", 24, 0)).toBeNull();
    expect(datasheetTime("hp5", "ID-11", "1+3", 20, 2)).toBeNull();
    expect(datasheetTime("portra400", "Kodak D-76", "stock", 20, 0)).toBeNull();
  });

  it("offers each film's own developers, dilutions and temperatures", () => {
    const o = datasheetOptions("trix400");
    expect(o.developers).toContain("Kodak XTOL");
    expect(o.dilutions("Kodak XTOL")).toEqual(["stock", "1:1"]);
    expect(o.temps("Kodak D-76", "stock")).toEqual([18, 20, 21, 22, 24]);
    expect(datasheetOptions("hp5").temps("ID-11", "stock")).toEqual([20]);
  });
});
