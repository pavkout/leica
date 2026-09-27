import { describe, expect, it } from "vitest";
import { BODIES, LENSES, findBody, findLens, lensesForBody } from "../data/gear";
import { DEMO, DEMO_STEPS, demoSummary, type DemoActions, type DemoState } from "./demoScript";

function recorder() {
  const calls: [string, unknown][] = [];
  const a: DemoActions = {
    selectBody: (id) => calls.push(["selectBody", id]),
    selectLens: (id) => calls.push(["selectLens", id]),
    open3D: () => calls.push(["open3D", null]),
    setFocusMm: (mm) => calls.push(["setFocusMm", mm]),
    setAperture: (n) => calls.push(["setAperture", n]),
    setDemoSubject: (mm) => calls.push(["setDemoSubject", mm]),
    openLive: () => calls.push(["openLive", null]),
    reveal: (sel) => calls.push(["reveal", sel]),
  };
  return { a, calls };
}

const base: DemoState = { bodyId: "m3", lensId: DEMO.startLensId, lensFocalMm: 35, show3D: true, fNumber: 3.5, subjectSharp: false, liveOpened: false };

describe("demo script", () => {
  it("uses real catalogue gear that fits together", () => {
    const m3 = findBody(DEMO.bodyId);
    expect(BODIES).toContain(m3);
    const fit = lensesForBody(m3).map((l) => l.id);
    expect(fit).toContain(DEMO.startLensId);
    expect(fit).toContain(DEMO.lensId);
    expect(findLens(DEMO.lensId).focalMm).toBe(50);
    expect(findLens(DEMO.startLensId).focalMm).not.toBe(50);
    expect(LENSES.find((l) => l.id === DEMO.lensId)!.minAperture).toBeGreaterThanOrEqual(DEMO.targetFNumber);
  });

  it("follows the spec's order: mount, focus, aperture, live, finish", () => {
    expect(DEMO_STEPS.map((s) => s.id)).toEqual(["mount", "focus", "aperture", "live", "finish"]);
  });

  it("opens on the M3 in 3D with a non-50 lens, so the 50 visibly mounts", () => {
    const { a, calls } = recorder();
    DEMO_STEPS[0].enter(a);
    expect(calls).toEqual([["selectBody", "m3"], ["selectLens", DEMO.startLensId], ["open3D", null]]);
    expect(DEMO_STEPS[0].done(base)).toBe(false);
    expect(DEMO_STEPS[0].done({ ...base, lensId: DEMO.lensId, lensFocalMm: 50 })).toBe(true);
  });

  it("sets a fixed subject and a wrong focus for the rangefinder step, deterministically", () => {
    const { a, calls } = recorder();
    DEMO_STEPS[1].enter(a);
    expect(calls).toEqual([["setDemoSubject", DEMO.subjectMm], ["setFocusMm", DEMO.startFocusMm]]);
    expect(DEMO_STEPS[1].done({ ...base, subjectSharp: true })).toBe(true);
  });

  it("completes aperture at f/8 or smaller", () => {
    expect(DEMO_STEPS[2].done({ ...base, fNumber: 5.6 })).toBe(false);
    expect(DEMO_STEPS[2].done({ ...base, fNumber: 8 })).toBe(true);
    expect(DEMO_STEPS[2].done({ ...base, fNumber: 11 })).toBe(true);
  });

  it("makes every step skippable through the same real setters", () => {
    const { a, calls } = recorder();
    DEMO_STEPS[0].skip(a);
    DEMO_STEPS[1].skip(a);
    DEMO_STEPS[2].skip(a);
    expect(calls).toEqual([["open3D", null], ["selectLens", DEMO.lensId], ["setFocusMm", DEMO.subjectMm], ["setAperture", DEMO.targetFNumber]]);
  });

  it("releases the demo subject at the end", () => {
    const { a, calls } = recorder();
    DEMO_STEPS[4].enter(a);
    expect(calls).toEqual([["setDemoSubject", null]]);
  });

  it("reports the total against the one-minute budget", () => {
    expect(demoSummary([{ id: "mount", seconds: 20, skipped: false }, { id: "focus", seconds: 30, skipped: true }])).toEqual({ totalSec: 50, underBudget: true, skipped: 1 });
    expect(demoSummary([{ id: "mount", seconds: 61, skipped: false }]).underBudget).toBe(false);
  });
});
