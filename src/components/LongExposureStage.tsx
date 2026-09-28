import { useEffect, useRef, useState } from "react";
import { PATTERN_FILL, lightPhase, phaseAt, patternPoint, type PatternId, type PatternParams } from "../physics/longExposure";

export interface StageLight {
  pattern: PatternId;
  params: PatternParams;
  sizePx: number;
  /** CSS colour of the point, already dimmed to the light's brightness. */
  colour: string;
  /** Head start, fraction of a cycle. */
  offset: number;
}

interface Props {
  lights: StageLight[];
  cycleSec: number;
  loop: boolean;
  countdownSec: number;
  onClose: () => void;
}

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

/**
 * The experiment itself (feature #36): a black stage with one light. No UI,
 * cursor or text while the light runs; any tap or key ends it. Position is
 * computed from elapsed time on every frame, so the cycle keeps its duration
 * at any refresh rate and after dropped frames. Lazy-loaded.
 */
export default function LongExposureStage({ lights, cycleSec, loop, countdownSec, onClose }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(countdownSec);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Fullscreen + wake lock for the life of the stage; any tap or key exits.
  useEffect(() => {
    const el = stageRef.current as FsElement;
    const doc = document as FsDocument;
    let lock: WakeLockSentinel | null = null;
    let wasFullscreen = false;
    try {
      const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
      Promise.resolve(req?.())
        .then(() => (wasFullscreen = !!(doc.fullscreenElement ?? doc.webkitFullscreenElement)))
        .catch(() => undefined);
    } catch {
      // Not allowed here (e.g. iPhone Safari): the stage still covers the page.
    }
    navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);

    const close = () => closeRef.current();
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      close();
    };
    const onFs = () => {
      if (wasFullscreen && !(doc.fullscreenElement ?? doc.webkitFullscreenElement)) close();
    };
    // click, not pointerdown: closing on press would let the same tap's click land on the page underneath.
    el.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      el.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
      lock?.release().catch(() => undefined);
      if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
        Promise.resolve((doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc))?.()).catch(() => undefined);
      }
    };
  }, []);

  // Countdown, so the shutter can be pressed first.
  useEffect(() => {
    if (count <= 0) return;
    const id = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [count]);

  // The run: redraw from elapsed time every frame.
  useEffect(() => {
    if (count > 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const cycleMs = cycleSec * 1000;
    const t0 = performance.now();
    const probe = import.meta.env.DEV ? { t0, cycleMs, wraps: [] as number[], frames: 0 } : null;
    if (probe) (window as unknown as { __lel?: typeof probe }).__lel = probe;
    let lastCycle = 0;
    let raf = 0;
    const frame = () => {
      const now = performance.now();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const { phase, cycle, done } = phaseAt(now - t0, cycleMs, loop);
      if (probe) {
        probe.frames++;
        if (cycle > lastCycle || (done && probe.wraps.length === 0)) probe.wraps.push(now);
      }
      lastCycle = cycle;
      if (!done) {
        const half = (Math.min(w, h) * PATTERN_FILL) / 2;
        for (const l of lights) {
          const p = patternPoint(l.pattern, lightPhase(phase, l.offset), l.params);
          ctx.fillStyle = l.colour;
          ctx.beginPath();
          ctx.arc(w / 2 + p.x * half, h / 2 - p.y * half, (l.sizePx * dpr) / 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count, lights, cycleSec, loop]);

  return (
    <div ref={stageRef} className="lel-stage" role="dialog" aria-modal="true" aria-label="Long exposure running. Tap or press any key to stop.">
      <canvas ref={canvasRef} className="lel-canvas" aria-hidden="true" />
      {count > 0 && (
        <p className="lel-countdown" aria-live="polite">
          {count}
        </p>
      )}
    </div>
  );
}
