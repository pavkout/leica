import { describe, expect, it } from "vitest";
import { BODIES, findBody, lensesForBody, shutterSpeeds } from "../data/gear";
import { RECIPES, findRecipe, recipeEvRange, recipeLink } from "../data/recipes";
import { LIGHT_CONDITIONS } from "./sunny16";
import { correctShutter, exposureError } from "./exposure";
import { hyperfocal } from "./optics";
import { planExposureError, recipeLens, recipeLightMismatch, recipePlan, type RecipeContext } from "./recipes";

const BOX: Record<string, number> = { trix400: 400, hp5: 400, portra400: 400, delta3200: 3200 };
const boxIso = (id: string) => BOX[id];
const m6 = findBody("m6");
const m11 = findBody("m11");
const ctxFor = (body = m6, lensId?: string, lockedFilm: RecipeContext["lockedFilm"] = null): RecipeContext => {
  const lenses = lensesForBody(body);
  return { body, lens: lenses.find((l) => l.id === lensId) ?? lenses[0], lenses, lockedFilm, cocMm: 0.03 };
};

describe("recipe content", () => {
  it("only uses light conditions from the EV guide, and films the catalogue has", () => {
    for (const r of RECIPES) {
      for (const id of r.lightIds) expect(LIGHT_CONDITIONS.map((c) => c.id)).toContain(id);
      expect(Object.keys(BOX)).toContain(r.filmId);
    }
  });

  it("frames every recipe with a 'why', and never stores a shutter speed", () => {
    for (const r of RECIPES) {
      expect(r.why.length).toBeGreaterThan(40);
      expect(r).not.toHaveProperty("shutterSec");
    }
  });

  it("finds recipes by id (for share links)", () => {
    expect(findRecipe("night-street")?.title).toBe("Night street");
    expect(findRecipe("nope")).toBeUndefined();
  });
});

describe("recipe plan", () => {
  it("calculates the shutter from the engine for the recipe's light", () => {
    for (const r of RECIPES) {
      const plan = recipePlan(r, ctxFor(m6), boxIso);
      const [lo, hi] = recipeEvRange(r);
      expect(plan.shutterSec).toBe(shutterSpeeds(m6).reduce((best, t) => (Math.abs(Math.log(t / correctShutter((lo + hi) / 2, plan.fNumber, plan.iso))) < Math.abs(Math.log(best / correctShutter((lo + hi) / 2, plan.fNumber, plan.iso))) ? t : best)));
      // Within half a stop of correct for its own light, after snapping to a marked speed.
      expect(Math.abs(planExposureError(plan, (lo + hi) / 2))).toBeLessThanOrEqual(0.51);
    }
  });

  it("uses the zone-focus (hyperfocal) distance for zone recipes", () => {
    const r = findRecipe("sunny-street")!;
    const plan = recipePlan(r, ctxFor(m6), boxIso);
    expect(plan.focusMm).toBeCloseTo(hyperfocal(35, 11, 0.03));
  });

  it("picks a lens of the recipe's focal length, keeping the current one if it matches", () => {
    const r = findRecipe("window-portrait")!;
    expect(recipeLens(r, ctxFor(m6)).focalMm).toBe(50);
    const cur = lensesForBody(m6).find((l) => l.focalMm === 50 && l.maxAperture > 1.4)!;
    expect(recipeLens(r, ctxFor(m6, cur.id)).id).toBe(cur.id);
  });

  it("clamps the aperture to what the lens can do, and says so", () => {
    const slow50 = lensesForBody(m6).find((l) => l.focalMm === 50 && l.maxAperture >= 2.4)!;
    const plan = recipePlan(findRecipe("night-street")!, ctxFor(m6, slow50.id), boxIso);
    expect(plan.fNumber).toBe(slow50.maxAperture);
    expect(plan.notes.join(" ")).toMatch(/set to f\//);
  });

  it("pushes film to the recipe's EI on film bodies", () => {
    expect(recipePlan(findRecipe("dusk-street")!, ctxFor(m6), boxIso)).toMatchObject({ filmId: "trix400", iso: 1600 });
  });

  it("keeps a roll already in the camera instead of swapping film mid-roll", () => {
    const plan = recipePlan(findRecipe("night-street")!, ctxFor(m6, undefined, { id: "portra400", name: "Portra 400", iso: 400 }), boxIso);
    expect(plan.filmId).toBeNull();
    expect(plan.iso).toBe(400);
    expect(plan.notes.join(" ")).toMatch(/already in the camera/);
  });

  it("uses the film's speed as ISO on digital bodies, within the body's range", () => {
    const plan = recipePlan(findRecipe("night-street")!, ctxFor(m11), boxIso);
    expect(plan.filmId).toBeNull();
    expect(plan.iso).toBe(3200);
  });

  it("works on every body in the catalogue", () => {
    for (const body of BODIES) for (const r of RECIPES) expect(() => recipePlan(r, ctxFor(body), boxIso)).not.toThrow();
  });
});

describe("light mismatch warning", () => {
  it("is silent inside the recipe's range (±1 EV)", () => {
    expect(recipeLightMismatch(findRecipe("sunny-street")!, 15)).toBeNull();
    expect(recipeLightMismatch(findRecipe("sunny-street")!, 13)).toBeNull();
  });

  it("warns when the scene is materially darker or brighter", () => {
    expect(recipeLightMismatch(findRecipe("sunny-street")!, 3)).toEqual({ direction: "darker", stops: 11 });
    expect(recipeLightMismatch(findRecipe("night-street")!, 12)).toEqual({ direction: "brighter", stops: 7 });
  });

  it("agrees with the engine's exposure error", () => {
    const plan = recipePlan(findRecipe("sunny-street")!, ctxFor(m6), boxIso);
    expect(planExposureError(plan, 3)).toBeCloseTo(exposureError(3, plan.fNumber, plan.shutterSec, plan.iso));
    expect(planExposureError(plan, 3)).toBeLessThan(-10);
  });
});

describe("share link", () => {
  it("encodes the recipe id and keeps the deploy path", () => {
    expect(recipeLink("night-street", { origin: "https://x.test", pathname: "/leica/" })).toBe("https://x.test/leica/?recipe=night-street");
  });
});
