import { useEffect, useRef, useState } from "react";
import { framelinesFor, type Body, type Lens } from "../data/gear";
import { distanceFromExtension, focusExtension } from "../physics/optics";
import type { ApertureShape } from "../preview/aperture";
import {
  MAGNIFIER,
  RANGEFINDER_BASE_M,
  finderFieldDeg,
  frameLineFraction,
  framelineParallax,
} from "../preview/rangefinder";
import type { PhotoScene } from "../preview/photoScene";
import { BokehRenderer, type RenderParams } from "../preview/renderer";
import { meterLeds } from "../physics/exposure";
import { useDrag } from "../utils/useDrag";
import { useElementWidth } from "../utils/useElementWidth";

interface Props {
  body: Body;
  lens: Lens;
  focusMm: number;
  subjectMm: number;
  backgroundMm: number;
  shape: ApertureShape;
  photo?: PhotoScene | null;
  /** In-finder exposure display: M6-style LEDs or a digital shutter readout. */
  meter?: { kind: "leds" | "display"; errorStops: number; shutterLabel: string; auto: boolean };
  onFocusChange: (mm: number) => void;
}

const ASPECT = 1.5;
const MAX_PIXEL_WIDTH = 1400;
const LOUPE_ZOOM = 3;

interface Patch {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The finder image plus the rangefinder patch: inside the patch the second
 * image is superimposed, brighter and slightly warm, as in an M finder.
 */
function drawFinderImage(ctx: CanvasRenderingContext2D, main: HTMLCanvasElement, second: HTMLCanvasElement, patch: Patch) {
  ctx.drawImage(main, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(patch.x, patch.y, patch.w, patch.h, patch.h * 0.14);
  ctx.clip();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.85;
  ctx.drawImage(second, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#ffcf73";
  ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
  ctx.restore();
}

export default function Viewfinder({ body, lens, focusMm, subjectMm, backgroundMm, shape, photo, meter, onFocusChange }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.min(Math.round(width * dpr), MAX_PIXEL_WIDTH);
  const H = Math.round(W / ASPECT);

  const [magnified, setMagnified] = useState(false);
  const outRef = useRef<HTMLCanvasElement>(null);
  const renderers = useRef<{ main: BokehRenderer; second: BokehRenderer; mainCanvas: HTMLCanvasElement; secondCanvas: HTMLCanvasElement } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (renderers.current) return;
    try {
      const mainCanvas = document.createElement("canvas");
      const secondCanvas = document.createElement("canvas");
      renderers.current = {
        main: new BokehRenderer(mainCanvas),
        second: new BokehRenderer(secondCanvas),
        mainCanvas,
        secondCanvas,
      };
    } catch {
      setError(true);
    }
  }, []);

  const fieldDeg = finderFieldDeg(body.rangefinder?.magnification ?? 0.72, magnified ? MAGNIFIER : 1);
  const pair = framelinesFor(body, lens.focalMm);

  useEffect(() => {
    const r = renderers.current;
    const out = outRef.current;
    if (!r || !out || W < 2) return;
    const frame = requestAnimationFrame(() => {
      for (const c of [r.mainCanvas, r.secondCanvas, out]) {
        if (c.width !== W || c.height !== H) {
          c.width = W;
          c.height = H;
        }
      }
      const base: RenderParams = {
        focalMm: lens.focalMm,
        fNumber: lens.maxAperture,
        focusMm,
        subjectMm,
        backgroundMm,
        frameWidthMm: 36,
        horizontalAngleDeg: fieldDeg,
        shape,
        sharp: true,
        photo: photo ?? undefined,
      };
      r.main.render(base);
      r.second.render({ ...base, baselineM: RANGEFINDER_BASE_M });

      const ctx = out.getContext("2d")!;
      const fpx = W / 2 / Math.tan(((fieldDeg / 2) * Math.PI) / 180);
      const cx = W / 2;
      const cy = H / 2;
      const patch: Patch = { w: W * 0.13, h: W * 0.085, x: 0, y: 0 };
      patch.x = cx - patch.w / 2;
      patch.y = cy - patch.h / 2;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      drawFinderImage(ctx, r.mainCanvas, r.secondCanvas, patch);

      // Bright-line frames, shifted for parallax at the current focus.
      const parallax = framelineParallax(focusMm / 1000);
      ctx.strokeStyle = "rgba(252, 248, 236, 0.95)";
      ctx.lineWidth = Math.max(1.5, W / 480);
      ctx.shadowColor = "rgba(255, 250, 235, 0.6)";
      ctx.shadowBlur = W / 300;
      for (const f of pair ?? []) {
        const { halfWidthFrac, halfHeightFrac } = frameLineFraction(fieldDeg, f);
        const hw = halfWidthFrac * W;
        const hh = halfHeightFrac * W;
        const x = cx + fpx * parallax.x;
        const y = cy + fpx * parallax.y;
        ctx.strokeRect(x - hw, y - hh, hw * 2, hh * 2);
      }
      ctx.shadowBlur = 0;

      // Dark rim of the finder window.
      const rim = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.45, cx, cy, Math.hypot(W, H) / 2);
      rim.addColorStop(0, "rgba(0,0,0,0)");
      rim.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = rim;
      ctx.fillRect(0, 0, W, H);

      // Red LED exposure display under the frame.
      if (meter) {
        const size = W / 34;
        const y = H - H * 0.075;
        const leds = meterLeds(meter.errorStops);
        const lit = "#ff3b2f";
        const dim = "rgba(110, 18, 12, 0.6)";
        const tri = (x: number, dir: 1 | -1, on: boolean) => {
          ctx.fillStyle = on ? lit : dim;
          ctx.shadowBlur = on ? size * 0.8 : 0;
          ctx.beginPath();
          ctx.moveTo(x - (dir * size) / 2, y - size / 2);
          ctx.lineTo(x + (dir * size) / 2, y);
          ctx.lineTo(x - (dir * size) / 2, y + size / 2);
          ctx.closePath();
          ctx.fill();
        };
        ctx.save();
        ctx.shadowColor = "#ff2a1a";
        if (meter.kind === "leds" || !meter.auto) {
          const gap = meter.kind === "display" ? size * 3.2 : size * 1.4;
          tri(cx - gap, 1, leds.under);
          tri(cx + gap, -1, leds.over);
        }
        if (meter.kind === "leds") {
          ctx.fillStyle = leds.ok ? lit : dim;
          ctx.shadowBlur = leds.ok ? size * 0.8 : 0;
          ctx.beginPath();
          ctx.arc(cx, y, size * 0.32, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = lit;
          ctx.shadowBlur = size * 0.6;
          ctx.font = `700 ${Math.round(size * 1.05)}px ui-monospace, Menlo, Consolas, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${meter.auto ? "A " : ""}${meter.shutterLabel}`, cx, y);
        }
        ctx.restore();
      }

      // Loupe: the patch enlarged, top-right.
      const R = Math.min(W, H) * 0.19;
      const lx = W - R - W * 0.03;
      const ly = R + W * 0.03;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(lx, ly);
      ctx.scale(LOUPE_ZOOM, LOUPE_ZOOM);
      ctx.translate(-cx, -cy);
      drawFinderImage(ctx, r.mainCanvas, r.secondCanvas, patch);
      ctx.restore();
      ctx.lineWidth = Math.max(2, W / 350);
      ctx.strokeStyle = "#cf2e25";
      ctx.beginPath();
      ctx.arc(lx, ly, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `600 ${Math.round(W / 45)}px Outfit, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`Patch ${LOUPE_ZOOM}×`, lx, ly + R + W / 35);
    });
    return () => cancelAnimationFrame(frame);
  }, [W, H, lens, focusMm, subjectMm, backgroundMm, shape, photo, fieldDeg, pair, meter?.kind, meter?.errorStops, meter?.shutterLabel, meter?.auto]);

  // Dragging across the finder turns the focus ring, a full throw per width.
  const maxExtension = focusExtension(lens.focalMm, lens.minFocusMm);
  const dragStart = useRef(0);
  const drag = useDrag({
    onStart: () => (dragStart.current = focusExtension(lens.focalMm, focusMm)),
    onMove: (dx) => {
      const e = Math.min(Math.max(dragStart.current + (dx / Math.max(width, 1)) * maxExtension, 0), maxExtension);
      onFocusChange(e < maxExtension * 0.012 ? Infinity : distanceFromExtension(lens.focalMm, e));
    },
  });

  return (
    <div className="finder-wrap">
      <div ref={wrapRef} className="finder" style={{ aspectRatio: String(ASPECT) }} {...drag}>
        {error ? (
          <div className="preview-error">The viewfinder needs WebGL 2, which this browser doesn't provide.</div>
        ) : (
          <canvas ref={outRef} className="preview-canvas" role="img" aria-label="Rangefinder view with focusing patch" />
        )}
      </div>
      <div className="finder-controls">
        <span className="muted small">
          {body.rangefinder?.magnification}× finder
          {pair
            ? `, ${pair.join("/")} frames. Drag across the finder to focus.`
            : `; no ${lens.focalMm} mm frame, so use an external finder. Drag to focus.`}
        </span>
        <button type="button" className="btn btn-small" aria-pressed={magnified} onClick={() => setMagnified(!magnified)}>
          Magnifier {MAGNIFIER}×
        </button>
      </div>
    </div>
  );
}
