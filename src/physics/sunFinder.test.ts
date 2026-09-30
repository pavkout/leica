import { describe, expect, it } from "vitest";
import { bearingDiff, cloudAt, compassPoint, dayPath, forecastUrl, parseForecast, project, skyFor } from "./sunFinder";

describe("the sun's path", () => {
  it("runs east to west over London on the equinox", () => {
    const path = dayPath(new Date(Date.UTC(2026, 2, 20, 0, 0)), 51.51, -0.13, 15);
    expect(path.length).toBeGreaterThan(40);
    expect(path[0].azimuth).toBeLessThan(100);
    expect(path[path.length - 1].azimuth).toBeGreaterThan(260);
    expect(path.some((p) => p.phase === "golden")).toBe(true);
  });
});

describe("projection", () => {
  it("puts the sun in the middle when the camera points at it", () => {
    expect(project(200, 10, 200, 10, 65, 50)).toEqual({ x: 0, y: 0 });
    const right = project(220, 10, 200, 10, 65, 50)!;
    expect(right.x).toBeGreaterThan(0.5);
    expect(project(20, 10, 200, 10, 65, 50)).toBeNull();
    expect(bearingDiff(10, 350)).toBe(20);
    expect(bearingDiff(350, 10)).toBe(-20);
  });
  it("draws the compass with north up and the horizon on the rim", () => {
    const e = compassPoint(90, 0);
    expect(e.x).toBeCloseTo(1);
    expect(e.y).toBeCloseTo(0);
    expect(compassPoint(0, 90).x).toBeCloseTo(0);
  });
});

describe("clouds", () => {
  it("reads the sky in plain terms", () => {
    expect(skyFor(10, 5, 5)).toBe("clear");
    expect(skyFor(50, 10, 40)).toBe("someHigh");
    expect(skyFor(95, 30, 60)).toBe("overcast");
    expect(skyFor(80, 75, 0)).toBe("lowCloud");
    expect(skyFor(60, 50, 10)).toBe("broken");
  });
  it("parses the forecast and finds the nearest hour", () => {
    const list = parseForecast({ hourly: { time: ["2026-09-30T17:00", "2026-09-30T18:00"], cloud_cover: [40, 60], cloud_cover_low: [5, 10], cloud_cover_high: [30, 50] } });
    expect(list).toHaveLength(2);
    expect(cloudAt(list, new Date(Date.UTC(2026, 8, 30, 17, 40)))?.total).toBe(60);
    expect(cloudAt(list, new Date(Date.UTC(2026, 9, 5)))).toBeNull();
    expect(parseForecast({ nope: 1 })).toEqual([]);
    expect(forecastUrl(51.51234, -0.12789)).toContain("latitude=51.51&longitude=-0.13");
  });
});
