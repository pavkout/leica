import { useCallback, useEffect, useRef, useState } from "react";
import { formatShutter } from "../data/gear";
import { MOTION_ARCHETYPES, MOTION_PROVENANCE, angularBlurMm, blurBand, blurRatio, motionResult, trailSamples } from "../physics/motion";
import { shakeBlurMm } from "../physics/exposure";
import { formatDistance, type Units } from "../utils/format";

interface Props {
  focalMm: number;
  cocMm: number;
  /** Marked shutter speeds of the body, slowest first or any order. */
  shutters: number[];
  shutterSec: number;
  /** The app's shutter setter: the simulator shares the camera's shutter speed. */
  onShutter: (sec: number) => void;
  /** On a tripod there's no camera shake. */
  tripod: boolean;
  units: Units;
}

/** The picture is drawn this many circles of confusion wide (an enlargement, like judging a print). */
const PICTURE_WIDTH_IN_COC = 120;

const BAND_TEXT = { frozen: "frozen", slight: "slightly soft", visible: "visibly blurred", streaked: "streaked" } as const;
const CUSTOM = "custom";

type Shape = "person" | "cyclist" | "car" | "train";
const SHAPES: Record<string, Shape> = { walk: "person", cyclist: "cyclist", car: "car", train: "train", [CUSTOM]: "person" };

/** roundRect needs Safari 16+; older browsers get square corners rather than an error. */
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof g.roundRect === "function") g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

function drawSubject(g: CanvasRenderingContext2D, shape: Shape, x: number, ground: number, h: number) {
  g.beginPath();
  if (shape === "person") {
    g.arc(x, ground - h * 0.92, h * 0.08, 0, Math.PI * 2);
    rr(g, x - h * 0.09, ground - h * 0.82, h * 0.18, h * 0.45, h * 0.06);
    g.rect(x - h * 0.08, ground - h * 0.4, h * 0.06, h * 0.4);
    g.rect(x + h * 0.02, ground - h * 0.4, h * 0.06, h * 0.4);
  } else if (shape === "cyclist") {
    g.arc(x - h * 0.3, ground - h * 0.18, h * 0.18, 0, Math.PI * 2);
    g.moveTo(x + h * 0.48, ground - h * 0.18);
    g.arc(x + h * 0.3, ground - h * 0.18, h * 0.18, 0, Math.PI * 2);
    g.rect(x - h * 0.08, ground - h * 0.85, h * 0.16, h * 0.55);
    g.arc(x, ground - h * 0.95, h * 0.08, 0, Math.PI * 2);
  } else if (shape === "car") {
    rr(g, x - h * 0.9, ground - h * 0.45, h * 1.8, h * 0.3, h * 0.06);
    rr(g, x - h * 0.5, ground - h * 0.68, h * 1.0, h * 0.25, h * 0.08);
    g.arc(x - h * 0.55, ground - h * 0.12, h * 0.12, 0, Math.PI * 2);
    g.moveTo(x + h * 0.67, ground - h * 0.12);
    g.arc(x + h * 0.55, ground - h * 0.12, h * 0.12, 0, Math.PI * 2);
  } else {
    rr(g, x - h * 1.6, ground - h * 0.8, h * 3.2, h * 0.7, h * 0.08);
  }
  g.fill();
}

