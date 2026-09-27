import { useState } from "react";
import { formatShutter, type Body, type Lens } from "../data/gear";
import { RECIPES, recipeEvRange, recipeLink, type Recipe } from "../data/recipes";
import { recipeLightMismatch, recipePlan, type RecipeContext } from "../physics/recipes";
import { findFilm } from "../preview/film";
import { formatDistance, type Units } from "../utils/format";
import Segmented from "./Segmented";

interface Props {
  body: Body;
  lens: Lens;
  lenses: Lens[];
  lockedFilm: RecipeContext["lockedFilm"];
  cocMm: number;
  sceneEv100: number;
  sceneLabel: string;
  units: Units;
  active: { id: string; notes: string[] } | null;
  saved: Set<string>;
  onToggleSaved: (id: string) => void;
  onLoad: (recipe: Recipe) => void;
}

const boxIso = (id: string) => findFilm(id).iso;

/** Photo Recipes (feature #28): explainable starting setups, loaded into the simulator in one tap. */
export default function RecipesPanel({ body, lens, lenses, lockedFilm, cocMm, sceneEv100, sceneLabel, units, active, saved, onToggleSaved, onLoad }: Props) {
  const [filter, setFilter] = useState<"all" | "saved">("all");
  const [copied, setCopied] = useState<string | null>(null);
  const ctx: RecipeContext = { body, lens, lenses, lockedFilm, cocMm };
  const shown = RECIPES.filter((r) => filter === "all" || saved.has(r.id));
  const activeRecipe = RECIPES.find((r) => r.id === active?.id);
  const mismatch = activeRecipe ? recipeLightMismatch(activeRecipe, sceneEv100) : null;

  async function share(id: string) {
    const url = recipeLink(id);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
    } catch {
      // Clipboard can be blocked (permissions, insecure context): show the link to copy by hand.
      setCopied(`manual:${id}`);
    }
  }

  return (
    <section className="panel stage-recipes" aria-label="Photo recipes">
      <div className="panel-head">
        <h2>Photo recipes</h2>
        <Segmented
          label="Show recipes"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "saved", label: "Saved" },
          ]}
        />
      </div>
      <p className="muted small">Starting points, not guaranteed exposures. Load one, then change the scene and see what breaks. Shutter speeds are calculated for your camera from each recipe&apos;s light.</p>

      {activeRecipe && (
        <div className="recipe-status" aria-live="polite">
          <p className="small">
            Loaded: <strong>{activeRecipe.title}</strong>
          </p>
          {active!.notes.map((n) => (
            <p key={n} className="muted small">
              {n}
            </p>
          ))}
          {mismatch && (
            <p className="warn-text small">
              {sceneLabel}: the scene is {mismatch.stops.toFixed(0)} stops {mismatch.direction} than this recipe&apos;s light (EV {recipeEvRange(activeRecipe).join("–")}). At these settings the picture would come out{" "}
              {mismatch.direction === "darker" ? "under" : "over"}exposed — adjust, or pick a recipe for this light.
            </p>
          )}
        </div>
      )}

      {shown.length === 0 && <p className="muted small">No saved recipes yet — tap ☆ on a recipe to keep it here.</p>}
      <ul className="recipe-list">
        {shown.map((r) => {
          const plan = recipePlan(r, ctx, boxIso);
          const planLens = lenses.find((l) => l.id === plan.lensId) ?? lens;
          const film = findFilm(r.filmId);
          const [lo, hi] = recipeEvRange(r);
          return (
            <li key={r.id} className={active?.id === r.id ? "recipe recipe-on" : "recipe"}>
              <div className="recipe-head">
                <span className="gear-name recipe-title">{r.title}</span>
                <button type="button" className="recipe-star" aria-pressed={saved.has(r.id)} aria-label={saved.has(r.id) ? `Remove ${r.title} from saved recipes` : `Save ${r.title}`} onClick={() => onToggleSaved(r.id)}>
                  {saved.has(r.id) ? "★" : "☆"}
                </button>
              </div>
              <p className="muted small">
                {r.situation} · EV {lo === hi ? lo : `${lo}–${hi}`}
              </p>
              <p className="small recipe-settings">
                {planLens.focalMm} mm · {body.medium === "film" ? `${film.name}${r.ei ? ` at EI ${r.ei}` : ""}` : `ISO ${plan.iso}`} · f/{plan.fNumber} · {formatShutter(plan.shutterSec)} s (calculated) ·{" "}
                {r.focus.kind === "zone" ? `zone focus at ${formatDistance(plan.focusMm, units)}` : `focus ${formatDistance(plan.focusMm, units)}`}
              </p>
              <details className="recipe-why">
                <summary>Why this works</summary>
                <p className="small">{r.why}</p>
              </details>
              <div className="recipe-actions">
                <button type="button" className="btn btn-small btn-red" onClick={() => onLoad(r)}>
                  Load
                </button>
                <button type="button" className="btn btn-small" onClick={() => void share(r.id)}>
                  {copied === r.id ? "Link copied" : "Share link"}
                </button>
              </div>
              {copied === `manual:${r.id}` && (
                <label className="field recipe-link">
                  <span>Copy this link</span>
                  <input type="text" readOnly value={recipeLink(r.id)} onFocus={(e) => e.currentTarget.select()} />
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
