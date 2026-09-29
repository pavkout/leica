import { describe, expect, it } from "vitest";
import { findFilms } from "./filmFinder";

describe("film finder", () => {
  it("only offers the kind asked for", () => {
    expect(findFilms({ kind: "bw", light: "mixed", look: "natural" }).every((p) => p.film.mono)).toBe(true);
    expect(findFilms({ kind: "slide", light: "bright", look: "vivid" }).every((p) => p.film.kind === "slide")).toBe(true);
  });

  it("puts a fast film first for low light", () => {
    const top = findFilms({ kind: "any", light: "low", look: "gritty" })[0];
    expect(top.film.iso).toBeGreaterThanOrEqual(800);
  });

  it("favours saturated, fine-grained colour for a vivid look in bright light", () => {
    const top = findFilms({ kind: "colour", light: "bright", look: "vivid" })[0];
    expect(top.film.saturation).toBeGreaterThan(1.1);
    expect(top.film.iso).toBeLessThanOrEqual(200);
  });

  it("prefers a neutral stock over a warm one for a natural look", () => {
    const names = findFilms({ kind: "colour", light: "mixed", look: "natural" }).map((p) => p.film.id);
    expect(names.indexOf("portra400")).toBeLessThan(names.indexOf("gold200"));
  });

  it("explains every pick with at least one reason", () => {
    for (const p of findFilms({ kind: "any", light: "mixed", look: "soft" })) expect(p.reasons.length).toBeGreaterThan(0);
  });
});
