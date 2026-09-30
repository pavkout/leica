import { describe, expect, it } from "vitest";
import { errorStops, exposureFrom, findOnsets, gradeSpeed, measureInterval, verdict } from "./shutterTest";

const SR = 48_000;

/** A recording: faint noise, with decaying clicks at the given times and levels. */
function recording(seconds: number, clicks: { t: number; amp: number; ms?: number }[], noise = 0.002, seed = 7) {
  const out = new Float32Array(Math.round(seconds * SR));
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < out.length; i++) out[i] = rand() * noise;
  for (const c of clicks) {
    const start = Math.round(c.t * SR);
    const len = Math.round(((c.ms ?? 6) / 1000) * SR);
    for (let i = 0; i < len && start + i < out.length; i++) out[start + i] += c.amp * Math.exp(-i / (len / 5)) * Math.sin(i * 0.9);
  }
  return out;
}

describe("finding clicks", () => {
  it("finds each click once, at its start", () => {
    const o = findOnsets(recording(1, [{ t: 0.2, amp: 0.6 }, { t: 0.5, amp: 0.8 }]), SR);
    expect(o).toHaveLength(2);
    expect(o[0].t).toBeCloseTo(0.2, 3);
    expect(o[1].t).toBeCloseTo(0.5, 3);
  });
  it("hears nothing in silence", () => {
    expect(findOnsets(recording(0.5, []), SR).length).toBeLessThanOrEqual(1);
    expect(measureInterval(new Float32Array(SR / 2), SR, 1 / 8)).toEqual({ ok: false, reason: "silent" });
  });
});

describe("measuring an exposure", () => {
  it("measures a slow speed to the millisecond, past the escapement's buzz", () => {
    const buzz = Array.from({ length: 40 }, (_, i) => ({ t: 0.12 + i * 0.012, amp: 0.05, ms: 3 }));
    const rec = recording(2, [{ t: 0.1, amp: 0.7 }, ...buzz, { t: 0.1 + 0.52, amp: 0.9 }]);
    const m = measureInterval(rec, SR, 1 / 2);
    expect(m.ok).toBe(true);
    if (m.ok) expect(m.intervalSec).toBeCloseTo(0.52, 3);
  });
  it("reports a single click", () => {
    expect(measureInterval(recording(1, [{ t: 0.1, amp: 0.7 }]), SR, 1 / 30)).toEqual({ ok: false, reason: "oneClick" });
  });
  it("takes off the travel time measured at the fastest speed", () => {
    const travel = measureInterval(recording(1, [{ t: 0.1, amp: 0.7 }, { t: 0.1 + 0.019, amp: 0.9 }]), SR, 1 / 1000);
    expect(travel.ok).toBe(true);
    const slow = measureInterval(recording(1, [{ t: 0.1, amp: 0.7 }, { t: 0.1 + 0.019 + 1 / 30, amp: 0.9 }]), SR, 1 / 30);
    if (!travel.ok || !slow.ok) throw new Error("expected both");
    expect(exposureFrom(slow.intervalSec, travel.intervalSec)).toBeCloseTo(1 / 30, 3);
  });
});

describe("grading", () => {
  it("grades by stops off", () => {
    expect(errorStops(1 / 8, 1 / 8)).toBeCloseTo(0);
    expect(errorStops(1 / 8, 1 / 4)).toBeCloseTo(1);
    expect(gradeSpeed(0.3)).toBe("good");
    expect(gradeSpeed(-0.5)).toBe("attention");
    expect(gradeSpeed(0.8)).toBe("service");
  });
  it("gives an overall verdict", () => {
    expect(verdict(["good", "good"], 0)).toBe("good");
    expect(verdict(["good"], 1)).toBe("attention");
    expect(verdict(["attention"], 0)).toBe("attention");
    expect(verdict(["good"], 3)).toBe("service");
    expect(verdict(["service"], 0)).toBe("service");
  });
});
