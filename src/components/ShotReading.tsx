import { explainShot } from "../physics/explainShot";
import type { Shot } from "../physics/model";
import { formatDistance, formatLength, type Units } from "../utils/format";

interface Props {
  shot: Shot;
  stops: number[];
  units: Units;
  onAperture: (n: number) => void;
  onFocus: (mm: number) => void;
}

/**
 * Studio's explanation (#37 follow-up): what's sharp, how the subject and the
 * background read, and one next step you can apply with a tap. Recomputed
 * from the optics on every change, so it moves with the rings.
 */
export default function ShotReading({ shot, stops, units, onAperture, onFocus }: Props) {
  const fmt = (mm: number) => formatDistance(mm, units);
  const r = explainShot(shot, stops, fmt);
  const { dof } = shot;
  const tiles = [
    { label: "Near", value: fmt(dof.nearMm) },
    { label: "Far", value: fmt(dof.farMm) },
    { label: "Depth", value: formatLength(dof.totalMm, units) },
    { label: "Hyperfocal", value: fmt(dof.hyperfocalMm) },
  ];
  return (
    <section className="panel readouts stage-reading" aria-label="Depth of field">
      <p className="reading-zone" aria-live="polite">
        {r.zone}
      </p>
      <p className="reading-line">
        <span className={`reading-dot ${shot.subjectSharp ? "reading-dot-in" : "reading-dot-out"}`} aria-hidden="true" />
        {r.subject}
      </p>
      <p className="reading-line">
        <span className={`reading-dot reading-dot-${r.look.replace(" ", "-")}`} aria-hidden="true" />
        {r.background}
      </p>
      <div className="reading-next">
        <p>{r.suggestion.text}</p>
        {r.suggestion.action && (
          <button
            type="button"
            className="btn btn-small btn-red"
            onClick={() => {
              const a = r.suggestion.action!;
              if (a.fNumber !== undefined) onAperture(a.fNumber);
              if (a.focusMm !== undefined) onFocus(a.focusMm);
            }}
          >
            {r.suggestion.action.label}
          </button>
        )}
      </div>
      <div className="tiles reading-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="tile">
            <span className="tile-label">{t.label}</span>
            <span className="tile-value">{t.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
