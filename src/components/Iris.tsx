import { useEffect, useRef, useState } from "react";
import { playApertureClick } from "../audio/sounds";
import type { Lens } from "../data/gear";
import { GENERIC_BLADES, apertureShape, irisOutline } from "../preview/aperture";
import { irisBlades } from "./app/irisGeometry";
import { formatFNumber, lensEngraving } from "../utils/format";
import Segmented from "./Segmented";

interface Props {
  lens: Lens;
  fNumber: number;
  /** The lens's aperture stops, for the ring under the iris. */
  stops?: number[];
  onAperture?: (n: number) => void;
}

type View = "front" | "through-lens";

// Front view, in a 400-unit square: the mount ring, the front ring's engraving, the glass, the blades.
const S = 400;
const C = S / 2;
const RING_R = 188;
const GLASS_R = 150;
/** Opening inradius wide open: a little inside the glass, so the blade tips always show, as they do. */
const OPEN_R = 132;
/** How far the blades swing between wide open and fully closed, radians. */
const SWING = 0.8;

// Side schematic: a tube with two facing diaphragm blades that close toward the centre.
const SIZE = 168;
const CENTER = SIZE / 2;
const TUBE_TOP = 20;
const TUBE_BOTTOM = SIZE - 20;
const TUBE_X = 40;
const TUBE_WIDTH = 88;
const DIAPHRAGM_WIDTH = 12;
const DIAPHRAGM_X = CENTER - DIAPHRAGM_WIDTH / 2;
const MAX_GAP_HALF = CENTER - TUBE_TOP - 8;

const BOKEH = 160;