/** Motion Simulator (feature #8): subject motion vs camera shake, rendered by accumulating the exposure. */
export default function MotionSimulator({ focalMm, cocMm, shutters, shutterSec: cameraShutterSec, onShutter, tripod, units }: Props) {
  const [archetype, setArchetype] = useState("walk");
  const [customDegPerSec, setCustomDegPerSec] = useState(10);
  const [distanceMm, setDistanceMm] = useState(5000);
  const [subjectOn, setSubjectOn] = useState(true);
  const [shakeOn, setShakeOn] = useState(true);
  const [dragging, setDragging] = useState(false);
  // While the slider is dragged the panel previews a draft speed and commits it to the camera on release:
  // committing every step re-rendered the whole app (including the WebGL photo preview) per step.
  const [draftSec, setDraftSec] = useState<number | null>(null);
  const shutterSec = draftSec ?? cameraShutterSec;
  const commit = () => {
    if (draftSec !== null) onShutter(draftSec);
    setDraftSec(null);
    setDragging(false);
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useRef(0);

  const speeds = [...shutters].sort((a, b) => b - a); // slowest first: slider left = slow
  const idx = Math.max(0, speeds.findIndex((t) => Math.abs(Math.log(t / shutterSec)) < 0.2));
  const shakeActive = shakeOn && !tripod;
  const arch = MOTION_ARCHETYPES.find((a) => a.id === archetype);
  const r = arch
    ? motionResult({ speedMps: arch.speedMps, shutterSec, focalMm, distanceMm, cocMm, subjectMotion: subjectOn, cameraShake: shakeActive })
    : (() => {
        const subject = subjectOn ? angularBlurMm(customDegPerSec, shutterSec, focalMm) : 0;
        const shake = shakeActive ? shakeBlurMm(shutterSec, focalMm) : 0;
        return { subjectBlurMm: subject, shakeBlurMm: shake, subjectRatio: blurRatio(subject, cocMm), shakeRatio: blurRatio(shake, cocMm) };
      })();

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * dpr)) c.width = Math.round(w * dpr);
    if (c.height !== Math.round(h * dpr)) c.height = Math.round(h * dpr);
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = "#1b1d22";
    g.fillRect(0, 0, w, h);

    // Streaks are drawn relative to the circle of confusion, enlarged so the continuum shows on a
    // phone: one circle of confusion ≈ 1/120 of this picture's width. At true scale across a whole
    // 36 mm frame a clearly blurred walker would be ~4 px here. The numbers below are unscaled.
    const pxPerCoc = w / PICTURE_WIDTH_IN_COC;
    const subjectPx = r.subjectRatio * pxPerCoc;
    const shakePx = r.shakeRatio * pxPerCoc;
    const nShake = shakePx > 0.5 ? trailSamples(shakePx, dragging) : 1;
    const nSubject = subjectPx > 0.5 ? Math.max(1, Math.floor(trailSamples(subjectPx, dragging) / Math.sqrt(nShake))) : 1;
    const ground = h * 0.82;
    const shape = SHAPES[archetype];
    const size = shape === "train" ? h * 0.35 : shape === "car" ? h * 0.3 : h * 0.42;

    // Accumulate the exposure: every shake offset draws the whole scene; within it, every subject position.
    for (let i = 0; i < nShake; i++) {
      const sOff = nShake === 1 ? 0 : (i / (nShake - 1) - 0.5) * shakePx;
      const sx = sOff * Math.cos(0.6);
      const sy = sOff * Math.sin(0.6);
      g.globalAlpha = 1 / nShake;
      g.fillStyle = "#2a2d34";
      for (let k = 0; k < 7; k++) g.fillRect(sx + (w * (k + 0.5)) / 7 - 3, sy + h * 0.18, 6, ground - h * 0.18); // poles: show shake
      g.fillStyle = "#3a3d44";
      g.fillRect(sx, sy + ground, w, 2);
      g.fillStyle = "#e9e6df";
      for (let j = 0; j < nSubject; j++) {
        g.globalAlpha = 1 / (nShake * nSubject) + (nSubject === 1 ? 0 : 0.02);
        const x = w * 0.5 + (nSubject === 1 ? 0 : (j / (nSubject - 1) - 0.5) * subjectPx);
        drawSubject(g, shape, x + sx, ground + sy, size);
      }
    }
    g.globalAlpha = 1;
  }, [r.subjectRatio, r.shakeRatio, dragging, archetype]);

  useEffect(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(draw);
    const c = canvasRef.current;
    if (!c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(draw);
    });
    ro.observe(c);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [draw]);

  const subjectBand = blurBand(r.subjectRatio);
  const shakeBand = blurBand(r.shakeRatio);
  const pos = (ratio: number) => `${Math.min(100, Math.max(0, (Math.log10(Math.max(ratio, 0.1)) + 1) * 33.3))}%`;

  return (
    <section className="panel stage-motion" aria-label="Motion simulator">
      <div className="panel-head">
        <h2>Motion simulator</h2>
      </div>
      <p className="muted small">Subject movement and camera shake blur a picture in different ways. Change the shutter speed and see both, separately.</p>

      <div className="field">
        <span>Subject</span>
        <div className="dial" role="radiogroup" aria-label="Moving subject">
          {[...MOTION_ARCHETYPES.map((a) => ({ id: a.id, label: a.label })), { id: CUSTOM, label: "Custom angular speed" }].map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={archetype === a.id} className={archetype === a.id ? "dial-step dial-on" : "dial-step"} onClick={() => setArchetype(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} className="motion-canvas" role="img" aria-label={`A ${arch?.label.toLowerCase() ?? "subject"} at ${formatShutter(shutterSec)} s: subject ${BAND_TEXT[subjectBand]}, camera shake ${BAND_TEXT[shakeBand]}.`} />

      <div className="motion-controls">
        <label className="field">
          <span>Shutter speed · {formatShutter(shutterSec)} s</span>
          <input
            type="range"
            min={0}
            max={speeds.length - 1}
            step={1}
            value={idx}
            onChange={(e) => {
              const t = speeds[Number(e.target.value)];
              if (dragging) setDraftSec(t);
              else onShutter(t);
            }}
            onPointerDown={() => setDragging(true)}
            onPointerUp={commit}
            onPointerCancel={commit}
            onBlur={commit}
            aria-valuetext={`${formatShutter(shutterSec)} s`}
          />
        </label>
        {arch ? (
          <label className="field">
            <span>Distance to subject · {formatDistance(distanceMm, units)}</span>
            <input type="range" min={1000} max={30000} step={250} value={distanceMm} onChange={(e) => setDistanceMm(Number(e.target.value))} />
          </label>
        ) : (
          <label className="field">
            <span>Angular speed · {customDegPerSec}°/s</span>
            <input type="range" min={1} max={90} step={1} value={customDegPerSec} onChange={(e) => setCustomDegPerSec(Number(e.target.value))} />
          </label>
        )}
      </div>

      <div className="motion-toggles">
        <label className="small">
          <input type="checkbox" checked={subjectOn} onChange={(e) => setSubjectOn(e.target.checked)} /> Subject moves
        </label>
        <label className="small">
          <input type="checkbox" checked={shakeActive} disabled={tripod} onChange={(e) => setShakeOn(e.target.checked)} /> Camera shake{tripod ? " (off: on a tripod)" : ""}
        </label>
      </div>

      <div className="motion-readout" aria-live="polite">
        {[
          ["Subject", r.subjectBlurMm, r.subjectRatio, subjectBand, subjectOn],
          ["Camera shake", r.shakeBlurMm, r.shakeRatio, shakeBand, shakeActive],
        ].map(([label, mm, ratio, band, on]) => (
          <div key={label as string} className="motion-row">
            <span className="small">
              {label as string}: {on ? `${(mm as number).toFixed(3)} mm on the sensor — ${(ratio as number).toFixed(1)}× the circle of confusion, ${BAND_TEXT[band as keyof typeof BAND_TEXT]}` : "off"}
            </span>
            {on ? (
              <div className="motion-scale" aria-hidden="true">
                <span className="motion-marker" style={{ left: pos(ratio as number) }} />
              </div>
            ) : null}
          </div>
        ))}
        <p className="muted small">
          A continuum, not a verdict: frozen · slightly soft · visibly blurred · streaked. Streaks are drawn enlarged (one circle of confusion ≈ 1/{PICTURE_WIDTH_IN_COC} of the picture) so they show on a small screen; the millimetres are real. {arch ? MOTION_PROVENANCE.notes : "Custom: the subject turns across the frame at this angular speed."}
        </p>
      </div>
    </section>
  );
}
