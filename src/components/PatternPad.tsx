import { useRef, useState, type PointerEvent } from "react";
import { tidyStrokes, type Pt } from "../physics/longExposure";

interface Props {
  strokes: Pt[][];
  onChange: (strokes: Pt[][]) => void;
}

const SIZE = 240;
const toUnit = (e: PointerEvent<SVGSVGElement>): Pt => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: 1 - ((e.clientY - r.top) / r.height) * 2 };
};
const toPx = (q: Pt) => `${(((q.x + 1) / 2) * SIZE).toFixed(1)},${(((1 - q.y) / 2) * SIZE).toFixed(1)}`;

/** Draw a path for the light with a finger or mouse: each stroke is traced in order, dark between strokes. */
export default function PatternPad({ strokes, onChange }: Props) {
  const [live, setLive] = useState<Pt[] | null>(null);
  // The stroke in progress also lives in a ref: a quick flick can end before React re-renders.
  const current = useRef<Pt[] | null>(null);

  function end() {
    const st = current.current;
    if (!st) return;
    current.current = null;
    onChange(tidyStrokes([...strokes, st]));
    setLive(null);
  }

  return (
    <div className="pad">
      <svg
        className="pad-surface"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={strokes.length ? `Your drawing: ${strokes.length} stroke${strokes.length === 1 ? "" : "s"}` : "Drawing pad: draw the light's path here"}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
          } catch {
            // Capture can be refused (e.g. a pointer that has already ended); drawing still works without it.
          }
          current.current = [toUnit(e)];
          setLive(current.current);
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          current.current = [...current.current, toUnit(e)];
          setLive(current.current);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <rect x={0} y={0} width={SIZE} height={SIZE} className="pad-bg" />
        {[1, 2, 3].map((i) => (
          <g key={i} className="pad-grid">
            <line x1={(SIZE * i) / 4} y1={0} x2={(SIZE * i) / 4} y2={SIZE} />
            <line x1={0} y1={(SIZE * i) / 4} x2={SIZE} y2={(SIZE * i) / 4} />
          </g>
        ))}
        {[...strokes, ...(live ? [live] : [])].map((st, k) => (
          <polyline key={k} points={st.map(toPx).join(" ")} className="pad-stroke" />
        ))}
        {strokes[0]?.[0] && <circle cx={toPx(strokes[0][0]).split(",")[0]} cy={toPx(strokes[0][0]).split(",")[1]} r={4} className="pad-start" />}
      </svg>
      <div className="pad-actions">
        <button type="button" className="btn btn-small" disabled={!strokes.length} onClick={() => onChange(strokes.slice(0, -1))}>
          Undo stroke
        </button>
        <button type="button" className="btn btn-small" disabled={!strokes.length} onClick={() => onChange([])}>
          Clear
        </button>
      </div>
      <p className="muted small">Strokes play in the order you draw them; the light goes dark as it jumps between them. The red dot marks the start.</p>
    </div>
  );
}
