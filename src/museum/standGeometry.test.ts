import { describe, expect, it } from "vitest";
import { STAND, project, standShapes } from "./standGeometry";

describe("display stand geometry", () => {
  it("shows the same step on every side of the frame tier", () => {
    const [front, side, back] = standShapes().gaps;
    expect(front).toBeCloseTo(STAND.gap, 5);
    // Sides are measured at the tier's front edge, where the far-edge narrowing has just begun.
    expect(Math.abs(side - STAND.gap)).toBeLessThan(1);
    expect(back).toBeCloseTo(STAND.gap, 5);
  });

  it("narrows toward the back, like a box seen from the front", () => {
    const [fl] = project(0, 0);
    const [bl] = project(0, STAND.depth);
    expect(bl).toBeGreaterThan(fl);
  });

  it("keeps the leather inside the tier, and the stand inside its view box", () => {
    const g = standShapes();
    expect(g.leatherBack).toBeGreaterThan(0);
    expect(g.leatherFront).toBeGreaterThan(g.leatherBack);
    const [, minY, , h] = g.viewBox.split(" ").map(Number);
    expect(minY + h).toBeCloseTo(STAND.bottom, 5);
    expect(g.frontMiddle).toBeGreaterThan(0.5);
    expect(g.frontMiddle).toBeLessThan(1);
  });
});

describe("3D stand crop", () => {
  it("crops tight around the projected corners, padded and clamped", async () => {
    const { cropBox } = await import("./stand3d");
    expect(cropBox([[100, 50], [300, 120]], 10, 1000, 1000)).toEqual({ x: 90, y: 40, w: 220, h: 90 });
    expect(cropBox([[2, 2], [998, 30]], 10, 1000, 1000)).toEqual({ x: 0, y: 0, w: 1000, h: 40 });
  });
});
