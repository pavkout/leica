import { useState } from "react";
import { framelinesFor, type Body, type Lens } from "../data/gear";
import { TRIPS, analyseKit, recommendPair, type TripId } from "../physics/kitPlan";
import LensArt from "./gear/LensArt";
import GearImage from "./gear/GearImage";
import Segmented from "./Segmented";

interface Props {
  body: Body;
  /** Every lens that fits the body. */
  lenses: Lens[];
  /** Lenses saved in My Leica Bag: the kit starts from these. */
  bagLensIds: Set<string>;
  currentLensId: string;
  onMount: (lensId: string) => void;
}

/**
 * Plan the bag for a trip: pick what you own, see what's covered, what's
 * missing and what doubles up, and which two lenses to take. Weight isn't in
 * the lens catalogue, so it isn't guessed.
 */
export default function KitPlanner({ body, lenses, bagLensIds, currentLensId, onMount }: Props) {
  const [tripId, setTripId] = useState<TripId>("city");
  const trip = TRIPS.find((t) => t.id === tripId)!;
  const [kitIds, setKitIds] = useState<Set<string>>(() => {
    const fromBag = lenses.filter((l) => bagLensIds.has(l.id)).map((l) => l.id);
    return new Set(fromBag.length ? fromBag : [currentLensId]);
  });
  const [source, setSource] = useState<"kit" | "catalogue">("kit");

  const kit = lenses.filter((l) => kitIds.has(l.id));
  const report = analyseKit(body, kit, trip);
  const pool = source === "kit" && kit.length >= 1 ? kit : lenses;
  const pair = recommendPair(body, pool, trip);

  function toggle(id: string) {
    setKitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const bandLabel = ([lo, hi]: [number, number]) => (lo === hi ? `${lo} mm` : `${lo}–${hi} mm`);

  return (
    <section className="panel stage-kit" aria-label="Kit planner">
      <div className="field">
        <span>The trip</span>
        <Segmented label="Trip" value={tripId} onChange={setTripId} options={TRIPS.map((t) => ({ value: t.id, label: t.label }))} />
        <p className="muted small">{trip.need}</p>
      </div>

      <div className="kit-grid">
        <div>
          <h3 className="kit-h">What you own</h3>
          <p className="muted small">Tick the lenses you have for the {body.name}. Saved lenses from My Leica Bag start ticked.</p>
          <ul className="kit-owned">
            {lenses.map((l) => (
              <li key={l.id}>
                <label>
                  <input type="checkbox" checked={kitIds.has(l.id)} onChange={() => toggle(l.id)} />
                  <span className="kit-lens-name">{l.name}</span>
                  <span className="kit-lens-meta">
                    {l.focalMm} mm · f/{l.maxAperture}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="kit-report">
          <h3 className="kit-h">Your kit for {trip.label.toLowerCase()}</h3>
          {kit.length === 0 ? (
            <p className="muted">Tick at least one lens to see how your kit covers this trip.</p>
          ) : (
            <>
              <ol className="kit-scale" aria-label="Focal lengths in your kit">
                {report.focals.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
              <ul className="kit-findings">
                {trip.bands.map((b, i) => (
                  <li key={i} className={report.covers[i] ? "kit-ok" : "kit-miss"}>
                    {report.covers[i] ? `Covered: ${bandLabel(b)}` : `Missing: nothing in ${bandLabel(b)}`}
                  </li>
                ))}
                {report.gaps.map(([a, b]) => (
                  <li key={`g${a}`} className="kit-miss">
                    A big jump from {a} to {b} mm: nothing for the framings in between.
                  </li>
                ))}
                {report.overlaps.map(([a, b]) => (
                  <li key={`o${a.id}${b.id}`} className="kit-note">
                    {a.name} and {b.name} do nearly the same job: take one.
                  </li>
                ))}
                {report.noFrameline.map((l) => (
                  <li key={`f${l.id}`} className="kit-note">
                    The {body.name}&apos;s finder has no {l.focalMm} mm frame lines: frame with an accessory finder.
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="kit-pick">
        <div className="kit-pick-head">
          <h3 className="kit-h">Take these two</h3>
          <Segmented
            label="Recommend from"
            value={source}
            onChange={setSource}
            options={[
              { value: "kit", label: "What I own" },
              { value: "catalogue", label: "Any lens" },
            ]}
          />
        </div>
        <div className="kit-pair">
          {pair.map((l, i) => (
            <article key={i} className="kit-choice">
              <p className="kit-choice-job">{bandLabel(trip.bands[i])}</p>
              {l ? (
                <>
                  <GearImage kind="lenses" id={l.id} alt="" className="kit-choice-art">
                    <LensArt lens={l} />
                  </GearImage>
                  <p className="kit-choice-name">{l.name}</p>
                  <p className="muted small">
                    {body.rangefinder ? (framelinesFor(body, l.focalMm) ? `Frame lines ${framelinesFor(body, l.focalMm)!.join("/")}` : "No frame lines in this finder") : `${l.year}`}
                  </p>
                  <button type="button" className="btn btn-small" disabled={l.id === currentLensId} onClick={() => onMount(l.id)}>
                    {l.id === currentLensId ? "On the camera" : "Put it on the camera"}
                  </button>
                </>
              ) : (
                <p className="muted small">
                  {source === "kit" ? "Nothing you own fits this job. Try “Any lens” to see what would." : "No lens for this body fits this job."}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>

      <p className="hint">
        Trip pairings are rules of thumb (the focal lengths photographers commonly pair), not Leica advice. Weight isn&apos;t in the lens catalogue,
        so it isn&apos;t shown. Frame lines are from the body&apos;s published finder specification.
      </p>
    </section>
  );
}
