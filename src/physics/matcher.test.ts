import { describe, expect, it } from "vitest";
import { BODIES } from "../data/gear";
import { DEFAULT_ANSWERS, eligible, hasAutofocus, match, scoreBody, wantedFocals, type Answers } from "./matcher";

const ask = (a: Partial<Answers>) => match({ ...DEFAULT_ANSWERS, ...a })!;
const body = (id: string) => BODIES.find((b) => b.id === id)!;

describe("which Leica", () => {
  it("keeps to the medium and focusing asked for", () => {
    expect(ask({ medium: "film" }).body.item.medium).toBe("film");
    expect(ask({ medium: "digital", focus: "auto" }).body.item.family).toMatch(/^(Q|SL|CL)$/);
    expect(hasAutofocus(ask({ medium: "digital", focus: "manual" }).body.item)).toBe(false);
  });
  it("gives a Monochrom only when black and white is wanted", () => {
    expect(ask({ medium: "digital", focus: "manual", mono: "only" }).body.item.medium).toBe("mono");
    expect(ask({ medium: "digital", mono: "never" }).body.item.medium).not.toBe("mono");
  });
  it("steers glasses wearers away from the M3's high-magnification finder", () => {
    const withGlasses = scoreBody(body("m3"), { ...DEFAULT_ANSWERS, glasses: true, uses: ["portrait"] });
    const without = scoreBody(body("m3"), { ...DEFAULT_ANSWERS, uses: ["portrait"] });
    expect(withGlasses.score).toBeLessThan(without.score);
    expect(withGlasses.reasons.some((r) => r.key === "match.r.glassesHigh")).toBe(true);
  });
  it("notes missing frame lines for a wide shooter on an M3", () => {
    const s = scoreBody(body("m3"), { ...DEFAULT_ANSWERS, uses: ["street"] });
    expect(s.reasons.find((r) => r.key === "match.r.noFrames")?.vars?.focals).toContain("35");
  });
  it("picks lenses the finder can frame, with two different jobs", () => {
    const m = ask({ medium: "film", era: "current", uses: ["street", "portrait"] });
    expect(m.lenses).toHaveLength(2);
    const [a, b] = m.lenses.map((l) => l.item.focalMm);
    expect(Math.abs(Math.log2(a / b))).toBeGreaterThanOrEqual(0.4);
    expect(m.lenses.every((l) => !l.reasons.some((r) => r.key === "match.l.noFrame"))).toBe(true);
  });
  it("prefers a fast lens for night", () => {
    expect(ask({ medium: "digital", focus: "manual", uses: ["night"] }).lenses[0].item.maxAperture).toBeLessThanOrEqual(1.4);
  });
  it("gives a fixed-lens camera one lens", () => {
    const m = ask({ medium: "digital", focus: "auto", uses: ["travel", "family"] });
    if (m.body.item.fixedLensId) expect(m.lenses).toHaveLength(1);
  });
  it("offers alternatives and returns null when nothing fits", () => {
    expect(ask({}).alternatives.length).toBeGreaterThan(0);
    expect(match({ ...DEFAULT_ANSWERS, medium: "film", focus: "auto" })).toBeNull();
    expect(BODIES.filter((b) => eligible(b, { ...DEFAULT_ANSWERS, era: "classic", medium: "digital" }))).toEqual([]);
  });
  it("weighs the first focal length of each use most", () => {
    const w = wantedFocals(["architecture"]);
    expect(w.get(21)).toBeGreaterThan(w.get(28)!);
  });
});
