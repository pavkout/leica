import { useState } from "react";
import type { Lens } from "../data/gear";
import { BREATHING_PROFILES, PERSPECTIVE_SCENE, breathingPercent, focalForSameSubject, imageHeight, project, relativeSize } from "../physics/perspective";
import { formatDistance, type Units } from "../utils/format";
import Segmented from "./Segmented";

interface Props {
  lens: Lens;
  frameWidthMm: number;
  frameHeightMm: number;
  focusMm: number;
  units: Units;
}

const START_DISTANCE = 3;
const FOCALS = [21, 24, 28, 35, 50, 75, 90, 135];
const SUBJECT = PERSPECTIVE_SCENE.find((o) => o.id === "person")!;
const BUILDING = PERSPECTIVE_SCENE.find((o) => o.id === "building")!;
const FILL: Record<string, string> = { building: "#39404c", tree: "#2f4a35", person: "#d9c9b6", post: "#8a8a8a" };

function Frame({ distance, focal, frameW, frameH, ghost }: { distance: number; focal: number; frameW: number; frameH: number; ghost?: { distance: number; focal: number } }) {
  // Sensor mm → SVG units; the frame is 360 × 240, centred on the lens axis.
  const sx = 360 / frameW;
  const sy = 240 / frameH;
  const shapes = (d: number, f: number, cls: string) =>
    PERSPECTIVE_SCENE.map((o) => {
      const base = project(o.base, d, f);
      const top = project({ ...o.base, y: o.height }, d, f);
      const edge = project({ ...o.base, x: o.base.x + o.width / 2 }, d, f);
      if (!base || !top || !edge) return null;
      const w = Math.abs(edge.x - base.x) * 2 * sx;
      const h = Math.abs(top.y - base.y) * sy;
      return <rect key={`${cls}-${o.id}`} className={cls} x={180 + base.x * sx - w / 2} y={120 - top.y * sy} width={w} height={h} fill={cls === "persp-obj" ? FILL[o.id] : "none"} />;
    });
  return (
    <svg className="persp-frame" viewBox="0 0 360 240" role="img" aria-label={`Camera ${distance.toFixed(1)} m from the person with a ${Math.round(focal)} mm lens: the building looks ${relativeSize(BUILDING, SUBJECT, distance).toFixed(1)} times the person's height.`}>
      <rect x={0} y={0} width={360} height={240} fill="#1a1d23" />
      {/* Ground below the horizon, which sits at eye level */}
      <rect x={0} y={120} width={360} height={120} fill="#202329" />
      {shapes(distance, focal, "persp-obj")}
      {ghost && shapes(ghost.distance, ghost.focal, "persp-ghost")}
    </svg>
  );
}

/** Focus breathing / perspective lab (feature #26). */
export default function PerspectiveLab({ lens, frameWidthMm, frameHeightMm, focusMm, units }: Props) {
  const [mode, setMode] = useState<"perspective" | "breathing">("perspective");
  const [distance, setDistance] = useState(START_DISTANCE);
  const [focal, setFocal] = useState(lens.focalMm);
  const [keepSubject, setKeepSubject] = useState(false);
  const [breathFocus, setBreathFocus] = useState(() => (Number.isFinite(focusMm) ? focusMm : 3000));
  const start = { distance: START_DISTANCE, focal: lens.focalMm };
  const targetSubjectMm = imageHeight(SUBJECT, START_DISTANCE, lens.focalMm);
  const shownFocal = keepSubject ? focalForSameSubject(SUBJECT, targetSubjectMm, distance) : focal;
  const identical = Math.abs(distance - start.distance) < 1e-9 && Math.abs(shownFocal - start.focal) < 1e-9;
  const breathing = breathingPercent(BREATHING_PROFILES[lens.id], lens.focalMm, breathFocus);

  return (
    <section className="panel stage-perspective" aria-label="Perspective lab">
      <div className="panel-head">
        <h2>Perspective lab</h2>
        <Segmented
          label="Lab mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "perspective", label: "Perspective" },
            { value: "breathing", label: "Focus breathing" },
          ]}
        />
      </div>

      {mode === "perspective" ? (
        <>
          <p className="muted small">
            Focal length only crops the picture. <strong>Where you stand</strong> decides how big near and far things look next to each other. Dashed outlines show where you started.
          </p>
          <Frame distance={distance} focal={shownFocal} frameW={frameWidthMm} frameH={frameHeightMm} ghost={identical ? undefined : start} />
          <p className="small persp-readout" aria-live="polite">
            The building looks <strong>{relativeSize(BUILDING, SUBJECT, distance).toFixed(1)}×</strong> the person&apos;s height · the person fills {Math.min(999, (imageHeight(SUBJECT, distance, shownFocal) / frameHeightMm) * 100).toFixed(0)}% of the frame height
            {keepSubject ? ` · ${Math.round(shownFocal)} mm (virtual zoom, not a real lens)` : ""}
          </p>

          <label className="field">
            <span>Camera distance from the person · {formatDistance(distance * 1000, units)}</span>
            <input type="range" min={1.2} max={12} step={0.1} value={distance} onChange={(e) => setDistance(Number(e.target.value))} />
          </label>
          {!keepSubject && (
            <div className="field">
              <span>Focal length</span>
              <div className="dial" role="radiogroup" aria-label="Lab focal length">
                {FOCALS.map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={f === focal} className={f === focal ? "dial-step dial-on" : "dial-step"} onClick={() => setFocal(f)}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="persp-actions">
            <label className="small">
              <input type="checkbox" checked={keepSubject} onChange={(e) => setKeepSubject(e.target.checked)} /> Keep the person the same size (dolly zoom)
            </label>
            <button
              type="button"
              className="btn btn-small"
              disabled={identical}
              onClick={() => {
                setDistance(START_DISTANCE);
                setFocal(lens.focalMm);
                setKeepSubject(false);
              }}
            >
              Reset framing
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">
            Some lenses change their angle of view slightly as you focus closer — &ldquo;breathing&rdquo;. How much depends on each lens&apos;s design, so it needs measured data.
          </p>
          <label className="field">
            <span>Focus distance · {formatDistance(breathFocus, units)}</span>
            <input type="range" min={lens.minFocusMm} max={20000} step={50} value={Math.min(Math.max(breathFocus, lens.minFocusMm), 20000)} onChange={(e) => setBreathFocus(Number(e.target.value))} />
          </label>
          <p className="small breathing-readout" aria-live="polite">
            {breathing === null ? (
              <>
                <span className="dna-badge">Not modelled</span> No measured breathing data for the {lens.name}, so no figure is shown rather than a guess.
              </>
            ) : (
              <>Angle of view {breathing >= 0 ? "+" : ""}{breathing.toFixed(1)}% at this distance.</>
            )}
          </p>
        </>
      )}
    </section>
  );
}
