import { describe, expect, it } from "vitest";
import { analyseFocus, smooth } from "./focusCheck";

/** A synthetic photo: fine detail (sharp) in one band of rows, flat grey (blurred) elsewhere. */
function photo(w: number, h: number, sharpFrom: number, sharpTo: number) {
  const g = new Float32Array(w * h).fill(0.5);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = Math.floor(h * sharpFrom); y < Math.floor(h * sharpTo); y++) for (let x = 0; x < w; x++) g[y * w + x] = rnd();
  return g;
}

describe("rangefinder focus check", () => {
  it("finds the sharp band and calls it on target when it's at the mark", () => {
    const r = analyseFocus(photo(200, 200, 0.45, 0.55), 200, 200, 0.5);
    expect(r.verdict).toBe("on");
    expect(r.peak).toBeGreaterThan(0.44);
    expect(r.peak).toBeLessThan(0.56);
    expect(r.confidence).toBeGreaterThan(2);
  });

  it("calls a peak lower in the frame (nearer) front focus", () => {
    expect(analyseFocus(photo(200, 200, 0.62, 0.72), 200, 200, 0.5).verdict).toBe("front");
  });

  it("calls a peak higher in the frame (farther) back focus", () => {
    expect(analyseFocus(photo(200, 200, 0.28, 0.38), 200, 200, 0.5).verdict).toBe("back");
  });

  it("smooths without changing the average level", () => {
    const s = smooth(new Float32Array([1, 1, 1, 1]), 1);
    expect(Array.from(s)).toEqual([1, 1, 1, 1]);
  });
});
