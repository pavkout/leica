import { useLayoutEffect, useRef } from "react";
import { irisBlades, irisCorners, openRadius } from "./irisGeometry";
import { openness, useIris, type IrisState } from "./iris";

/** How far the opening turns between open and shut, radians: blades swing as they close. */
const TURN = 0.8;

/**
 * The screen transition: the chosen lens's iris closes over the whole
 * screen and opens on the next one. Decorative only; never intercepts input.
 */
export default function IrisTransition() {
  const iris = useIris();
  const active = iris.phase !== "idle";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<IrisState>(iris);
  stateRef.current = iris;

  // Layout effect: the first frame is drawn before the browser paints, so a shut iris never shows the page for a frame.
  useLayoutEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const s = stateRef.current;
      const open = openness(s, performance.now());
      const R = openRadius(w, h);
      const cx = w / 2;
      const cy = h / 2;
      const rotation = -Math.PI / 2 + (1 - open) * TURN;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // A solid backing with the opening cut out, so the seams between blades never let the page through.
      const corners = irisCorners(s.blades, R * open, rotation, cx, cy);
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = "#0d0d0e";
      ctx.fill("evenodd");
      const blades = irisBlades(s.blades, R * open, rotation, R * 3, cx, cy);
      for (const [a, aFar, bFar, b] of blades) {
        // Matte black blades catching a little light on their leading edge.
        const g = ctx.createLinearGradient((a[0] + aFar[0]) / 2, (a[1] + aFar[1]) / 2, (b[0] + bFar[0]) / 2, (b[1] + bFar[1]) / 2);
        g.addColorStop(0, "#2b2b2e");
        g.addColorStop(0.45, "#18181a");
        g.addColorStop(1, "#0d0d0e");
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(aFar[0], aFar[1]);
        ctx.lineTo(bFar[0], bFar[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(aFar[0], aFar[1]);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.13)";
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
      // The opening's rim glints as it passes.
      if (open > 0.002 && open < 0.999) {
        const rim = ctx.createRadialGradient(cx, cy, R * open * 0.96, cx, cy, R * open * 1.35);
        rim.addColorStop(0, "rgba(0, 0, 0, 0)");
        rim.addColorStop(1, "rgba(0, 0, 0, 0.35)");
        ctx.fillStyle = rim;
        ctx.fillRect(0, 0, w, h);
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="iris-transition" aria-hidden="true" />;
}
