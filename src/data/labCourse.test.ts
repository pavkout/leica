import { describe, expect, it } from "vitest";
import { EXERCISES, checkRules, exercisesIn, openLevels, parseShutter, predictionsFor } from "./labCourse";

const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;

describe("the course", () => {
  it("has three exercises in each of four levels, with unique ids", () => {
    for (const l of [1, 2, 3, 4]) expect(exercisesIn(l)).toHaveLength(3);
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
  it("only asks for the settings its rules use", () => {
    for (const e of EXERCISES) for (const r of e.rules) for (const f of r.needs) expect(e.needs).toContain(f);
  });
});

describe("checking a real shot", () => {
  it("passes Sunny 16 in sun and fails it in shade", () => {
    expect(checkRules(ex("sunny16"), { fNumber: 16, shutterSec: 1 / 400, iso: 400 }).every((r) => r.pass)).toBe(true);
    expect(checkRules(ex("sunny16"), { fNumber: 16, shutterSec: 1 / 30, iso: 400 }).map((r) => r.pass)).toEqual([true, false]);
  });
  it("leaves a rule open when a value is missing", () => {
    expect(checkRules(ex("zone"), { fNumber: 8, shutterSec: 1 / 500 }).map((r) => r.pass)).toEqual([null, true, true]);
    expect(predictionsFor(ex("zone"), { fNumber: 8, shutterSec: 1 / 500 })).toBeNull();
  });
  it("predicts the sharp zone from the thin-lens engine", () => {
    const p = predictionsFor(ex("zone"), { fNumber: 8, shutterSec: 1 / 500, focalMm: 35, focusM: 3 })!;
    expect(p[0].key).toBe("lab.predict.dof");
    expect(Number(p[0].vars.near)).toBeGreaterThan(1.5);
    expect(Number(p[0].vars.near)).toBeLessThan(2.5);
  });
  it("recognises focus at the hyperfocal distance", () => {
    // 35 mm at f/11 with 0.03 mm: H ≈ 3.7 m.
    expect(checkRules(ex("hyperfocal"), { fNumber: 11, focalMm: 35, focusM: 3.7 }).every((r) => r.pass)).toBe(true);
    expect(checkRules(ex("hyperfocal"), { fNumber: 11, focalMm: 35, focusM: Infinity })[1].pass).toBe(false);
  });
  it("finds the handheld limit", () => {
    expect(checkRules(ex("limit"), { shutterSec: 1 / 30, focalMm: 50 })[0].pass).toBe(true);
    expect(checkRules(ex("limit"), { shutterSec: 1 / 250, focalMm: 50 })[0].pass).toBe(false);
  });
});

describe("levels", () => {
  it("opens each level after two passes in the one before", () => {
    expect(openLevels(new Set())).toEqual([1]);
    expect(openLevels(new Set(["sunny16"]))).toEqual([1]);
    expect(openLevels(new Set(["sunny16", "shade"]))).toEqual([1, 2]);
    expect(openLevels(new Set(["sunny16", "shade", "zone", "portrait", "freeze", "pan"]))).toEqual([1, 2, 3, 4]);
    expect(openLevels(new Set(["freeze", "pan"]))).toEqual([1]);
  });
});

describe("typed shutter speeds", () => {
  it("reads the usual ways of writing them", () => {
    expect(parseShutter("1/250")).toBeCloseTo(1 / 250);
    expect(parseShutter("1 / 60 s")).toBeCloseTo(1 / 60);
    expect(parseShutter("2s")).toBe(2);
    expect(parseShutter("0,5")).toBe(0.5);
    expect(parseShutter("fast")).toBeUndefined();
    expect(parseShutter("0")).toBeUndefined();
  });
});
