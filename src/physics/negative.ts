// Negative viewer (#47): turns a phone-camera view of a negative into a
// positive, live. Per colour channel: divide by the film's clear base (which
// removes a colour negative's orange mask), take the density (−log), and
// stretch it between the frame's own darkest and brightest parts. Done as a
// 256-entry lookup table per channel, rebuilt from a histogram, so each
// video frame costs one table lookup per pixel.
//
// A preview for choosing frames, not a scan: the phone's camera, the light
// and the auto levels all shape the colours, and the page says so.

export type NegKind = "colour" | "bw" | "slide";
export type RGB = [number, number, number];
export type Hist = [Uint32Array, Uint32Array, Uint32Array];

/** Per-channel histograms, sampling every `step`-th pixel. */
export function histograms(data: Uint8ClampedArray | Uint8Array, step = 4): Hist {
  const h: Hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < data.length; i += 4 * step) {
    h[0][data[i]]++;
    h[1][data[i + 1]]++;
    h[2][data[i + 2]]++;
  }
  return h;
}

/** The value below which `p` (0–1) of the samples fall. */
export function percentile(hist: Uint32Array, p: number): number {
  let total = 0;
  for (const n of hist) total += n;
  if (!total) return p < 0.5 ? 0 : 255;
  const target = total * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}

/** The clear film base: the brightest part of a backlit negative, per channel. */
export function autoBase(h: Hist): RGB {
  return [percentile(h[0], 0.995), percentile(h[1], 0.995), percentile(h[2], 0.995)].map((v) => Math.max(1, v)) as RGB;
}

const density = (v: number, base: number) => -Math.log10(Math.max(1, Math.min(v, base)) / base);

/**
 * The three lookup tables. `clip` is the share of each end left out of the
 * stretch (so dust and the film edge don't set the levels); `gamma` lifts the
 * mid-tones the way a print would.
 */
export function negativeLuts(h: Hist, kind: NegKind, base: RGB | null, { clip = 0.005, gamma = 2.2 } = {}): [Uint8Array, Uint8Array, Uint8Array] {
  const b = base ?? autoBase(h);
  return [0, 1, 2].map((c) => {
    const lut = new Uint8Array(256);
    if (kind === "slide") {
      const lo = percentile(h[c], clip);
      const hi = Math.max(lo + 1, percentile(h[c], 1 - clip));
      for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * Math.min(1, Math.max(0, (v - lo) / (hi - lo))));
      return lut;
    }
    // Density falls as the input brightens: the densest (darkest) input is the brightest part of the picture.
    const dMin = density(percentile(h[c], 1 - clip), b[c]);
    const dMax = Math.max(dMin + 0.02, density(percentile(h[c], clip), b[c]));
    for (let v = 0; v < 256; v++) {
      const x = Math.min(1, Math.max(0, (density(v, b[c]) - dMin) / (dMax - dMin)));
      lut[v] = Math.round(255 * Math.pow(x, 1 / gamma));
    }
    return lut;
  }) as [Uint8Array, Uint8Array, Uint8Array];
}

/** Applies the tables in place; black-and-white is averaged to grey. */
export function applyLuts(data: Uint8ClampedArray | Uint8Array, luts: [Uint8Array, Uint8Array, Uint8Array], mono: boolean): void {
  const [r, g, b] = luts;
  for (let i = 0; i < data.length; i += 4) {
    if (mono) {
      const y = (r[data[i]] * 77 + g[data[i + 1]] * 150 + b[data[i + 2]] * 29) >> 8;
      data[i] = data[i + 1] = data[i + 2] = y;
    } else {
      data[i] = r[data[i]];
      data[i + 1] = g[data[i + 1]];
      data[i + 2] = b[data[i + 2]];
    }
  }
}

/** The average colour in a small square around a point (the film base the user tapped). */
export function sampleAt(data: Uint8ClampedArray | Uint8Array, width: number, height: number, x: number, y: number, radius = 4): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++)
    for (let xx = Math.max(0, x - radius); xx <= Math.min(width - 1, x + radius); xx++) {
      const i = (yy * width + xx) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  return n ? [Math.max(1, r / n), Math.max(1, g / n), Math.max(1, b / n)] : [255, 255, 255];
}
