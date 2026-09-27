import { useEffect, useMemo, useRef, useState } from "react";
import { formatShutter } from "../data/gear";
import {
  ANATOMY_PROVENANCE,
  PARTS,
  PHASE_TEXT,
  boxAt,
  drawOrder,
  keyMoments,
  releaseDuration,
  shutterAt,
  WIND_SHARE,
  type Box,
  type PartId,
} from "../mechanics/anatomy";

const SPEEDS = [1, 1 / 15, 1 / 60, 1 / 250, 1 / 1000];
/** Oblique projection: depth recedes up and to the right. */
const KX = 0.45 * Math.cos(Math.PI / 5);
const KY = 0.45 * Math.sin(Math.PI / 5);
const proj = (x: number, y: number, z: number): [number, number] => [x - z * KX, -(y - z * KY)];
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const PLAY_MS = 5000;

function faces(b: Box) {
  const [x0, y0, z0] = b.min;
  const [x1, y1, z1] = b.max;
  return {
    front: pts([proj(x0, y0, z1), proj(x1, y0, z1), proj(x1, y1, z1), proj(x0, y1, z1)]),
    top: pts([proj(x0, y1, z1), proj(x1, y1, z1), proj(x1, y1, z0), proj(x0, y1, z0)]),
    right: pts([proj(x1, y0, z1), proj(x1, y0, z0), proj(x1, y1, z0), proj(x1, y1, z1)]),
    label: proj((x0 + x1) / 2, y1, (z0 + z1) / 2),
  };
}

