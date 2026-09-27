// Photo Recipes (feature #28): explainable starting setups, as content plus
// constraints. A recipe never stores a shutter speed: it's calculated from the
// recipe's light (EV, from the same published EV guide the Sunny 16 trainer
// uses), aperture and ISO by the shared exposure engine when it's loaded. The
// copy is framed as a starting point, not a guaranteed exposure.

import { LIGHT_CONDITIONS } from "../physics/sunny16";

export type FocusStrategy = { kind: "zone" } | { kind: "subject"; distanceMm: number };

export interface Recipe {
  id: string;
  title: string;
  situation: string;
  focalMm: number;
  /** Film for film bodies (catalogue id); its box speed is also the digital ISO. */
  filmId: string;
  /** Exposure index if the film is pushed (film bodies); omitted = box speed. */
  ei?: number;
  fNumber: number;
  focus: FocusStrategy;
  /** Light the recipe is meant for, as EV at ISO 100 — ids from the EV guide. */
  lightIds: string[];
  why: string;
}

export const RECIPES: Recipe[] = [
  {
    id: "sunny-street",
    title: "Sunny street, zone focus",
    situation: "Bright sun, people moving through the frame",
    focalMm: 35,
    filmId: "trix400",
    fNumber: 11,
    focus: { kind: "zone" },
    lightIds: ["sunny16", "hazy11"],
    why: "At f/11 a 35 mm lens set to its zone-focus distance keeps everything from a few metres to infinity acceptably sharp, so you can shoot without focusing. The fast shutter this light allows freezes walking people.",
  },
  {
    id: "overcast-street",
    title: "Overcast street",
    situation: "Flat, soft daylight — forgiving for faces and shadows",
    focalMm: 35,
    filmId: "hp5",
    fNumber: 5.6,
    focus: { kind: "zone" },
    lightIds: ["cloudy-bright8", "cloudy-dull56"],
    why: "Overcast light costs two to three stops against full sun. f/5.6 still gives a usable zone on a 35 mm while keeping the shutter fast enough to hand-hold and stop casual movement.",
  },
  {
    id: "window-portrait",
    title: "Window-light portrait",
    situation: "Indoors, subject beside a window",
    focalMm: 50,
    filmId: "portra400",
    fNumber: 2,
    focus: { kind: "subject", distanceMm: 1200 },
    lightIds: ["interior"],
    why: "Window light is several stops dimmer than outdoors. Opening to f/2 keeps the shutter hand-holdable and throws the room behind the subject out of focus. Focus on the near eye: at f/2 and 1.2 m the sharp zone is only a few centimetres deep.",
  },
  {
    id: "golden-hour",
    title: "Golden hour, open shade",
    situation: "Low sun or open shade, warm directional light",
    focalMm: 50,
    filmId: "portra400",
    fNumber: 4,
    focus: { kind: "subject", distanceMm: 3000 },
    lightIds: ["sunset", "open-shade"],
    why: "The light drops fast near sunset. f/4 on a 50 mm separates a subject at 3 m from the background while leaving some depth for a slightly moving subject; colour negative film forgives a stop of error either way.",
  },
  {
    id: "dusk-street",
    title: "City at dusk, pushed film",
    situation: "Streetlights and shopfronts, no daylight left",
    focalMm: 35,
    filmId: "trix400",
    ei: 1600,
    fNumber: 2,
    focus: { kind: "subject", distanceMm: 3000 },
    lightIds: ["dusk-street"],
    why: "Rating 400-speed film at EI 1600 (two stops push, developed longer) buys the shutter speed dusk takes away. At f/2 the zone is shallow, so pre-focus on the distance where your subject will be.",
  },
  {
    id: "night-street",
    title: "Night street",
    situation: "Little light, and what there is is uneven",
    focalMm: 50,
    filmId: "delta3200",
    fNumber: 1.4,
    focus: { kind: "subject", distanceMm: 2500 },
    // City nights run from sodium-lit side streets (EV 3) to lit shopfronts (EV 5).
    lightIds: ["night-street", "dusk-street"],
    why: "Night asks for everything at once: the fastest film, the widest aperture and a shutter near the limit of hand-holding. Brace yourself, shoot on the exhale, and expect some frames to be soft — that's part of the look.",
  },
];

/** EV range a recipe is meant for, from its light conditions. */
export function recipeEvRange(recipe: Recipe): [number, number] {
  const evs = recipe.lightIds.map((id) => {
    const c = LIGHT_CONDITIONS.find((l) => l.id === id);
    if (!c) throw new Error(`Recipe ${recipe.id}: unknown light "${id}"`);
    return c.ev100;
  });
  return [Math.min(...evs), Math.max(...evs)];
}

export function findRecipe(id: string | null | undefined): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** A shareable link that opens the app with this recipe loaded. */
export function recipeLink(id: string, loc: Pick<Location, "origin" | "pathname"> = location): string {
  return `${loc.origin}${loc.pathname}?recipe=${encodeURIComponent(id)}`;
}
