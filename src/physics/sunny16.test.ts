import { describe, expect, it } from "vitest";
import { LIGHT_CONDITIONS, TOLERANCE_STOPS, equivalentCombos, pickCondition, scoreGuess } from "./sunny16";

describe("pickCondition", () => {
  it("is deterministic for a given random source (seeded)", () => {
    expect(pickCondition(() => 0)).toBe(LIGHT_CONDITIONS[0]);
    expect(pickCondition(() => 0.999)).toBe(LIGHT_CONDITIONS[LIGHT_CONDITIONS.length - 1]);
  });

  it("never indexes out of bounds at the top edge (random() can return exactly the values below 1)", () => {
    for (let i = 0; i < 20; i++) {
      const condition = pickCondition(() => i / 20);
      expect(LIGHT_CONDITIONS).toContain(condition);
    }
  });
});

describe("scoreGuess", () => {
  it("is correct for the textbook Sunny 16 answer: f/16 at the nearest marked speed to 1/ISO", () => {
    // EV100 15 is exactly f/16 @ 1/128s; the nearest marked shutter speed is
    // 1/125, ~0.03 stops off — the everyday "f/16 at 1/ISO" answer.
    const { correct, errorStops } = scoreGuess(15, 16, 1 / 125, 100, "precise");
    expect(correct).toBe(true);
    expect(errorStops).toBeCloseTo(0, 1);
  });

  it("rejects a guess a full stop off, even at relaxed tolerance", () => {
    const { correct } = scoreGuess(15, 16, 1 / 60, 100, "relaxed");
    expect(correct).toBe(false);
  });

  it("accepts a guess within tolerance but rejects the same guess at a tighter tolerance", () => {
    // Shift the exact EV15 shutter (1/128) by 2/3 stop.
    const shifted = (1 / 128) * 2 ** 0.6;
    const precise = scoreGuess(15, 16, shifted, 100, "precise");
    const relaxed = scoreGuess(15, 16, shifted, 100, "relaxed");
    expect(precise.correct).toBe(false);
    expect(relaxed.correct).toBe(true);
  });

  it("accounts for ISO: doubling ISO from the scene's EV100 needs one stop less exposure", () => {
    // At ISO 200, f/16 @ 1/125 (correct for ISO 100) is now ~1 stop over; 1/250 corrects it.
    const over = scoreGuess(15, 16, 1 / 125, 200, "precise");
    const corrected = scoreGuess(15, 16, 1 / 250, 200, "precise");
    expect(over.correct).toBe(false);
    expect(corrected.correct).toBe(true);
  });
});

describe("equivalentCombos", () => {
  const apertures = [8, 11, 16, 22];
  const shutters = [1 / 60, 1 / 125, 1 / 250, 1 / 500];

  it("includes only combos within tolerance, and excludes ones outside it", () => {
    const combos = equivalentCombos(15, 100, "precise", apertures, shutters);
    expect(combos.length).toBeGreaterThan(0);
    for (const { fNumber, shutterSec } of combos) {
      expect(apertures).toContain(fNumber);
      expect(shutters).toContain(shutterSec);
    }
    // f/16 @ 1/125 (correct) should be in the list; f/8 @ 1/125 (2 stops over) should not.
    expect(combos).toContainEqual({ fNumber: 16, shutterSec: 1 / 125 });
    expect(combos).not.toContainEqual({ fNumber: 8, shutterSec: 1 / 125 });
  });

  it("widens with a looser tolerance", () => {
    const precise = equivalentCombos(15, 100, "precise", apertures, shutters);
    const relaxed = equivalentCombos(15, 100, "relaxed", apertures, shutters);
    expect(relaxed.length).toBeGreaterThan(precise.length);
  });
});

describe("TOLERANCE_STOPS", () => {
  it("is ordered tightest to loosest", () => {
    expect(TOLERANCE_STOPS.precise).toBeLessThan(TOLERANCE_STOPS.standard);
    expect(TOLERANCE_STOPS.standard).toBeLessThan(TOLERANCE_STOPS.relaxed);
  });
});
