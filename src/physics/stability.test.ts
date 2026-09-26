import { describe, expect, it } from "vitest";
import { shakeBlurMm } from "./exposure";
import {
  NOMINAL_HAND_DEG_PER_SEC,
  angularBlurMm,
  classifyStability,
  filterSpeeds,
  maxHandheldSec,
  suggestHandheld,
  summarizeStability,
  type MotionSample,
} from "./stability";

/** Synthetic gyroscope stream: `amp` °/s sinusoidal tremor at `hz`, sampled at `rateHz` for `seconds`. */
function stream(amp: number, seconds: number, rateHz = 60, hz = 9, jitterMs = 0): MotionSample[] {
  const out: MotionSample[] = [];
  let t = 0;
  let i = 0;
  while (t <= seconds * 1000) {
    const s = t / 1000;
    out.push({ t, beta: amp * Math.sin(2 * Math.PI * hz * s), gamma: amp * Math.cos(2 * Math.PI * hz * s * 0.7) });
    i++;
    t = (i * 1000) / rateHz + (jitterMs ? ((i * 7919) % 11) / 10 * jitterMs - jitterMs / 2 : 0);
  }
  return out;
}

const SHUTTERS = [1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000];

describe("stability model", () => {
  it("agrees with the simulator's shake kernel at the 1/focal rule", () => {
    // A nominal hand at 1/f seconds blurs exactly as much as shakeBlurMm says.
    for (const f of [28, 50, 90]) {
      expect(angularBlurMm(NOMINAL_HAND_DEG_PER_SEC, f, 1 / f)).toBeCloseTo(shakeBlurMm(1 / f, f), 9);
    }
    expect(maxHandheldSec(NOMINAL_HAND_DEG_PER_SEC, 50, 0.03)).toBeCloseTo(1 / 50, 9);
  });

  it("classifies against the nominal hand", () => {
    expect(classifyStability(0.5)).toBe("stable");
    expect(classifyStability(NOMINAL_HAND_DEG_PER_SEC * 1.5)).toBe("marginal");
    expect(classifyStability(NOMINAL_HAND_DEG_PER_SEC * 5)).toBe("unstable");
  });

  it("returns null with under a second of usable data", () => {
    expect(summarizeStability([])).toBeNull();
    expect(summarizeStability(stream(1, 0.5))).toBeNull();
  });

  it("gives different results for a braced versus a shaken device", () => {
    const braced = summarizeStability(stream(0.4, 5))!;
    const shaken = summarizeStability(stream(20, 5))!;
    expect(braced.label).toBe("stable");
    expect(shaken.label).toBe("unstable");
    const b = suggestHandheld(braced, 50, 0.03, SHUTTERS);
    const s = suggestHandheld(shaken, 50, 0.03, SHUTTERS);
    expect(b.safeSec).toBeGreaterThan(s.safeSec);
  });

  it("is conservative: the safe speed is never slower than the typical one", () => {
    for (const amp of [0.3, 1, 3, 10]) {
      const sum = summarizeStability(stream(amp, 5))!;
      expect(sum.p90DegPerSec).toBeGreaterThanOrEqual(sum.rmsDegPerSec * 0.99);
      const { safeSec, typicalSec } = suggestHandheld(sum, 35, 0.03, SHUTTERS);
      expect(safeSec).toBeLessThanOrEqual(typicalSec);
      expect(SHUTTERS).toContain(safeSec);
    }
  });

  it("longer focal lengths need faster shutter speeds for the same hand", () => {
    const sum = summarizeStability(stream(2, 5))!;
    expect(suggestHandheld(sum, 90, 0.03, SHUTTERS).safeSec).toBeLessThan(suggestHandheld(sum, 28, 0.03, SHUTTERS).safeSec);
  });

  it("falls back to the fastest speed when nothing is fast enough", () => {
    const sum = summarizeStability(stream(500, 2))!;
    expect(suggestHandheld(sum, 135, 0.03, SHUTTERS).safeSec).toBe(1 / 1000);
  });

  it("normalizes sample rate: 30 Hz and 100 Hz streams of the same motion agree", () => {
    const slow = summarizeStability(stream(2, 5, 30, 3))!;
    const fast = summarizeStability(stream(2, 5, 100, 3))!;
    expect(slow.rmsDegPerSec).toBeCloseTo(fast.rmsDegPerSec, 0);
    expect(slow.durationSec).toBeCloseTo(fast.durationSec, 1);
  });

  it("tolerates jittered timestamps, duplicates and sensor gaps", () => {
    const s = stream(1, 5, 60, 9, 4);
    s.splice(10, 0, { ...s[10] }); // duplicate timestamp
    const gapped = s.map((p) => (p.t > 2000 ? { ...p, t: p.t + 1000 } : p)); // 1 s dropout
    const sum = summarizeStability(gapped)!;
    expect(Number.isFinite(sum.rmsDegPerSec)).toBe(true);
    // The dropout isn't counted as time held.
    expect(sum.durationSec).toBeLessThan(5.1);
    expect(filterSpeeds(gapped).every((p) => p.dt <= 0.25)).toBe(true);
  });
});
