import { describe, expect, it } from "vitest";
import { phaseAt, sunAltitude, sunDay } from "./sun";

const minutesUtc = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

describe("sun", () => {
  it("puts the sun near the zenith at the equator at an equinox noon", () => {
    // 20 March 2024, solar noon at 0° longitude is about 12:07 UTC.
    expect(sunAltitude(new Date(Date.UTC(2024, 2, 20, 12, 7)), 0, 0)).toBeGreaterThan(88);
  });

  it("finds Amsterdam's midsummer sunrise and sunset to within a few minutes", () => {
    // Published times for 21 June 2024: sunrise 05:18, sunset 22:06 CEST (UTC+2).
    const day = sunDay(new Date(Date.UTC(2024, 5, 20, 22, 0)), 52.37, 4.9);
    expect(Math.abs(minutesUtc(day.sunrise!) - (3 * 60 + 18))).toBeLessThanOrEqual(4);
    expect(Math.abs(minutesUtc(day.sunset!) - (20 * 60 + 6))).toBeLessThanOrEqual(4);
  });

  it("orders a normal day night → blue → golden → day → golden → blue → night", () => {
    const day = sunDay(new Date(Date.UTC(2024, 9, 1, 22, 0)), 52.37, 4.9);
    expect(day.spans.map((s) => s.phase)).toEqual(["night", "blue", "golden", "day", "golden", "blue", "night"]);
  });

  it("has no sunset in a polar summer", () => {
    const day = sunDay(new Date(Date.UTC(2024, 5, 21, 0, 0)), 78.2, 15.6);
    expect(day.sunset).toBeNull();
    expect(day.spans.every((s) => s.phase === "day" || s.phase === "golden")).toBe(true);
  });

  it("classifies altitudes by the photographic conventions", () => {
    expect(phaseAt(-10)).toBe("night");
    expect(phaseAt(-5)).toBe("blue");
    expect(phaseAt(0)).toBe("golden");
    expect(phaseAt(20)).toBe("day");
  });
});

describe("the sun's bearing", () => {
  it("rises in the east, stands south at noon in the north, and sets in the west", async () => {
    const { sunPosition } = await import("./sun");
    // London, the equinox (20 March 2026): about due east at sunrise, due south at solar noon, due west at sunset.
    const lat = 51.51;
    const lon = -0.13;
    const at = (h: number, m = 0) => new Date(Date.UTC(2026, 2, 20, h, m));
    expect(sunPosition(at(6, 5), lat, lon).azimuth).toBeGreaterThan(85);
    expect(sunPosition(at(6, 5), lat, lon).azimuth).toBeLessThan(95);
    const noon = sunPosition(at(12, 8), lat, lon);
    expect(Math.abs(noon.azimuth - 180)).toBeLessThan(3);
    expect(noon.altitude).toBeGreaterThan(37);
    expect(noon.altitude).toBeLessThan(40);
    expect(Math.abs(sunPosition(at(18, 12), lat, lon).azimuth - 270)).toBeLessThan(6);
    // Sydney at noon: the sun is to the north.
    const syd = sunPosition(new Date(Date.UTC(2026, 2, 20, 2, 0)), -33.87, 151.21);
    expect(syd.azimuth < 30 || syd.azimuth > 330).toBe(true);
  });
});
