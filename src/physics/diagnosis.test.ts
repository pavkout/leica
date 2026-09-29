import { describe, expect, it } from "vitest";
import { diagnoseFrame } from "./diagnosis";

const base = { focalMm: 50, fNumber: 8, shutterSec: 1 / 250, focusMm: 3000, subjectMm: 3000, cocMm: 0.03, tripod: false, evOffset: 0 };

describe("diagnoseFrame", () => {
  it("finds nothing wrong with a well-made frame", () => {
    const d = diagnoseFrame(base);
    expect(d.findings.filter((f) => f.level === "problem")).toEqual([]);
    expect(d.suggestedTag).toBe("good");
    expect(d.partial).toBe(false);
  });

  it("calls a subject outside the depth of field a missed focus", () => {
    const d = diagnoseFrame({ ...base, fNumber: 1.4, focusMm: 1500, subjectMm: 3000 });
    const focus = d.findings.find((f) => f.kind === "focus")!;
    expect(focus.level).toBe("problem");
    expect(focus.detail).toMatch(/behind/);
    expect(d.suggestedTag).toBe("missed-focus");
  });

  it("flags camera shake below 1/focal length, but not on a tripod", () => {
    expect(diagnoseFrame({ ...base, shutterSec: 1 / 8 }).findings.find((f) => f.kind === "shake")!.level).toBe("problem");
    expect(diagnoseFrame({ ...base, shutterSec: 1 / 8, tripod: true }).findings.some((f) => f.kind === "shake")).toBe(false);
  });

  it("reports subject movement as a risk, never a problem", () => {
    const motion = diagnoseFrame({ ...base, shutterSec: 1 / 15, tripod: true }).findings.find((f) => f.kind === "motion")!;
    expect(motion.level).toBe("risk");
  });

  it("flags diffraction only when stopped well down", () => {
    expect(diagnoseFrame({ ...base, fNumber: 8 }).findings.some((f) => f.kind === "diffraction")).toBe(false);
    expect(diagnoseFrame({ ...base, fNumber: 32 }).findings.some((f) => f.kind === "diffraction")).toBe(true);
  });

  it("suggests the exposure tag from the sign of the error", () => {
    expect(diagnoseFrame({ ...base, evOffset: 2 }).suggestedTag).toBe("overexposed");
    expect(diagnoseFrame({ ...base, evOffset: -3 }).suggestedTag).toBe("underexposed");
  });

  it("is partial for older frames saved without the subject distance", () => {
    const d = diagnoseFrame({ focalMm: 50, fNumber: 8, shutterSec: 1 / 250, focusMm: 3000, evOffset: 0 });
    expect(d.partial).toBe(true);
    expect(d.findings.some((f) => f.kind === "focus")).toBe(false);
  });
});
