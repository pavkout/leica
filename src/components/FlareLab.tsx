import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Lens } from "../data/gear";
import { flareKernel, flareProfileFor, type FlareResult } from "../physics/flare";
import { irisOutline } from "../preview/aperture";
import { formatFNumber } from "../utils/format";
import ApertureStops from "./ApertureStops";

interface Props {
  lens: Lens;
  fNumber: number;
  frameWidthMm: number;
  frameHeightMm: number;
  /** The app's aperture setter: the lab shares the simulator's f-number. The lab never touches exposure. */
  onAperture: (n: number) => void;
}

/** Light positions reach this far beyond the frame edge (frame coordinates), where stray light matters most. */
const REACH = 1.8;

function draw(canvas: HTMLCanvasElement, f: FlareResult, x: number, y: number, intensity: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
  if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
  const g = canvas.getContext("2d");
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const px = (fx: number) => w / 2 + (fx * w) / 2;
  const py = (fy: number) => h / 2 - (fy * h) / 2;

  // A plain dusk scene for context.
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1d2533");
  sky.addColorStop(0.62, "#3a3440");
  sky.addColorStop(0.63, "#15161a");
  sky.addColorStop(1, "#0d0d0f");
  g.globalCompositeOperation = "source-over";
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  g.globalCompositeOperation = "lighter";
  // Veiling glare: lifts the whole frame.
  g.fillStyle = `rgba(255, 236, 214, ${f.veil})`;
  g.fillRect(0, 0, w, h);

  // Ghosts: images of the iris, tinted by coatings.
  const outline = irisOutline(f.shape, 48);
  for (const ghost of f.ghosts) {
    const r = ghost.r * h;
    const cx = px(ghost.x);
    const cy = py(ghost.y);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `hsla(${ghost.hue}, 80%, 72%, ${ghost.alpha * 0.55})`);
    grad.addColorStop(0.8, `hsla(${ghost.hue}, 85%, 62%, ${ghost.alpha})`);
    grad.addColorStop(1, `hsla(${ghost.hue}, 85%, 62%, 0)`);
    g.fillStyle = grad;
    g.beginPath();
    outline.forEach(([ox, oy], i) => (i ? g.lineTo(cx + ox * r, cy + oy * r) : g.moveTo(cx + ox * r, cy + oy * r)));
    g.fill();
  }

  if (f.inFrame) {
    const sx = px(x);
    const sy = py(y);
    const glowR = h * (0.06 + 0.14 * intensity);
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, glowR);
    glow.addColorStop(0, "rgba(255, 255, 250, 1)");
    glow.addColorStop(0.2, `rgba(255, 244, 220, ${0.6 * intensity + 0.3})`);
    glow.addColorStop(1, "rgba(255, 220, 180, 0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(sx, sy, glowR, 0, Math.PI * 2);
    g.fill();
    // Diffraction star: one spike per straight blade edge (doubled for odd blade counts).
    if (f.spikes.alpha > 0) {
      g.strokeStyle = `rgba(255, 250, 235, ${f.spikes.alpha})`;
      g.lineWidth = 1.2;
      for (let i = 0; i < f.spikes.count; i++) {
        const a = f.shape.rotation + (i * Math.PI * 2) / f.spikes.count;
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx + Math.cos(a) * f.spikes.length * h, sy - Math.sin(a) * f.spikes.length * h);
        g.stroke();
      }
    }
  } else {
    // Off-frame: an arrow at the edge points to the light.
    const ang = Math.atan2(-y * h, x * w);
    const ex = Math.min(Math.max(px(Math.max(-1, Math.min(1, x))), 14), w - 14);
    const ey = Math.min(Math.max(py(Math.max(-1, Math.min(1, y))), 14), h - 14);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#ffd54f";
    g.beginPath();
    g.moveTo(ex + Math.cos(ang) * 10, ey + Math.sin(ang) * 10);
    g.lineTo(ex + Math.cos(ang + 2.5) * 8, ey + Math.sin(ang + 2.5) * 8);
    g.lineTo(ex + Math.cos(ang - 2.5) * 8, ey + Math.sin(ang - 2.5) * 8);
    g.fill();
  }
  g.globalCompositeOperation = "source-over";
}

