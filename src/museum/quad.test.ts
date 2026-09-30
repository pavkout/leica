import { describe, expect, it } from "vitest";
import { applyQuad, quadMatrix3d, rectToQuad, type Pt } from "./quad";

const close = (a: Pt, b: Pt) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

describe("rectangle to quad (perspective text on the info stand)", () => {
  it("maps the rectangle's corners onto the quad's corners", () => {
    const quad: [Pt, Pt, Pt, Pt] = [
      [120, 40],
      [410, 70],
      [400, 390],
      [130, 360],
    ];
    const m = rectToQuad(1000, 1300, quad);
    close(applyQuad(m, 0, 0), quad[0]);
    close(applyQuad(m, 1000, 0), quad[1]);
    close(applyQuad(m, 1000, 1300), quad[2]);
    close(applyQuad(m, 0, 1300), quad[3]);
  });

  it("is a plain scale for an axis-aligned rectangle", () => {
    const m = rectToQuad(100, 50, [
      [10, 20],
      [210, 20],
      [210, 120],
      [10, 120],
    ]);
    expect(m.g).toBeCloseTo(0, 9);
    expect(m.h).toBeCloseTo(0, 9);
    close(applyQuad(m, 50, 25), [110, 70]);
    expect(quadMatrix3d(100, 50, [[0, 0], [100, 0], [100, 50], [0, 50]])).toBe("matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)");
  });
});
