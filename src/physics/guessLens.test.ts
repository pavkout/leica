import { describe, expect, it } from "vitest";
import { LENSES, findBody, lensesForBody } from "../data/gear";
import { apertureBand, makeRound, scoreGuess } from "./guessLens";

/** A small deterministic random, so rounds are reproducible. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const lenses = lensesForBody(findBody("m11"));

describe("guess the lens", () => {
  it("bands apertures the way they look", () => {
    expect(apertureBand(1.4)).toBe("wide");
    expect(apertureBand(2.8)).toBe("wide");
    expect(apertureBand(5.6)).toBe("middle");
    expect(apertureBand(8)).toBe("stopped");
  });

  it("makes rounds with a real lens, a stop it can set and the answer among the choices", () => {
    const random = seeded(7);
    for (let i = 0; i < 50; i++) {
      const r = makeRound(lenses, ["amsterdam-sun"], random)!;
      const lens = LENSES.find((l) => l.id === r.lensId)!;
      expect(lens.focalMm).toBe(r.focalMm);
      expect(r.fNumber).toBeGreaterThanOrEqual(lens.maxAperture - 1e-6);
      expect(r.fNumber).toBeLessThanOrEqual(lens.minAperture + 1e-6);
      expect(r.focalChoices).toContain(r.focalMm);
      expect(r.focalChoices.length).toBeLessThanOrEqual(4);
      // Wide lenses only on the illustrated street, which renders any angle.
      if (r.focalMm < 35) expect(r.sceneId).toBe("street");
    }
  });

  it("needs at least two focal lengths to be a game", () => {
    expect(makeRound(lenses.slice(0, 1), [])).toBeNull();
  });

  it("scores focal length and aperture separately", () => {
    const r = { lensId: "x", focalMm: 50, fNumber: 1.4, sceneId: "street", focalChoices: [35, 50, 75] };
    expect(scoreGuess(r, 50, "wide")).toEqual({ focal: true, aperture: true, points: 2 });
    expect(scoreGuess(r, 35, "wide").points).toBe(1);
    expect(scoreGuess(r, 35, "stopped").points).toBe(0);
  });
});
