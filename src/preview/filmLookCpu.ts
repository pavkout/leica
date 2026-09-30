// See your photo on film (#61): the simulator's film looks (the same tone
// curve, colour, tints, grain and halation as the WebGL renderer's shader in
// renderer.ts) applied to one of your own photos, on the CPU. The looks are
// approximations of each stock's published character, not calibrated
// profiles (see film.ts), and the page says so.

import type { FilmLook } from "./film";

const toLinear = (v8: number) => {
  const v = v8 / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const LUT = Float32Array.from({ length: 256 }, (_, i) => toLinear(i));

/** A deterministic hash noise in −1…1, per grain cell. */
function noise(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h & 0xffff) / 0xffff) * 2 - 1;
}

/** Box-blurred luminance (two passes), for the halation glow. */
function blurred(lum: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return lum;
  const tmp = new Float32Array(lum.length);
  const out = new Float32Array(lum.length);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += lum[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / (2 * r + 1);
      acc += lum[y * w + Math.min(w - 1, x + r + 1)] - lum[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

export interface LookOptions {
  /** Over- (+) or under- (−) exposure, stops. */
  exposureStops?: number;
  /** Grain on (the look's own strength) or off. */
  grain?: boolean;
  seed?: number;
}

/** Tone for one linear value, through the film curve and tints (per channel). */
export function filmTone(lin: number, look: Pick<FilmLook, "softness" | "bias">): number {
  const stops = Math.log2(Math.max(lin, 1e-5) / 0.18);
  return 0.5 + 0.5 * Math.tanh((stops + look.bias) / (look.softness || 1));
}

/** Applies a film look to RGBA pixels in place. */
export function applyFilmLook(data: Uint8ClampedArray, w: number, h: number, look: FilmLook, opts: LookOptions = {}): void {
  const exposure = 2 ** (opts.exposureStops ?? 0);
  const n = w * h;
  // Halation needs the scene's brightness around each pixel.
  let tight: Float32Array | null = null;
  let wide: Float32Array | null = null;
  if (look.halation > 0) {
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) lum[i] = LUT[data[i * 4]] * 0.3 + LUT[data[i * 4 + 1]] * 0.5 + LUT[data[i * 4 + 2]] * 0.2;
    tight = blurred(lum, w, h, Math.max(1, Math.round(w / 400)));
    wide = blurred(lum, w, h, Math.max(2, Math.round(w / 80)));
  }
  const grainSize = Math.max(1, (w / 1100) * 1.5 * (look.iso / 400) ** 0.3);
  const grainOn = opts.grain !== false && look.grain > 0;
  const seed = opts.seed ?? 7;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    let r = LUT[data[p]];
    let g = LUT[data[p + 1]];
    let b = LUT[data[p + 2]];
    if (tight && wide) {
      const hv = Math.max(tight[i] - 0.3, 0) * 1.4 + Math.max(wide[i] - 0.15, 0) * 1.2;
      r += look.halation * hv;
      g += look.halation * 0.18 * hv;
      b += look.halation * 0.05 * hv;
    }
    r *= look.balance[0] * exposure;
    g *= look.balance[1] * exposure;
    b *= look.balance[2] * exposure;
    const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = Y + (r - Y) * look.saturation;
    g = Y + (g - Y) * look.saturation;
    b = Y + (b - Y) * look.saturation;
    if (look.mono) r = g = b = 0.3 * r + 0.59 * g + 0.11 * b;
    let yr = filmTone(r, look);
    let yg = filmTone(g, look);
    let yb = filmTone(b, look);
    yr += look.shadowTint[0] * (1 - yr) ** 2 + look.highlightTint[0] * yr * yr;
    yg += look.shadowTint[1] * (1 - yg) ** 2 + look.highlightTint[1] * yg * yg;
    yb += look.shadowTint[2] * (1 - yb) ** 2 + look.highlightTint[2] * yb * yb;
    yr = look.blackLift + yr * (1 - look.blackLift);
    yg = look.blackLift + yg * (1 - look.blackLift);
    yb = look.blackLift + yb * (1 - look.blackLift);
    if (grainOn) {
      const x = i % w;
      const y = (i / w) | 0;
      const cx = Math.floor(x / grainSize);
      const cy = Math.floor(y / grainSize);
      const lum = 0.3 * yr + 0.59 * yg + 0.11 * yb;
      const weight = 4 * lum * (1 - lum) + 0.15;
      const k = look.grain * 0.09 * weight;
      const gn = noise(cx, cy, seed);
      const colour = look.mono ? 0 : 0.35;
      yr += k * (gn * (1 - colour) + noise(cx + 31, cy, seed) * colour);
      yg += k * (gn * (1 - colour) + noise(cx + 63, cy, seed) * colour);
      yb += k * (gn * (1 - colour) + noise(cx + 94, cy, seed) * colour);
    }
    data[p] = Math.round(Math.min(1, Math.max(0, yr)) * 255);
    data[p + 1] = Math.round(Math.min(1, Math.max(0, yg)) * 255);
    data[p + 2] = Math.round(Math.min(1, Math.max(0, yb)) * 255);
  }
}
