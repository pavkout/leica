import { describe, expect, it } from "vitest";
import { applyLuts, autoBase, histograms, negativeLuts, percentile, sampleAt, type RGB } from "./negative";

/** A colour negative strip: an orange base, and a grey scale printed through it (denser = brighter scene). */
function negative(): Uint8Array {
  const base: RGB = [230, 150, 90];
  const px: number[] = [];
  for (let i = 0; i < 64; i++) {
    // 0 = clear base (a black scene), 63 = densest (a white scene), same density in every channel.
    const t = Math.pow(10, -(i / 63) * 1.2);
    px.push(base[0] * t, base[1] * t, base[2] * t, 255);
  }
  // Some clear border too, as the film edge.
  for (let i = 0; i < 8; i++) px.push(...base, 255);
  return Uint8Array.from(px.map(Math.round));
}

describe("the negative viewer", () => {
  it("finds the film base as the brightest part", () => {
    const h = histograms(negative(), 1);
    const b = autoBase(h);
    expect(b[0]).toBeGreaterThan(220);
    expect(b[2]).toBeLessThan(100);
  });
  it("turns an orange-masked grey scale into a neutral positive, black to white", () => {
    const data = negative();
    const h = histograms(data, 1);
    applyLuts(data, negativeLuts(h, "colour", null), false);
    const clear = [data[0], data[1], data[2]];
    const densest = [data[63 * 4], data[63 * 4 + 1], data[63 * 4 + 2]];
    const mid = [data[32 * 4], data[32 * 4 + 1], data[32 * 4 + 2]];
    expect(Math.max(...clear)).toBeLessThan(10); // The clear base is black in the positive.
    expect(Math.min(...densest)).toBeGreaterThan(240);
    // The orange mask is gone: the mid grey is near neutral.
    expect(Math.max(...mid) - Math.min(...mid)).toBeLessThan(16);
    // And tones run the right way.
    expect(data[16 * 4 + 1]).toBeLessThan(data[48 * 4 + 1]);
  });
  it("uses a tapped base, averages black and white to grey, and leaves slides the right way round", () => {
    const data = negative();
    const base = sampleAt(data, 72, 1, 68, 0, 2);
    expect(base[0]).toBeCloseTo(230, 0);
    const h = histograms(data, 1);
    const bw = Uint8Array.from(data);
    applyLuts(bw, negativeLuts(h, "bw", base), true);
    expect(bw[32 * 4]).toBe(bw[32 * 4 + 1]);
    const slide = Uint8Array.from(data);
    applyLuts(slide, negativeLuts(h, "slide", null), false);
    expect(slide[0]).toBeGreaterThan(slide[63 * 4]);
  });
  it("handles an empty histogram", () => {
    const h = histograms(new Uint8Array(0));
    expect(percentile(h[0], 0.1)).toBe(0);
    expect(percentile(h[0], 0.9)).toBe(255);
  });
});