/** Flare Lab (feature #25): an artistic flare kernel driven by a draggable light. */
export default function FlareLab({ lens, fNumber, frameWidthMm, frameHeightMm, onAperture }: Props) {
  const [pos, setPos] = useState({ x: 0.72, y: 0.42 });
  const [intensity, setIntensity] = useState(0.8);
  const hasHood = lens.look.hood !== "none";
  const [hood, setHood] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const profile = flareProfileFor(lens.id);

  const result = useMemo(
    () => flareKernel({ lens, fNumber, frame: { width: frameWidthMm, height: frameHeightMm }, x: pos.x, y: pos.y, intensity, hood: hood && hasHood, profile }),
    [lens, fNumber, frameWidthMm, frameHeightMm, pos, intensity, hood, hasHood, profile],
  );

  // Redraw on change only (no idle loop); resizes redraw too.
  const redraw = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => canvasRef.current && draw(canvasRef.current, result, pos.x, pos.y, intensity));
  }, [result, pos, intensity]);
  useEffect(() => {
    redraw();
    const c = canvasRef.current;
    if (!c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(redraw);
    ro.observe(c);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [redraw]);

  const fromPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.max(-REACH, Math.min(REACH, v));
    setPos({ x: clamp(((e.clientX - r.left) / r.width) * 2 - 1), y: clamp(1 - ((e.clientY - r.top) / r.height) * 2) });
  };

  const hoodPct = Math.round(result.hoodTransmission * 100);
  const summary = `Light ${result.angleDeg.toFixed(0)}° off the lens axis, ${result.inFrame ? "inside the frame" : "outside the frame"}. ${
    hood && hasHood ? (hoodPct < 100 ? `The hood lets through about ${hoodPct}% of its stray light.` : "The hood can't block it: it's inside the angle of view.") : "No hood."
  }`;

  return (
    <section className="panel stage-flare" aria-label="Flare Lab">
      <div className="panel-head">
        <h2>Flare Lab</h2>
      </div>
      <div className="flare-note" role="note">
        <span className="dna-badge dna-approximate">Artistic approximation</span>
        <p className="muted small">{profile.provenance.notes}</p>
      </div>

      <canvas
        ref={canvasRef}
        className="flare-canvas"
        role="img"
        aria-label={`Flare preview with the ${lens.name} at ${formatFNumber(fNumber)}. ${summary} Drag to move the light, or use the sliders below.`}
        onPointerDown={(e) => {
          dragRef.current = e.pointerId;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // The pointer is already gone; the drag just stops at the canvas edge.
          }
          fromPointer(e);
        }}
        onPointerMove={(e) => dragRef.current === e.pointerId && fromPointer(e)}
        onPointerUp={() => (dragRef.current = null)}
        onPointerCancel={() => (dragRef.current = null)}
      />
      <p className="small flare-readout" aria-live="polite">
        {summary}
      </p>

      <div className="flare-controls">
        <label className="field">
          <span>Light across</span>
          <input type="range" min={-REACH} max={REACH} step={0.01} value={pos.x} onChange={(e) => setPos((p) => ({ ...p, x: Number(e.target.value) }))} />
        </label>
        <label className="field">
          <span>Light up / down</span>
          <input type="range" min={-REACH} max={REACH} step={0.01} value={pos.y} onChange={(e) => setPos((p) => ({ ...p, y: Number(e.target.value) }))} />
        </label>
        <label className="field">
          <span>Brightness</span>
          <input type="range" min={0} max={1} step={0.01} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
        </label>
      </div>

      <ApertureStops lens={lens} fNumber={fNumber} onAperture={onAperture} label="Flare Lab aperture" />

      <div className="flare-hood">
        <button type="button" className="btn btn-small" aria-pressed={hood && hasHood} disabled={!hasHood} onClick={() => setHood((v) => !v)}>
          Lens hood
        </button>
        {!hasHood && <span className="muted small">The catalogue lists no hood for this lens.</span>}
      </div>
    </section>
  );
}
