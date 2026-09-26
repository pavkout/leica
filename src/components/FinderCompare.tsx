import { useState } from "react";
import { FINDER_PROVENANCE, findBody, framelinesFor, rangefinderBodies, type Lens } from "../data/gear";
import { finderFieldDeg, frameLineFraction } from "../preview/rangefinder";

interface Props {
  lens: Lens;
  /** A real photo already loaded elsewhere in the app, reused as the shared reference background; falls back to a plain grid when none is loaded. */
  sceneImageUrl?: string;
}

const SIZE = 168;
const CENTER = SIZE / 2;
const FIELD_R = 78;
const FIELD_DIAMETER = FIELD_R * 2;

const BODIES = rangefinderBodies();

function FinderDiagram({ bodyId, focalMm, sceneImageUrl }: { bodyId: string; focalMm: number; sceneImageUrl?: string }) {
  const body = findBody(bodyId);
  const rf = body.rangefinder!;
  const fieldDeg = finderFieldDeg(rf.magnification);
  const pair = framelinesFor(body, focalMm);
  const clipId = `finder-field-${bodyId}`;

  return (
    <figure className="iris-diagram">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${body.name} finder at ${rf.magnification}× magnification`}>
        <defs>
          <clipPath id={clipId}>
            <circle cx={CENTER} cy={CENTER} r={FIELD_R} />
          </clipPath>
        </defs>
        <circle cx={CENTER} cy={CENTER} r={FIELD_R} className="iris-barrel" />
        <g clipPath={`url(#${clipId})`}>
          {sceneImageUrl ? (
            <image href={sceneImageUrl} x={CENTER - FIELD_R} y={CENTER - FIELD_R} width={FIELD_DIAMETER} height={FIELD_DIAMETER} preserveAspectRatio="xMidYMid slice" opacity={0.75} />
          ) : (
            <g className="finder-grid" opacity={0.5}>
              {[1, 2].map((i) => (
                <line key={`v${i}`} x1={CENTER - FIELD_R + (FIELD_DIAMETER * i) / 3} y1={CENTER - FIELD_R} x2={CENTER - FIELD_R + (FIELD_DIAMETER * i) / 3} y2={CENTER + FIELD_R} />
              ))}
              {[1, 2].map((i) => (
                <line key={`h${i}`} x1={CENTER - FIELD_R} y1={CENTER - FIELD_R + (FIELD_DIAMETER * i) / 3} x2={CENTER + FIELD_R} y2={CENTER - FIELD_R + (FIELD_DIAMETER * i) / 3} />
              ))}
            </g>
          )}
        </g>
        {pair &&
          (() => {
            const { halfWidthFrac, halfHeightFrac } = frameLineFraction(fieldDeg, focalMm);
            const hw = halfWidthFrac * FIELD_DIAMETER;
            const hh = halfHeightFrac * FIELD_DIAMETER;
            return <rect x={CENTER - hw} y={CENTER - hh} width={hw * 2} height={hh * 2} className="finder-frameline" />;
          })()}
      </svg>
      <figcaption className="muted small">
        {body.name} · {rf.magnification}× {pair ? `· ${pair.join("/")} mm frames` : `· no ${focalMm} mm frame`}
      </figcaption>
    </figure>
  );
}

/** Same lens and reference scene, two finder profiles: framing differences only, nothing else changes. */
export default function FinderCompare({ lens, sceneImageUrl }: Props) {
  const [bodyAId, setBodyAId] = useState(() => BODIES.find((b) => b.id === "m3")?.id ?? BODIES[0].id);
  const [bodyBId, setBodyBId] = useState(() => BODIES.find((b) => b.id === "m6")?.id ?? BODIES[BODIES.length - 1].id);

  return (
    <section className="panel stage-finder-compare" aria-label="Finder comparison">
      <div className="panel-head">
        <h2>Finder comparison</h2>
      </div>

      <p className="muted small">
        Same {lens.name} and reference scene, side by side through two finders — only the finder geometry changes; the
        rest of this app still uses your actual camera.
      </p>

      <div className="finder-compare-pickers">
        {(
          [
            ["A", bodyAId, setBodyAId],
            ["B", bodyBId, setBodyBId],
          ] as const
        ).map(([label, value, setValue]) => (
          <label key={label} className="field field-narrow">
            <span>Body {label}</span>
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              {BODIES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.rangefinder!.magnification}×
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="iris-diagrams">
        <FinderDiagram bodyId={bodyAId} focalMm={lens.focalMm} sceneImageUrl={sceneImageUrl} />
        <FinderDiagram bodyId={bodyBId} focalMm={lens.focalMm} sceneImageUrl={sceneImageUrl} />
      </div>

      <p className="hint">
        {FINDER_PROVENANCE.notes} Schematic finder field, not to exact optical scale — it shows how much of the finder a
        lens's frame line occupies at each magnification, not the finder's true shape or brightness.
      </p>
    </section>
  );
}
