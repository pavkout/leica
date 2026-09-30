import { describe, expect, it } from "vitest";
import { development, exposureFor, roman, stops, zoneColour, zoneOf } from "./zones";

describe("the Zone System", () => {
  it("places a shadow on Zone III and reads the rest from it", () => {
    // Shadow measures EV 9; placed on III means two stops less than the meter says.
    expect(exposureFor(9, 3)).toBe(11);
    expect(zoneOf(14, 9, 3)).toBe(8);
    expect(roman(zoneOf(14, 9, 3))).toBe("VIII");
    expect(exposureFor(12, 5)).toBe(12); // Placing on V is just the meter reading.
  });
  it("advises development from the highlights", () => {
    expect(development(8)).toBe("N");
    expect(development(9.2)).toBe("N-1");
    expect(development(11)).toBe("N-2");
    expect(development(7)).toBe("N+1");
    expect(development(4)).toBe("N+2");
  });
  it("draws a zone map with clipped ends marked", () => {
    expect(zoneColour(0.18, 0.18, 5)).toEqual(zoneColour(0.18, 0.18, 5));
    expect(zoneColour(0.001, 0.18, 5)).toEqual([30, 60, 200]);
    expect(zoneColour(10, 0.18, 5)).toEqual([220, 40, 30]);
    expect(stops(0.36, 0.18)).toBeCloseTo(1);
    const [a] = zoneColour(0.09, 0.18, 5);
    const [b] = zoneColour(0.36, 0.18, 5);
    expect(a).toBeLessThan(b);
  });
});
