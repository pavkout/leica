// Photo Recipes (feature #28): turn a recipe into concrete settings for the
// user's camera, using the shared engines. Pure.

import { apertureStops, nearestStop, shutterSpeeds, type Body, type Lens } from "../data/gear";
import { recipeEvRange, type Recipe } from "../data/recipes";
import { correctShutter, exposureError } from "./exposure";
import { hyperfocal } from "./optics";

export interface RecipePlan {
  lensId: string;
  fNumber: number;
  /** Film bodies: the film to load (unless a roll is already in the camera). */
  filmId: string | null;
  /** Film bodies: exposure index; digital: ISO. */
  iso: number;
  shutterSec: number;
  focusMm: number;
  /** Plain-language notes on anything that had to adapt to this camera. */
  notes: string[];
}

export interface RecipeContext {
  body: Body;
  lens: Lens;
  /** Lenses that fit the body. */
  lenses: Lens[];
  /** Film currently in the camera, when a roll has frames on it (film can't be swapped mid-roll). */
  lockedFilm: { id: string; name: string; iso: number } | null;
  /** Circle of confusion in use, mm. */
  cocMm: number;
}

/** The lens to use: the current one if it has the recipe's focal length, else the fastest one that does, else the closest focal length. */
export function recipeLens(recipe: Recipe, ctx: RecipeContext): Lens {
  if (ctx.lens.focalMm === recipe.focalMm) return ctx.lens;
  const same = ctx.lenses.filter((l) => l.focalMm === recipe.focalMm).sort((a, b) => a.maxAperture - b.maxAperture);
  if (same.length) return same[0];
  return [...ctx.lenses].sort((a, b) => Math.abs(a.focalMm - recipe.focalMm) - Math.abs(b.focalMm - recipe.focalMm))[0] ?? ctx.lens;
}

export function recipePlan(recipe: Recipe, ctx: RecipeContext, boxIso: (filmId: string) => number): RecipePlan {
  const notes: string[] = [];
  const lens = recipeLens(recipe, ctx);
  if (lens.focalMm !== recipe.focalMm) notes.push(`No ${recipe.focalMm} mm lens fits this camera; using ${lens.name}.`);

  const stops = apertureStops(lens);
  const fNumber = nearestStop(stops, Math.max(recipe.fNumber, lens.maxAperture));
  if (fNumber !== recipe.fNumber) notes.push(`${lens.name} is set to f/${fNumber} (the recipe says f/${recipe.fNumber}).`);

  const film = ctx.body.medium === "film";
  let filmId: string | null = null;
  let iso: number;
  if (film) {
    if (ctx.lockedFilm && ctx.lockedFilm.id !== recipe.filmId) {
      notes.push(`${ctx.lockedFilm.name} is already in the camera, so the recipe uses it at box speed.`);
      iso = ctx.lockedFilm.iso;
    } else {
      filmId = recipe.filmId;
      iso = recipe.ei ?? boxIso(recipe.filmId);
    }
  } else {
    const wanted = recipe.ei ?? boxIso(recipe.filmId);
    const [lo, hi] = ctx.body.isoRange ?? [wanted, wanted];
    iso = Math.min(Math.max(wanted, lo), hi);
  }

  const [evLo, evHi] = recipeEvRange(recipe);
  const ev = (evLo + evHi) / 2;
  const speeds = shutterSpeeds(ctx.body);
  const shutterSec = nearestStop(speeds, correctShutter(ev, fNumber, iso));

  const focusMm = recipe.focus.kind === "zone" ? hyperfocal(lens.focalMm, fNumber, ctx.cocMm) : Math.max(recipe.focus.distanceMm, lens.minFocusMm);
  return { lensId: lens.id, fNumber, filmId, iso, shutterSec, focusMm, notes };
}

/**
 * How far the current scene is from a recipe's light, in stops of exposure at
 * the recipe's settings (positive = over). Null when the scene is inside the
 * range, within `toleranceEv`.
 */
export function recipeLightMismatch(recipe: Recipe, sceneEv100: number, toleranceEv = 1): { direction: "brighter" | "darker"; stops: number } | null {
  const [lo, hi] = recipeEvRange(recipe);
  if (sceneEv100 > hi + toleranceEv) return { direction: "brighter", stops: sceneEv100 - hi };
  if (sceneEv100 < lo - toleranceEv) return { direction: "darker", stops: lo - sceneEv100 };
  return null;
}

/** Exposure error of a plan in a given scene, in stops (engine). */
export function planExposureError(plan: RecipePlan, sceneEv100: number): number {
  return exposureError(sceneEv100, plan.fNumber, plan.shutterSec, plan.iso);
}
