import { describe, expect, it } from "vitest";
import { irisBlades, irisCorners, openRadius, type Point } from "./irisGeometry";

function inside(p: Point, poly: Point[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe("transition iris", () => {
  it("opening corners sit on the circumradius", () => {
    const c = irisCorners(9, 10, 0.3);
    expect(c).toHaveLength(9);
    for (const [x, y] of c) expect(Math.hypot(x, y)).toBeCloseTo(10 / Math.cos(Math.PI / 9));
  });

  it("the blades tile everything outside the opening, once", () => {
    for (const n of [6, 9, 11]) {
      const r = 20;
      const blades = irisBlades(n, r, 0.4, 500);
      for (let i = 0; i < 400; i++) {
        const a = i * 2.39996;
        const d = 25 + (i % 40) * 3;
        const p: Point = [Math.cos(a) * d, Math.sin(a) * d];
        expect(blades.filter((b) => inside(p, b)).length).toBe(1);
      }
      // Well inside the opening: no blade.
      expect(blades.some((b) => inside([3, -4], b))).toBe(false);
    }
  });

  it("closed, the blades meet in the centre", () => {
    const blades = irisBlades(8, 0, 1, 100);
    expect(blades.filter((b) => inside([0.5, 0.2], b)).length).toBe(1);
  });

  it("open, nothing on screen is covered", () => {
    const [w, h] = [390, 844];
    const blades = irisBlades(9, openRadius(w, h), 0, 4000, w / 2, h / 2);
    for (const p of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2]] as Point[]) expect(blades.some((b) => inside(p, b))).toBe(false);
  });
});
