import { useState } from "react";
import type { Body, Lens } from "../data/gear";
import { distanceForField, fieldAtDistance, trialLenses, trialQuery, trialWarnings } from "../physics/lensTrial";
import { formatDistance, formatLength, type Units } from "../utils/format";
import Segmented from "./Segmented";

interface Props {
  body: Body;
  lens: Lens;
  lenses: Lens[];
  frameWidthMm: number;
  frameHeightMm: number;
  /** Starting subject distance (the simulator's focus). */
  focusMm: number;
  sceneId: string;
  fNumber: number;
  units: Units;
  /** Put a lens and subject distance into the simulator. */
  onTry: (lensId: string, distanceMm: number) => void;
}

type Mode = "distance" | "framing";

/** Try Before You Buy (feature #19): framing and practical consequences, lens by lens. */
export default function LensTrial({ body, lens, lenses, frameWidthMm, frameHeightMm, focusMm, sceneId, fNumber, units, onTry }: Props) {
  const [mode, setMode] = useState<Mode>("distance");
  const [distanceMm, setDistanceMm] = useState(() => (Number.isFinite(focusMm) ? Math.min(Math.max(focusMm, 700), 10000) : 3000));
  const [copied, setCopied] = useState<"yes" | "manual" | null>(null);
  const strip = trialLenses(lens, lenses);
  const fmt = (mm: number) => formatDistance(mm, units);
  // Reference framing: what the current lens covers at the subject distance.
  const refField = fieldAtDistance(lens.focalMm, distanceMm, frameWidthMm, frameHeightMm);
  const widest = fieldAtDistance(strip[0].focalMm, distanceMm, frameWidthMm, frameHeightMm);
  const link = `${location.origin}${location.pathname}${trialQuery({ bodyId: body.id, lensId: lens.id, distanceMm, sceneId, fNumber })}`;

  async function share() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("yes");
    } catch {
      setCopied("manual");
    }
  }

  return (
    <section className="panel stage-trial" aria-label="Try before you buy">
      <div className="panel-head">
        <h2>Try before you buy</h2>
        <Segmented
          label="Compare by"
          value={mode}
          onChange={setMode}
          options={[
            { value: "distance", label: "Same distance" },
            { value: "framing", label: "Same framing" },
          ]}
        />
      </div>
      <p className="muted small">
        {mode === "distance"
          ? `What each lens takes in with the subject ${fmt(distanceMm)} away.`
          : `Where to stand for the same framing as the ${lens.focalMm} mm at ${fmt(distanceMm)}.`}
      </p>

      <label className="field">
        <span>Subject distance · {fmt(distanceMm)}</span>
        <input type="range" min={700} max={10000} step={50} value={distanceMm} onChange={(e) => setDistanceMm(Number(e.target.value))} />
      </label>

      {mode === "distance" && (
        <svg className="trial-frames" viewBox="0 0 300 200" role="img" aria-label={`Nested frames: what ${strip.map((l) => `${l.focalMm} mm`).join(", ")} cover at ${fmt(distanceMm)}`}>
          {strip.map((l, i) => {
            const f = fieldAtDistance(l.focalMm, distanceMm, frameWidthMm, frameHeightMm);
            const w = (f.w / widest.w) * 290;
            const h = (f.h / widest.h) * 190;
            const on = l.id === lens.id;
            // Alternate label corners (inside top-left, just outside bottom-right): neighbouring frames
            // such as 75 and 90 are close in size, so same-corner labels would collide.
            const topLeft = i % 2 === 0;
            return (
              <g key={l.id}>
                <rect x={150 - w / 2} y={100 - h / 2} width={w} height={h} className={on ? "trial-frame trial-frame-on" : "trial-frame"} />
                <text
                  x={topLeft ? 150 - w / 2 + 4 : 150 + w / 2 - 4}
                  y={topLeft ? 100 - h / 2 + 12 : 100 + h / 2 + 11}
                  textAnchor={topLeft ? "start" : "end"}
                  className="trial-frame-label"
                >
                  {l.focalMm}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      <ul className="trial-list">
        {strip.map((l) => {
          const f = fieldAtDistance(l.focalMm, distanceMm, frameWidthMm, frameHeightMm);
          const stand = distanceForField(l.focalMm, refField.w, frameWidthMm);
          const warnings = trialWarnings(l, body, mode === "distance" ? distanceMm : stand, fmt);
          return (
            <li key={l.id} className={l.id === lens.id ? "trial-row trial-row-on" : "trial-row"}>
              <div className="trial-row-head">
                <span className="gear-name trial-name">
                  {l.focalMm} mm <span className="muted small">{l.name}</span>
                </span>
                <button type="button" className="btn btn-small" onClick={() => onTry(l.id, mode === "distance" ? distanceMm : stand)} aria-label={`Try the ${l.name}`}>
                  {l.id === lens.id ? "On camera" : "Try"}
                </button>
              </div>
              <p className="small">
                {mode === "distance" ? `Covers ${formatLength(f.w, units)} × ${formatLength(f.h, units)}` : `Stand at ${fmt(stand)}`}
                {mode === "framing" && l.id === lens.id && " (reference)"}
              </p>
              {warnings.map((w) => (
                <p key={w.kind} className="warn-text small">
                  {w.text}
                </p>
              ))}
            </li>
          );
        })}
      </ul>

      <div className="trial-share">
        <button type="button" className="btn btn-small" onClick={() => void share()}>
          {copied === "yes" ? "Link copied" : "Share this setup"}
        </button>
        {copied === "manual" && (
          <label className="field">
            <span>Copy this link</span>
            <input type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
        )}
      </div>
      <p className="muted small">Framing is calculated from focal length, frame size and distance. Warnings state facts about fit, focus and finder only.</p>
    </section>
  );
}
