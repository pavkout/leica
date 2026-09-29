// Rangefinder check at home: a printed target lies flat, photographed at
// about 45°, focused on its centre mark with the rangefinder, wide open. The
// sharpest band of the photo shows where the lens really focused. Nearer
// parts of a flat target sit lower in the frame, so a peak below the mark is
// front focus, above it back focus.
//
// Pure image maths on a greyscale buffer: local contrast (a Laplacian) summed
// across rows, smoothed, and its peak found.

/** Rec. 709 luma from RGBA bytes, as 0–1 floats. */
export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) / 255;
  return g;
}

/**
 * Sharpness per row: the mean absolute Laplacian across the middle columns
 * (`x0`–`x1`, fractions of the width), where the target is.
 */
export function rowSharpness(gray: Float32Array, w: number, h: number, x0 = 0.3, x1 = 0.7): Float32Array {
  const a = Math.max(1, Math.floor(w * x0));
  const b = Math.min(w - 1, Math.ceil(w * x1));
  const rows = new Float32Array(h);
  for (let y = 1; y < h - 1; y++) {
    let sum = 0;
    for (let x = a; x < b; x++) {
      const i = y * w + x;
      sum += Math.abs(4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]);
    }
    rows[y] = sum / (b - a);
  }
  return rows;
}

/** A moving average, so one crisp line of print doesn't count as the focus. */
export function smooth(values: Float32Array, radius: number): Float32Array {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
      s += values[j];
      n++;
    }
    out[i] = s / n;
  }
  return out;
}

export interface FocusResult {
  /** Row of peak sharpness, as a fraction of the height (0 top). */
  peak: number;
  /** Where you focused (the tapped mark), same units. */
  mark: number;
  /** Peak minus mark: positive means the peak is lower in the frame (nearer: front focus). */
  offset: number;
  verdict: "on" | "front" | "back";
  /** How clear the peak is: its height over the frame's median sharpness. */
  confidence: number;
  /** The smoothed profile, 0–1, for drawing. */
  profile: number[];
}

/**
 * Where the photo is sharpest, against where you focused. `tolerance` (a
 * fraction of the height) is what counts as "on": at 45° and 1 m wide open,
 * a few percent of the frame is within the depth of field.
 */
export function analyseFocus(gray: Float32Array, w: number, h: number, mark: number, tolerance = 0.04): FocusResult {
  const raw = rowSharpness(gray, w, h);
  const s = smooth(raw, Math.max(2, Math.round(h * 0.03)));
  // Ignore the outer 5% where borders and vignetting sit.
  const lo = Math.floor(h * 0.05);
  const hi = Math.ceil(h * 0.95);
  let peakRow = lo;
  for (let y = lo; y < hi; y++) if (s[y] > s[peakRow]) peakRow = y;
  const sortedVals = Array.from(s.slice(lo, hi)).sort((a, b) => a - b);
  const median = sortedVals[Math.floor(sortedVals.length / 2)] || 1e-6;
  const max = s[peakRow] || 1e-6;
  const peak = peakRow / h;
  const offset = peak - mark;
  const verdict = Math.abs(offset) <= tolerance ? "on" : offset > 0 ? "front" : "back";
  // Downsample the profile for drawing.
  const steps = 120;
  const profile = Array.from({ length: steps }, (_, i) => s[Math.min(h - 1, Math.floor((i / steps) * h))] / max);
  return { peak, mark, offset, verdict, confidence: max / median, profile };
}
