import { canSimulate, pieceFor, type TimelineItem } from "../data/timeline";
import { formatShutter } from "../data/gear";
import { localDay } from "../physics/assignment";
import { formatDistance, type Units } from "../utils/format";
import BodyArt from "./gear/BodyArt";
import GearImage from "./gear/GearImage";
import LensArt from "./gear/LensArt";

interface Props {
  units: Units;
  onSimulate: (item: TimelineItem) => void;
  onOpenTimeline: () => void;
}

/**
 * Today in the museum: one camera or lens a day, on its own stage, with its
 * sourced history and an invitation to shoot with it.
 */
export default function MuseumToday({ units, onSimulate, onOpenTimeline }: Props) {
  const today = localDay(new Date());
  const piece = pieceFor(today);
  if (!piece) return null;
  const b = piece.body;
  const l = piece.lens;

  return (
    <section className="panel stage-today" aria-label="Today in the museum">
      <div className="mt-grid">
        <figure className="mt-stage">
          {b ? (
            <GearImage kind="bodies" id={b.id} alt={b.name}>
              <BodyArt body={b} />
            </GearImage>
          ) : l ? (
            <GearImage kind="lenses" id={l.id} alt={l.name}>
              <LensArt lens={l} />
            </GearImage>
          ) : null}
        </figure>
        <div className="mt-card">
          <p className="mt-date">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="mt-year">{piece.year}</p>
          <h2 className="mt-title">{piece.title}</h2>
          <dl className="gen-specs mt-specs">
            {b && (
              <>
                <dt>Format</dt>
                <dd>{b.medium === "film" ? "35 mm film" : `${b.megapixels?.[0]} MP ${b.medium === "mono" ? "monochrome" : "colour"} sensor`}</dd>
                <dt>Shutter</dt>
                <dd>
                  {formatShutter(b.shutter.slowest)} to {formatShutter(b.shutter.fastest)}
                </dd>
                {b.rangefinder && (
                  <>
                    <dt>Finder</dt>
                    <dd>{b.rangefinder.magnification}× rangefinder</dd>
                  </>
                )}
              </>
            )}
            {l && (
              <>
                <dt>Aperture</dt>
                <dd>
                  f/{l.maxAperture} to f/{l.minAperture}
                </dd>
                <dt>Closest focus</dt>
                <dd>{formatDistance(l.minFocusMm, units)}</dd>
              </>
            )}
          </dl>
          {piece.notes.map((n) => (
            <p key={n.id} className="mt-note">
              {n.text}{" "}
              <a href={n.provenance.url} target="_blank" rel="noreferrer" className="museum-source">
                {n.provenance.source}
              </a>
            </p>
          ))}
          <div className="mt-actions">
            {canSimulate(piece) && (
              <button type="button" className="btn btn-red" onClick={() => onSimulate(piece)}>
                Shoot with it today
              </button>
            )}
            <button type="button" className="btn" onClick={onOpenTimeline}>
              The whole timeline
            </button>
          </div>
        </div>
      </div>
      <p className="hint">A new piece every day. Specifications from the catalogue; history notes from the sources linked on each.</p>
    </section>
  );
}
