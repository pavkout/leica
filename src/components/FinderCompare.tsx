import { useState } from "react";
import { FINDER_PROVENANCE, findBody, framelinesFor, rangefinderBodies, type Lens } from "../data/gear";
import { SAMPLE_SCENES } from "../preview/photoScene";
import { finderFieldDeg, frameLineFraction } from "../preview/rangefinder";

interface Props {
  lens: Lens;
  /** A real photo already loaded elsewhere in the app, reused as the shared reference background; falls back to a sample street photo. */
  sceneImageUrl?: string;
}

// The finder window, schematic: its width is the finder's field; frame lines scale against that width.
const W = 300;
const H = 204;
const PAD = 10;

const BODIES = rangefinderBodies();
/** Without a photo picked in the Studio, the finders look at the same street photo. */
const DEFAULT_SCENE = SAMPLE_SCENES.find((s) => s.id === "amsterdam-sun") ?? SAMPLE_SCENES[0];

function FinderDiagram({ bodyId, focalMm, sceneImageUrl, refFieldDeg }: { bodyId: string; focalMm: number; sceneImageUrl: string; refFieldDeg: number }) {
  const body = findBody(bodyId);
  const rf = body.rangefinder!;
  const fieldDeg = finderFieldDeg(rf.magnification);
  const pair = framelinesFor(body, focalMm);
  const clipId = `finder-field-${bodyId}`;
  const fw = W - PAD * 2;
  const cx = W / 2;
  const cy = H / 2;
  // The wider of the two finders fills its window; a higher-magnification finder sees less, so its scene is drawn larger by the true ratio.
  const zoom = Math.tan((refFieldDeg * Math.PI) / 360) / Math.tan((fieldDeg * Math.PI) / 360);
  const iw = fw * zoom;
  const ih = iw / 1.5;

  return (
    <figure className="finder-view">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${body.name} finder at ${rf.magnification}× magnification${pair ? `, with its ${focalMm} mm frame` : `, no ${focalMm} mm frame`}`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD} y={PAD} width={fw} height={H - PAD * 2} rx={10} />
          </clipPath>
        </defs>
        <rect x={0} y={0} width={W} height={H} rx={16} className="finder-housing" />
        <g clipPath={`url(#${clipId})`}>
          <image href={sceneImageUrl} x={cx - iw / 2} y={cy - ih / 2} width={iw} height={ih} preserveAspectRatio="xMidYMid slice" opacity={0.82} />
          <rect x={PAD} y={PAD} width={fw} height={H - PAD * 2} className="finder-glass" />
        </g>
        {pair &&
          (() => {
            const { halfWidthFrac, halfHeightFrac } = frameLineFraction(fieldDeg, focalMm);
            const hw = halfWidthFrac * fw;
            const hh = halfHeightFrac * fw;
            return <rect x={cx - hw} y={cy - hh} width={hw * 2} height={hh * 2} className="finder-frameline" />;
          })()}
        {/* The rangefinder patch, where it sits in every M finder: the centre. */}
        <rect x={cx - 18} y={cy - 12} width={36} height={24} rx={2} className="finder-patch" />
      </svg>
      <figcaption>
        <span className="finder-view-name">{body.name}</span>
        <span className="finder-view-meta">
          {rf.magnification}× · {pair ? `${pair.join("/")} mm frames` : `no ${focalMm} mm frame`}
        </span>
      </figcaption>
    </figure>
  );
}

/** Same lens and reference scene, two finder profiles: framing differences only, nothing else changes. */
export default function FinderCompare({ lens, sceneImageUrl }: Props) {
  const scene = sceneImageUrl ?? DEFAULT_SCENE.image;
  const [bodyAId, setBodyAId] = useState(() => BODIES.find((b) => b.id === "m3")?.id ?? BODIES[0].id);
  const [bodyBId, setBodyBId] = useState(() => BODIES.find((b) => b.id === "m6")?.id ?? BODIES[BODIES.length - 1].id);
  const refFieldDeg = Math.max(finderFieldDeg(findBody(bodyAId).rangefinder!.magnification), finderFieldDeg(findBody(bodyBId).rangefinder!.magnification));

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

      <div className="finder-views">
        <FinderDiagram bodyId={bodyAId} focalMm={lens.focalMm} sceneImageUrl={scene} refFieldDeg={refFieldDeg} />
        <FinderDiagram bodyId={bodyBId} focalMm={lens.focalMm} sceneImageUrl={scene} refFieldDeg={refFieldDeg} />
      </div>

      <p className="hint">
        {FINDER_PROVENANCE.notes} Schematic finder field, not to exact optical scale — it shows how much of the finder a
        lens's frame line occupies at each magnification, not the finder's true shape or brightness.{!sceneImageUrl && ` ${DEFAULT_SCENE.credit}.`}
      </p>
    </section>
  );
}
