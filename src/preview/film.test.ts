import { describe, expect, it } from "vitest";
import { findBody } from "../data/gear";
import { developedLook, findFilm, grainStrength, lookFor } from "./film";

const m11 = findBody("m11"); // digital, isoRange [64, 50000]
const m11mono = findBody("m11-mono"); // digital mono
const m6 = findBody("m6"); // film

describe("findFilm", () => {
  it("finds a known stock", () => {
    expect(findFilm("trix400").name).toBe("Tri-X 400");
  });

  it("falls back to the first stock for an unknown id", () => {
    expect(findFilm("not-a-real-film")).toBe(findFilm("portra400"));
  });
});

describe("lookFor", () => {
  it("returns the loaded film stock for a film body, ignoring the iso argument", () => {
    const look = lookFor(m6, "trix400", 999999);
    expect(look.id).toBe("trix400");
    expect(look.iso).toBe(400); // the stock's own box speed, not the ignored argument
  });

  it("returns the colour sensor look with the given ISO for a colour digital body", () => {
    const look = lookFor(m11, "portra400", 800);
    expect(look.kind).toBe("digital");
    expect(look.mono).toBe(false);
    expect(look.iso).toBe(800);
  });

  it("returns the mono sensor look for a monochrome digital body", () => {
    const look = lookFor(m11mono, "portra400", 800);
    expect(look.mono).toBe(true);
    expect(look.iso).toBe(800);
  });
});

describe("grainStrength", () => {
  it("is the stock's own grain value for film, regardless of body", () => {
    const look = lookFor(m6, "trix400", 400);
    expect(grainStrength(look, m6)).toBe(look.grain);
  });

  it("grows with ISO above the sensor's base for digital", () => {
    const base = lookFor(m11, "portra400", m11.isoRange![0]);
    const pushed = lookFor(m11, "portra400", m11.isoRange![0] * 4);
    expect(grainStrength(pushed, m11)).toBeGreaterThan(grainStrength(base, m11));
  });
});

describe("developedLook", () => {
  it("is a no-op at 0 stops (normal development)", () => {
    const look = lookFor(m6, "trix400", 400);
    expect(developedLook(look, 0)).toBe(look);
  });

  it("is a no-op for digital sensors regardless of stops", () => {
    const look = lookFor(m11, "portra400", 400);
    expect(developedLook(look, 2)).toBe(look);
  });

  it("steepens contrast (lower softness) and increases grain for a push", () => {
    const look = lookFor(m6, "trix400", 400);
    const pushed = developedLook(look, 2);
    expect(pushed.softness).toBeLessThan(look.softness);
    expect(pushed.grain).toBeGreaterThan(look.grain);
  });

  it("flattens contrast (higher softness) and increases grain for a pull", () => {
    const look = lookFor(m6, "trix400", 400);
    const pulled = developedLook(look, -1);
    expect(pulled.softness).toBeGreaterThan(look.softness);
    expect(pulled.grain).toBeGreaterThan(look.grain);
  });

  it("tags the result as illustrative, not the stock's own approximate provenance", () => {
    const look = lookFor(m6, "trix400", 400);
    expect(developedLook(look, 1).provenance.kind).toBe("illustrative");
  });

  it("leaves the original look object untouched", () => {
    const look = lookFor(m6, "trix400", 400);
    const original = { ...look };
    developedLook(look, 3);
    expect(look).toEqual(original);
  });
});
