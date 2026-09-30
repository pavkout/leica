import { describe, expect, it } from "vitest";
import { addPoint, locate, positionAt, type TrackPoint } from "./track";

const t0 = Date.UTC(2026, 8, 30, 10, 0);
const min = 60_000;
const pts: TrackPoint[] = [
  { t: t0, lat: 38.7, lon: -9.14 },
  { t: t0 + 10 * min, lat: 38.71, lon: -9.13 },
  { t: t0 + 60 * min, lat: 38.8, lon: -9.0 },
];

describe("routes", () => {
  it("interpolates between close fixes", () => {
    const p = positionAt(pts, t0 + 5 * min)!;
    expect(p.lat).toBeCloseTo(38.705, 5);
    expect(p.lon).toBeCloseTo(-9.135, 5);
  });
  it("uses an end fix near the ends, and gives up far from any", () => {
    expect(positionAt(pts, t0 - 3 * min)).toEqual({ lat: 38.7, lon: -9.14 });
    expect(positionAt(pts, t0 - 30 * min)).toBeNull();
    expect(positionAt(pts, t0 + 64 * min)).toEqual({ lat: 38.8, lon: -9.0 });
    // Inside the 50-minute gap: near its start only.
    expect(positionAt(pts, t0 + 12 * min)).toEqual({ lat: 38.71, lon: -9.13 });
    expect(positionAt(pts, t0 + 35 * min)).toBeNull();
    expect(positionAt([], t0)).toBeNull();
  });
  it("thins fixes and drops poor ones", () => {
    let p: TrackPoint[] = [];
    p = addPoint(p, { t: t0, lat: 38.7, lon: -9.14 });
    p = addPoint(p, { t: t0 + 5000, lat: 38.70001, lon: -9.14 });
    p = addPoint(p, { t: t0 + 6000, lat: 38.701, lon: -9.14, acc: 500 });
    p = addPoint(p, { t: t0 + 7000, lat: 38.701, lon: -9.14 });
    expect(p).toHaveLength(2);
  });
  it("finds the route that covers a time", () => {
    const tracks = [
      { id: "a", startedAt: t0 - 100 * min, points: [{ t: t0 - 100 * min, lat: 1, lon: 1 }] },
      { id: "b", startedAt: t0, points: pts },
    ];
    expect(locate(tracks, t0 + 5 * min)?.lat).toBeCloseTo(38.705, 5);
  });
});