function outlinePath(shape: ReturnType<typeof apertureShape>, cx: number, cy: number, r: number): string {
  return (
    irisOutline(shape)
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${(cx + x * r).toFixed(2)},${(cy + y * r).toFixed(2)}`)
      .join(" ") + " Z"
  );
}

/**
 * The opening follows the ring over a few frames instead of jumping: blades are
 * parts that travel. Instant under reduced motion.
 */
function useTravel(target: number, ms = 150) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const a = from.current;
    if (reduce || a === target) {
      from.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      const v = a + (target - a) * eased;
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export default function Iris({ lens, fNumber, stops, onAperture }: Props) {
  const [view, setView] = useState<View>("front");
  const shape = apertureShape(lens, fNumber);
  const known = lens.apertureBlades !== undefined;
  // Opening diameter scales as 1/N; normalised so wide open is 1.
  const relativeOpening = lens.maxAperture / fNumber;
  const open = useTravel(relativeOpening);
  const area = relativeOpening ** 2;
  const stopsDown = 2 * Math.log2(fNumber / lens.maxAperture);

  const r = OPEN_R * open;
  const rotation = -Math.PI / 2 + (1 - open) * SWING;
  const blades = irisBlades(shape.blades, r, rotation, S, C, C);
  const hole = outlinePath({ ...shape, rotation }, C, C, r);
  const engraving = lensEngraving(lens.name).toUpperCase();

  function turn(n: number) {
    if (n === fNumber || !onAperture) return;
    playApertureClick();
    onAperture(n);
  }

  return (
    <section className="panel stage-iris" aria-label="Aperture iris">
      <div className="panel-head">
        <h2>Aperture · iris</h2>
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "front", label: "Front" },
            { value: "through-lens", label: "Side" },
          ]}
        />
      </div>

      <div className="iris-stage">
        <figure className="iris-hero">
          {view === "front" ? (
            <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`${lens.name} seen from the front at ${formatFNumber(fNumber)}: a ${shape.blades}-blade iris`}>
              <defs>
                <radialGradient id="iris-glass" cx="42%" cy="36%" r="70%">
                  <stop offset="0%" stopColor="#1d2a33" />
                  <stop offset="55%" stopColor="#0b1116" />
                  <stop offset="100%" stopColor="#050607" />
                </radialGradient>
                <radialGradient id="iris-light" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#e9e0cb" />
                  <stop offset="35%" stopColor="#6d6657" />
                  <stop offset="100%" stopColor="#0c0c0b" />
                </radialGradient>
                <linearGradient id="iris-blade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#2a2a2c" />
                  <stop offset="50%" stopColor="#151516" />
                  <stop offset="100%" stopColor="#0c0c0d" />
                </linearGradient>
                <linearGradient id="iris-coating" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6fd3c4" stopOpacity="0" />
                  <stop offset="45%" stopColor="#6fd3c4" stopOpacity="0.09" />
                  <stop offset="60%" stopColor="#b48ad8" stopOpacity="0.07" />
                  <stop offset="100%" stopColor="#b48ad8" stopOpacity="0" />
                </linearGradient>
                <clipPath id="iris-glass-clip">
                  <circle cx={C} cy={C} r={GLASS_R} />
                </clipPath>
                <mask id="iris-hole">
                  <rect width={S} height={S} fill="#fff" />
                  <path d={hole} fill="#000" />
                </mask>
                <path id="iris-engraving-arc" d={`M ${C - 166} ${C} A 166 166 0 0 1 ${C + 166} ${C}`} />
              </defs>

              {/* Mount and front ring: knurling round the rim, the lens's name engraved on the ring. */}
              <circle cx={C} cy={C} r={RING_R} className="iris-mount" />
              <circle cx={C} cy={C} r={RING_R - 4} className="iris-knurl" />
              <circle cx={C} cy={C} r={GLASS_R + 26} className="iris-front-ring" />
              <text className="iris-engraving" aria-hidden="true">
                <textPath href="#iris-engraving-arc" startOffset="50%" textAnchor="middle">
                  {engraving}
                </textPath>
              </text>

              {/* Glass, then the light that gets through the opening, then the blades over it. */}
              <g clipPath="url(#iris-glass-clip)">
                <circle cx={C} cy={C} r={GLASS_R} fill="url(#iris-glass)" />
                <path d={hole} fill="url(#iris-light)" style={{ opacity: 0.22 + 0.4 * area }} />
                <g mask="url(#iris-hole)">
                  {blades.map(([a, aFar, bFar, b], i) => (
                    <path
                      key={i}
                      className="iris-blade"
                      d={`M${a[0]},${a[1]} L${aFar[0]},${aFar[1]} L${bFar[0]},${bFar[1]} L${b[0]},${b[1]} Z`}
                      fill="url(#iris-blade)"
                    />
                  ))}
                </g>
                {/* Coating reflection across the front element. */}
                <ellipse cx={C - 30} cy={C - 44} rx={112} ry={64} fill="url(#iris-coating)" transform={`rotate(-28 ${C} ${C})`} />
                <path d={`M ${C - 118} ${C - 62} A 136 136 0 0 1 ${C - 34} ${C - 128}`} className="iris-glint" />
              </g>
              <circle cx={C} cy={C} r={GLASS_R} className="iris-glass-edge" />
            </svg>
          ) : (
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Schematic side view of the aperture at ${formatFNumber(fNumber)}`}>
              <ellipse cx={TUBE_X} cy={CENTER} rx={14} ry={60} className="iris-element" />
              <ellipse cx={TUBE_X + TUBE_WIDTH} cy={CENTER} rx={14} ry={60} className="iris-element" />
              <rect x={TUBE_X} y={TUBE_TOP} width={TUBE_WIDTH} height={TUBE_BOTTOM - TUBE_TOP} className="iris-tube" />
              {(() => {
                const gapHalf = Math.max(3, MAX_GAP_HALF * open);
                const bladeHeight = CENTER - gapHalf - TUBE_TOP;
                return (
                  <>
                    <rect x={DIAPHRAGM_X} y={TUBE_TOP} width={DIAPHRAGM_WIDTH} height={bladeHeight} className="iris-diaphragm" />
                    <rect x={DIAPHRAGM_X} y={CENTER + gapHalf} width={DIAPHRAGM_WIDTH} height={bladeHeight} className="iris-diaphragm" />
                  </>
                );
              })()}
            </svg>
          )}
          {view === "through-lens" && <figcaption className="muted small">Schematic side view, not this lens's real optical prescription.</figcaption>}
        </figure>

        <div className="iris-side">
          <p className="iris-f" aria-live="polite">
            {formatFNumber(fNumber)}
          </p>
          <dl className="iris-read">
            <div>
              <dt>Light through</dt>
              <dd>{Math.round(area * 100)}% of wide open</dd>
            </div>
            <div>
              <dt>Stopped down</dt>
              <dd>{stopsDown < 0.05 ? "Wide open" : `${stopsDown.toFixed(1)} stops`}</dd>
            </div>
            <div>
              <dt>Blades</dt>
              <dd>{known ? `${shape.blades}, published` : `${GENERIC_BLADES}, generic`}</dd>
            </div>
          </dl>
          <figure className="iris-bokeh">
            <svg viewBox={`0 0 ${BOKEH} ${BOKEH}`} role="img" aria-label="Simulated out-of-focus highlight shape">
              <defs>
                <radialGradient id="iris-bokeh-glow">
                  <stop offset="0%" stopColor="#fff6df" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#f2d9a6" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#f2d9a6" stopOpacity="0.1" />
                </radialGradient>
              </defs>
              <rect width={BOKEH} height={BOKEH} className="iris-bokeh-bg" />
              <path d={outlinePath(shape, BOKEH / 2, BOKEH / 2, 62 * open)} fill="url(#iris-bokeh-glow)" />
            </svg>
            <figcaption className="muted small">A point of light, out of focus</figcaption>
          </figure>
        </div>
      </div>

      {stops && onAperture && (
        <div className="field iris-ring">
          <span>Aperture ring</span>
          <div className="dial" role="radiogroup" aria-label="Aperture">
            {stops.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={n === fNumber} className={n === fNumber ? "dial-step dial-on" : "dial-step"} onClick={() => turn(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="hint">
        {known
          ? `${shape.blades} blades, as published for this lens. Light through the opening is calculated from the f-number.`
          : `Generic ${GENERIC_BLADES}-blade rounded iris: Leica doesn't publish this lens's blade count, so the blade shape is an approximation. Light through the opening is calculated from the f-number.`}
      </p>
    </section>
  );
}