// Fixed view box covering both the assembled and fully exploded layouts, so nothing rescales while animating.
const VIEW = (() => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const t of [0, 1])
    for (const p of PARTS) {
      const b = boxAt(p, t);
      for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) {
        const [sx, sy] = proj(x, y, z);
        xs.push(sx);
        ys.push(sy);
      }
    }
  const pad = 8;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return `${minX.toFixed(0)} ${minY.toFixed(0)} ${(Math.max(...xs) - minX + pad).toFixed(0)} ${(Math.max(...ys) - minY + pad).toFixed(0)}`;
})();

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Exploded camera view / mechanical education (feature #21): illustrative anatomy and the shutter release, slowed down. */
export default function CameraAnatomy({ shutterSec }: { shutterSec: number }) {
  const [explode, setExplode] = useState(0);
  const [selected, setSelected] = useState<PartId>("shutter");
  const animRef = useRef(0);

  const [speed, setSpeed] = useState(() => SPEEDS.reduce((b, s) => (Math.abs(Math.log(s / shutterSec)) < Math.abs(Math.log(b / shutterSec)) ? s : b)));
  const [scrub, setScrub] = useState(0);
  const [playing, setPlaying] = useState(false);

  function animateExplodeTo(target: number) {
    cancelAnimationFrame(animRef.current);
    if (prefersReducedMotion()) {
      setExplode(target);
      return;
    }
    const from = explode;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 700);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      setExplode(from + (target - from) * e);
      if (k < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  // Shutter playback: slowed so the whole sequence takes PLAY_MS; pausable, and scrubbing pauses it.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      let done = false;
      setScrub((p) => {
        const next = Math.min(1, p + dt / PLAY_MS);
        done = next >= 1;
        return next;
      });
      if (done) setPlaying(false);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const boxes = useMemo(() => PARTS.map((p) => ({ id: p.id, box: boxAt(p, explode) })), [explode]);
  const order = useMemo(() => drawOrder(boxes), [boxes]);
  const part = PARTS.find((p) => p.id === selected)!;
  const s = shutterAt(scrub, speed);
  const slowdown = (PLAY_MS * (1 - WIND_SHARE)) / 1000 / releaseDuration(speed);
  const moments = keyMoments(speed);

  return (
    <section className="panel stage-anatomy" aria-label="Camera anatomy">
      <div className="panel-head">
        <h2>Inside a film M</h2>
        <span className="dna-badge dna-illustrative" title={ANATOMY_PROVENANCE.notes}>
          Illustrative
        </span>
      </div>
      <p className="muted small">Simplified mechanism, not engineering drawings or repair information. Tap a part to learn what it does.</p>

      <div className="anat-view">
        <svg viewBox={VIEW} className="anat-svg" role="group" aria-label="Exploded view of a generic film M camera">
          {order.map((id) => {
            const b = boxes.find((x) => x.id === id)!;
            const p = PARTS.find((x) => x.id === id)!;
            const f = faces(b.box);
            const on = id === selected;
            return (
              <g
                key={id}
                className={`anat-part${on ? " anat-part-on" : ""}`}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={p.label}
                onClick={() => setSelected(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(id);
                  }
                }}
              >
                <polygon points={f.right} className="anat-right" />
                <polygon points={f.top} className="anat-top" />
                <polygon points={f.front} className="anat-front" />
              </g>
            );
          })}
          {explode > 0.6 &&
            order.map((id) => {
              const b = boxes.find((x) => x.id === id)!;
              const [lx, ly] = faces(b.box).label;
              return (
                <text key={id} x={lx} y={ly - 3} className="anat-label" textAnchor="middle" style={{ opacity: Math.min(1, (explode - 0.6) / 0.3) }}>
                  {PARTS.find((x) => x.id === id)!.label}
                </text>
              );
            })}
        </svg>
      </div>

      <div className="anat-controls">
        <button type="button" className="btn btn-small" onClick={() => animateExplodeTo(explode > 0.5 ? 0 : 1)}>
          {explode > 0.5 ? "Reassemble" : "Explode"}
        </button>
        <label className="field anat-amount">
          <span>Explode · {Math.round(explode * 100)}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(explode * 100)}
            onChange={(e) => {
              cancelAnimationFrame(animRef.current);
              setExplode(Number(e.target.value) / 100);
            }}
          />
        </label>
      </div>

      <div className="anat-chips" role="group" aria-label="Parts">
        {PARTS.map((p) => (
          <button key={p.id} type="button" className={`anat-chip${p.id === selected ? " anat-chip-on" : ""}`} aria-pressed={p.id === selected} onClick={() => setSelected(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="anat-info" aria-live="polite">
        <h3>{part.label}</h3>
        <p className="small">{part.what}</p>
        {part.history && <p className="muted small">{part.history}</p>}
      </div>

      <h3>Fire the shutter, slowed down</h3>
      <div className="anat-shutter">
        <svg viewBox="0 0 120 80" className="anat-gate" role="img" aria-label={`Film gate: ${PHASE_TEXT[s.phase]}`}>
          <rect x={0} y={0} width={120} height={80} rx={4} className="anat-gate-bg" />
          <rect x={6} y={10} width={108} height={60} className="anat-film" />
          {/* First curtain: covers the gate from its edge to the right. */}
          <rect x={6 + 108 * s.firstEdge} y={10} width={108 * (1 - s.firstEdge)} height={60} className="anat-curtain anat-curtain-1" />
          {/* Second curtain: covers from the left up to its edge. */}
          <rect x={6} y={10} width={108 * s.secondEdge} height={60} className="anat-curtain anat-curtain-2" />
          <rect x={6} y={10} width={108} height={60} className="anat-gate-frame" />
        </svg>
        <div className="anat-shutter-side">
          <p className="small anat-phase" aria-live="polite">
            {PHASE_TEXT[s.phase]}
          </p>
          <p className="muted small">
            {s.timeS === null
              ? "Winding stroke (not to time)."
              : `${(s.timeS * 1000).toFixed(s.timeS < 0.1 ? 1 : 0)} ms after release · shown about ${Math.max(1, Math.round(slowdown)).toLocaleString()}× slower`}
          </p>
        </div>
      </div>
      <div className="anat-controls">
        <label className="field">
          <span>Shutter speed</span>
          <select
            value={speed}
            onChange={(e) => {
              setSpeed(Number(e.target.value));
              setScrub(0);
              setPlaying(false);
            }}
          >
            {SPEEDS.map((t) => (
              <option key={t} value={t}>
                {formatShutter(t)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-small btn-red"
          onClick={() => {
            if (playing) setPlaying(false);
            else {
              if (scrub >= 1) setScrub(0);
              setPlaying(true);
            }
          }}
        >
          {playing ? "Pause" : scrub >= 1 ? "Fire again" : scrub > 0 ? "Resume" : "Fire"}
        </button>
      </div>
      <label className="field">
        <span>Timeline</span>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(scrub * 1000)}
          onChange={(e) => {
            setPlaying(false);
            setScrub(Number(e.target.value) / 1000);
          }}
        />
      </label>
      <div className="anat-steps" role="group" aria-label="Key moments">
        {moments.map((m) => (
          <button
            key={m.label}
            type="button"
            className={`anat-chip${Math.abs(m.p - scrub) < 0.002 ? " anat-chip-on" : ""}`}
            onClick={() => {
              setPlaying(false);
              setScrub(m.p);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="muted small">
        Each point of the film is uncovered for exactly {formatShutter(speed)}. At fast speeds a narrow slit crosses the frame rather than
        the whole frame opening at once. Curtain travel time is illustrative.
      </p>
    </section>
  );
}
