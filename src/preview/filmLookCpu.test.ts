import { describe, expect, it } from "vitest";
import { FILM_STOCKS } from "./film";
import { applyFilmLook, filmTone } from "./filmLookCpu";

const look = (id: string) => FILM_STOCKS.find((f) => f.id === id)!;

function grey(v: number, n = 16): Uint8ClampedArray {
  const d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) d.set([v, v, v, 255], i * 4);
  return d;
}

describe("film looks on your photo", () => {
  it("follows the shader's curve: mid grey maps through tanh of the bias", () => {
    const l = look("hp5");
    expect(filmTone(0.18, l)).toBeCloseTo(0.5 + 0.5 * Math.tanh(l.bias / l.softness), 6);
    expect(filmTone(1, l)).toBeGreaterThan(filmTone(0.18, l));
  });
  it("turns black-and-white films grey, and keeps tones in order", () => {
    const d = new Uint8ClampedArray([200, 40, 40, 255, 40, 200, 40, 255, 30, 30, 30, 255, 220, 220, 220, 255]);
    applyFilmLook(d, 4, 1, look("trix400"), { grain: false });
    expect(d[0]).toBe(d[1]);
    expect(d[4]).toBe(d[6]);
    expect(d[8]).toBeLessThan(d[12]);
  });
  it("brightens with overexposure and adds grain only when asked", () => {
    const a = grey(118);
    const b = grey(118);
    applyFilmLook(a, 4, 4, look("portra400"), { grain: false });
    applyFilmLook(b, 4, 4, look("portra400"), { grain: false, exposureStops: 1 });
    expect(b[1]).toBeGreaterThan(a[1]);
    const flat = grey(118, 64);
    applyFilmLook(flat, 8, 8, look("delta3200"), { grain: true });
    const values = new Set<number>();
    for (let i = 0; i < flat.length; i += 4) values.add(flat[i]);
    expect(values.size).toBeGreaterThan(1);
    const again = grey(118, 64);
    applyFilmLook(again, 8, 8, look("delta3200"), { grain: true });
    expect([...again]).toEqual([...flat]); // Deterministic, so a comparison doesn't flicker.
  });
});
