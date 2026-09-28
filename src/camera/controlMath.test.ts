import { describe, expect, it } from "vitest";
import { EV_STEPS, evLabel, focusToRing, ringToFocus } from "./controlMath";

describe("focus ring", () => {
  it("runs from the closest distance to infinity, linear in 1/distance", () => {
    expect(focusToRing(700, 700)).toBe(0);
    expect(focusToRing(Infinity, 700)).toBe(1);
    expect(focusToRing(1400, 700)).toBeCloseTo(0.5, 9);
    expect(ringToFocus(0.5, 700)).toBeCloseTo(1400, 9);
    expect(ringToFocus(1, 700)).toBe(Infinity);
  });

  it("round-trips and never goes closer than the lens focuses", () => {
    for (const mm of [700, 900, 2000, 5000, 20000]) expect(ringToFocus(focusToRing(mm, 700), 700)).toBeCloseTo(mm, 6);
    expect(focusToRing(300, 700)).toBe(0);
  });
});

describe("thumb wheel", () => {
  it("steps in thirds from −3 to +3 with a zero", () => {
    expect(EV_STEPS).toHaveLength(19);
    expect(EV_STEPS[0]).toBe(-3);
    expect(EV_STEPS[18]).toBe(3);
    expect(EV_STEPS).toContain(0);
  });

  it("labels like the camera", () => {
    expect(evLabel(0)).toBe("±0");
    expect(evLabel(1 / 3)).toBe("+⅓");
    expect(evLabel(-2 / 3)).toBe("−⅔");
    expect(evLabel(4 / 3)).toBe("+1⅓");
    expect(evLabel(-2)).toBe("−2");
  });
});
