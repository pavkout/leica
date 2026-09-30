// Shutter speed by sound (#42). A focal-plane shutter makes two clicks: the
// release as the first curtain starts, and the second curtain landing at the
// far side. The gap between them is the exposure time plus the time a
// curtain takes to cross the frame (the travel time). Firing once at the
// fastest speed, where the exposure itself is next to nothing, measures that
// travel time for this camera; it is then taken off every other reading.
//
// What it can and can't do: a phone microphone resolves clicks to a
// millisecond or so, which is fine for 1 s down to about 1/30 s, a fair
// indication at 1/60 and 1/125, and meaningless faster (the exposure is
// shorter than the travel time and the clicks merge). The page offers only
// the speeds this can measure and labels the fast end "indicative".
// Tolerances are this app's rule of thumb for film, not a Leica figure.

export interface Onset {
  /** Seconds from the start of the recording. */
  t: number;
  /** Peak level of the click, in dB relative to the recording's peak (0 = loudest). */
  db: number;
}

const WINDOW_SEC = 0.0005;

/** Short-window energy, in dB, one value per 0.5 ms. */
export function envelopeDb(samples: Float32Array, sampleRate: number): { hopSec: number; db: Float32Array } {
  const hop = Math.max(1, Math.round(WINDOW_SEC * sampleRate));
  const n = Math.floor(samples.length / hop);
  const db = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = i * hop; j < (i + 1) * hop; j++) sum += samples[j] * samples[j];
    db[i] = 10 * Math.log10(sum / hop + 1e-12);
  }
  return { hopSec: hop / sampleRate, db };
}

function median(values: Float32Array): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.floor(sorted.length / 2)] ?? -120;
}

/**
 * Clicks in a recording: moments where the level jumps well above the
 * background and within `rangeDb` of the loudest sound. Each click is
 * counted once, at its first rise; a click can't start within `holdSec` of
 * the last.
 */
export function findOnsets(samples: Float32Array, sampleRate: number, { riseDb = 18, rangeDb = 20, holdSec = 0.004 } = {}): Onset[] {
  const { hopSec, db } = envelopeDb(samples, sampleRate);
  if (db.length === 0) return [];
  const floor = median(db);
  let peak = -Infinity;
  for (const v of db) peak = Math.max(peak, v);
  const threshold = Math.max(floor + riseDb, peak - rangeDb);
  const out: Onset[] = [];
  let inClick = false;
  let clickPeak = -Infinity;
  for (let i = 0; i < db.length; i++) {
    const t = i * hopSec;
    if (db[i] >= threshold) {
      if (!inClick && (out.length === 0 || t - out[out.length - 1].t >= holdSec)) {
        inClick = true;
        clickPeak = db[i];
        out.push({ t, db: 0 });
      } else if (inClick) clickPeak = Math.max(clickPeak, db[i]);
    } else if (inClick && db[i] < threshold - 6) {
      inClick = false;
      out[out.length - 1].db = clickPeak - peak;
    }
  }
  if (inClick) out[out.length - 1].db = clickPeak - peak;
  return out;
}

export type Measurement =
  | { ok: true; intervalSec: number; first: number; last: number }
  | { ok: false; reason: "silent" | "oneClick" | "tooLong" };

/**
 * The time between the release and the second curtain landing. The last
 * strong click within a window after the first is taken as the landing, so
 * the buzz of a slow-speed escapement in between doesn't cut it short.
 */
export function measureInterval(samples: Float32Array, sampleRate: number, nominalSec: number): Measurement {
  const onsets = findOnsets(samples, sampleRate);
  if (onsets.length === 0) return { ok: false, reason: "silent" };
  const first = onsets[0];
  // A shutter four times slower than marked is broken either way; beyond that it's another sound.
  const windowEnd = first.t + Math.max(0.15, nominalSec * 4 + 0.08);
  const strong = onsets.filter((o) => o.t > first.t + 0.002 && o.t <= windowEnd && o.db >= -12);
  if (strong.length === 0) return onsets.some((o) => o.t > windowEnd) ? { ok: false, reason: "tooLong" } : { ok: false, reason: "oneClick" };
  const last = strong[strong.length - 1];
  return { ok: true, intervalSec: last.t - first.t, first: first.t, last: last.t };
}

/** The exposure, with this camera's travel time taken off. Never below a tenth of a millisecond. */
export function exposureFrom(intervalSec: number, travelSec: number): number {
  return Math.max(0.0001, intervalSec - travelSec);
}

/** How far off a speed is, in stops: + means slow (more light). */
export function errorStops(nominalSec: number, measuredSec: number): number {
  return Math.log2(measuredSec / nominalSec);
}

export type SpeedGrade = "good" | "attention" | "service";

/** ±1/3 stop is fine for film; up to 2/3 is worth knowing; beyond that the shutter wants a service. */
export function gradeSpeed(err: number): SpeedGrade {
  const a = Math.abs(err);
  return a <= 1 / 3 + 1e-9 ? "good" : a <= 2 / 3 + 1e-9 ? "attention" : "service";
}

/** The speeds offered, slowest first, and whether sound can only indicate them. */
export const TEST_SPEEDS: { sec: number; label: string; indicative: boolean }[] = [
  { sec: 1, label: "1", indicative: false },
  { sec: 1 / 2, label: "1/2", indicative: false },
  { sec: 1 / 4, label: "1/4", indicative: false },
  { sec: 1 / 8, label: "1/8", indicative: false },
  { sec: 1 / 15, label: "1/15", indicative: false },
  { sec: 1 / 30, label: "1/30", indicative: false },
  { sec: 1 / 60, label: "1/60", indicative: true },
  { sec: 1 / 125, label: "1/125", indicative: true },
];

/** Overall verdict from graded speeds and checklist answers. */
export function verdict(grades: SpeedGrade[], issues: number): SpeedGrade {
  if (grades.includes("service") || issues >= 3) return "service";
  if (grades.includes("attention") || issues > 0) return "attention";
  return "good";
}
