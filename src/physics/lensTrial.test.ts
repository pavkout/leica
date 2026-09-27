import { describe, expect, it } from "vitest";
import { findBody, lensesForBody } from "../data/gear";
import { angleOfView } from "./optics";
import { TRIAL_FOCALS, distanceForField, fieldAtDistance, parseTrial, trialLenses, trialQuery, trialWarnings } from "./lensTrial";

const fmt = (mm: number) => `${(mm / 1000).toFixed(2)} m`;
const m6 = findBody("m6");
const m11 = findBody("m11");

describe("framing", () => {
  it("covers frame × (d − f) / f at the subject", () => {
    expect(fieldAtDistance(50, 3050, 36, 24)).toEqual({ w: 36 * 60, h: 24 * 60 });
  });

  it("agrees with the angle of view at long distances", () => {
    const { w } = fieldAtDistance(35, 1e7, 36, 24);
    expect(2 * Math.atan(w / 2 / 1e7) * (180 / Math.PI)).toBeCloseTo(angleOfView(35, 36), 1);
  });

  it("finds the distance that keeps the same framing with another lens", () => {
    const field = fieldAtDistance(50, 3000, 36, 24).w;
    const d90 = distanceForField(90, field, 36);
    expect(fieldAtDistance(90, d90, 36, 24).w).toBeCloseTo(field);
    expect(d90).toBeGreaterThan(3000);
  });
});

describe("trial strip", () => {
  it("offers 28/35/50/75/90 on an M, keeping the current lens where it matches", () => {
    const lenses = lensesForBody(m6);
    const current = lenses.find((l) => l.focalMm === 50)!;
    const strip = trialLenses(current, lenses);
    expect(strip.map((l) => l.focalMm)).toEqual(TRIAL_FOCALS);
    expect(strip.find((l) => l.focalMm === 50)).toBe(current);
  });

  it("includes the current focal length even when it isn't one of the five", () => {
    const lenses = lensesForBody(m6);
    const wide = lenses.find((l) => l.focalMm === 21)!;
    expect(trialLenses(wide, lenses).map((l) => l.focalMm)).toEqual([21, ...TRIAL_FOCALS]);
  });
});

describe("warnings are factual", () => {
  const lenses = lensesForBody(m6);
  const fifty = lenses.find((l) => l.focalMm === 50)!;

  it("warns when the subject is inside closest focus", () => {
    expect(trialWarnings(fifty, m6, fifty.minFocusMm - 100, fmt).map((w) => w.kind)).toContain("closest-focus");
    expect(trialWarnings(fifty, m6, fifty.minFocusMm + 100, fmt).map((w) => w.kind)).not.toContain("closest-focus");
  });

  it("warns when the finder has no frame lines for the focal length", () => {
    const twentyOne = lenses.find((l) => l.focalMm === 21)!;
    expect(trialWarnings(twentyOne, m6, 3000, fmt).map((w) => w.kind)).toContain("no-framelines");
    expect(trialWarnings(fifty, m6, 3000, fmt).map((w) => w.kind)).not.toContain("no-framelines");
  });

  it("never recommends: no buy/best/should wording", () => {
    for (const l of lensesForBody(m11)) for (const w of trialWarnings(l, m11, 500, fmt)) expect(w.text).not.toMatch(/\b(buy|best|should|recommend|upgrade)\b/i);
  });
});

describe("share link", () => {
  it("round-trips camera, lens, distance, scene and aperture", () => {
    const t = { bodyId: "m6", lensId: "m-35-2", distanceMm: 3200, sceneId: "sun", fNumber: 5.6 };
    expect(parseTrial(trialQuery(t))).toEqual(t);
  });

  it("ignores incomplete or foreign query strings", () => {
    expect(parseTrial("?recipe=night-street")).toBeNull();
    expect(parseTrial("?try=1&body=m6&lens=x&d=-5&scene=sun")).toBeNull();
  });
});
