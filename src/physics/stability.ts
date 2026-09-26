// Hand-stability trainer: turns a few seconds of gyroscope readings into an
// angular-speed estimate, a stable/marginal/unstable label and a conservative
// handheld shutter suggestion. Pure — the sensor adapter
// (services/motionSensor.ts) only feeds it samples, so everything here is
// testable without a device.
//
// Blur model: rotating the camera at ω rad/s for t seconds sweeps the image
// across the sensor by about focalMm · ω · t mm (small-angle). The "stable"
// threshold is calibrated to the same 1/focal-length rule `shakeBlurMm` in
// physics/exposure.ts uses: 0.03 mm of blur at 1/f seconds means a nominal
// hand turns at 0.03 rad/s ≈ 1.72°/s — so this trainer and the simulator's
// shake kernel agree about what an "average" hand is.

import type { Provenance } from "../data/provenance";

export interface MotionSample {
  /** Timestamp in ms (any monotonic origin). */
  t: number;
  /** Rotation rate about the device's x axis (pitch), °/s. */
  beta: number;
  /** Rotation rate about the device's y axis (yaw), °/s. */
  gamma: number;
}

export type StabilityLabel = "stable" | "marginal" | "unstable";

/** Angular speed (°/s) of the hand the 1/focal-length rule assumes. */
export const NOMINAL_HAND_DEG_PER_SEC = (0.03 * 180) / Math.PI;

export const STABILITY_PROVENANCE: Provenance = {
  kind: "approximate",
  notes:
    "Thresholds are calibrated to the 1/focal-length rule of thumb, and the reading comes from your phone's gyroscope — held like a phone, not a rangefinder. Treat it as personal, device-specific guidance, not a guarantee.",
};

/** Low-pass cutoff. Physiological hand tremor sits around 8–12 Hz and does blur a photo, so keep it; above this is mostly sensor noise. */
const LOW_PASS_HZ = 15;
/** Gaps longer than this (a dropped/throttled sensor) aren't integrated across. */
const MAX_GAP_MS = 250;

/**
 * Angular speed (°/s) about the two axes perpendicular to the lens — the
 * rotations that smear the image across the sensor. Roll about the lens
 * axis rotates the image around its centre instead and is ignored here.
 */
export function angularSpeed(s: Pick<MotionSample, "beta" | "gamma">): number {
  return Math.hypot(s.beta, s.gamma);
}

/**
 * Normalizes an irregular sample stream (browsers deliver 16–100 Hz with
 * jitter) into filtered angular speeds with the duration each one covers,
 * via a time-constant low-pass so the result doesn't depend on the device's
 * sample rate.
 */
export function filterSpeeds(samples: MotionSample[], cutoffHz = LOW_PASS_HZ): { t: number; speed: number; dt: number }[] {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  const out: { t: number; speed: number; dt: number }[] = [];
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    const raw = angularSpeed(samples[i]);
    const gapMs = i === 0 ? 0 : samples[i].t - samples[i - 1].t;
    // First sample, or after a gap: restart the filter; the sample marks a
    // point on the trace but covers no integrated time. Duplicate
    // timestamps are dropped.
    if (i > 0 && gapMs <= 0) continue;
    if (i === 0 || gapMs > MAX_GAP_MS) {
      y = raw;
      out.push({ t: samples[i].t, speed: y, dt: 0 });
      continue;
    }
    const dt = gapMs / 1000;
    y += (dt / (tau + dt)) * (raw - y);
    out.push({ t: samples[i].t, speed: y, dt });
  }
  return out;
}

export interface StabilitySummary {
  /** Time-weighted RMS angular speed, °/s. */
  rmsDegPerSec: number;
  /** Time-weighted 90th-percentile angular speed, °/s — the "bad moment" figure the conservative suggestion uses. */
  p90DegPerSec: number;
  /** Seconds of usable data. */
  durationSec: number;
  label: StabilityLabel;
}

export function classifyStability(rmsDegPerSec: number): StabilityLabel {
  if (rmsDegPerSec <= NOMINAL_HAND_DEG_PER_SEC) return "stable";
  if (rmsDegPerSec <= 2 * NOMINAL_HAND_DEG_PER_SEC) return "marginal";
  return "unstable";
}

/** Summarizes a sample stream. Returns null if there isn't enough usable data (< 1 s). */
export function summarizeStability(samples: MotionSample[]): StabilitySummary | null {
  const f = filterSpeeds(samples).filter((s) => s.dt > 0);
  const total = f.reduce((a, s) => a + s.dt, 0);
  if (total < 1) return null;
  const rms = Math.sqrt(f.reduce((a, s) => a + s.speed * s.speed * s.dt, 0) / total);
  const sorted = [...f].sort((a, b) => a.speed - b.speed);
  let acc = 0;
  let p90 = sorted[sorted.length - 1].speed;
  for (const s of sorted) {
    acc += s.dt;
    if (acc >= 0.9 * total) {
      p90 = s.speed;
      break;
    }
  }
  return { rmsDegPerSec: rms, p90DegPerSec: p90, durationSec: total, label: classifyStability(rms) };
}

/** Image-plane blur (mm) from rotating at `degPerSec` for `shutterSec` with a `focalMm` lens. */
export function angularBlurMm(degPerSec: number, focalMm: number, shutterSec: number): number {
  return focalMm * ((degPerSec * Math.PI) / 180) * shutterSec;
}

/** Longest exposure (s) whose blur at `degPerSec` stays within `cocMm`. */
export function maxHandheldSec(degPerSec: number, focalMm: number, cocMm: number): number {
  if (degPerSec <= 0) return Infinity;
  return cocMm / (focalMm * ((degPerSec * Math.PI) / 180));
}

export interface HandheldSuggestion {
  /** Conservative: sharp even through the shakier moments (p90). */
  safeSec: number;
  /** Typical: sharp for an average moment (RMS) — works with care, not every frame. */
  typicalSec: number;
}

/**
 * Snaps the blur limits to the body's real shutter speeds: the slowest listed
 * speed that is still at least as fast as each limit. Falls back to the
 * fastest listed speed if even that isn't fast enough.
 */
export function suggestHandheld(summary: StabilitySummary, focalMm: number, cocMm: number, shutters: number[]): HandheldSuggestion {
  const byFastest = [...shutters].sort((a, b) => a - b);
  const snap = (limit: number) => {
    let pick = byFastest[0];
    for (const s of byFastest) if (s <= limit) pick = s;
    return pick;
  };
  return {
    safeSec: snap(maxHandheldSec(summary.p90DegPerSec, focalMm, cocMm)),
    typicalSec: snap(maxHandheldSec(summary.rmsDegPerSec, focalMm, cocMm)),
  };
}
