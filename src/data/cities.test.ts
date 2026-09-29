import { describe, expect, it } from "vitest";
import { CITIES, distanceKm, formatCoords, nearestCity } from "./cities";

describe("cities", () => {
  it("has unique ids and valid coordinates", () => {
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length);
    for (const c of CITIES) {
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lon)).toBeLessThanOrEqual(180);
      expect(() => new Intl.DateTimeFormat("en", { timeZone: c.tz })).not.toThrow();
    }
  });

  it("measures distance on the globe", () => {
    // Athens to Thessaloniki is about 300 km in a straight line.
    expect(distanceKm(37.98, 23.73, 40.64, 22.94)).toBeGreaterThan(290);
    expect(distanceKm(37.98, 23.73, 40.64, 22.94)).toBeLessThan(310);
  });

  it("names a position by the nearest city", () => {
    expect(nearestCity(38.02, 23.8).city.id).toBe("athens");
    expect(nearestCity(40.6, 22.9).city.id).toBe("thessaloniki");
  });

  it("formats coordinates with hemispheres", () => {
    expect(formatCoords(37.98, 23.73)).toBe("37.98° N, 23.73° E");
    expect(formatCoords(-33.87, -58.38)).toBe("33.87° S, 58.38° W");
  });
});
