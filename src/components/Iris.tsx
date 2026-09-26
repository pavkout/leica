import { useState } from "react";
import type { Lens } from "../data/gear";
import { GENERIC_BLADES, apertureShape, irisOutline } from "../preview/aperture";
import { formatFNumber } from "../utils/format";
import Segmented from "./Segmented";

interface Props {
  lens: Lens;
  fNumber: number;
}

type View = "front" | "through-lens";

const SIZE = 168;
const CENTER = SIZE / 2;
const BARREL_R = 78;
const MAX_OPENING_R = 64;
const BOKEH_SIZE = 96;
const BOKEH_CENTER = BOKEH_SIZE / 2;
const BOKEH_R = 40;

// Through-lens schematic: a tube with two facing diaphragm blades that close
// toward the centre as the aperture narrows.
const TUBE_TOP = 20;
const TUBE_BOTTOM = SIZE - 20;
const TUBE_X = 40;
const TUBE_WIDTH = 88;
const DIAPHRAGM_WIDTH = 12;
const DIAPHRAGM_X = CENTER - DIAPHRAGM_WIDTH / 2;
const MAX_GAP_HALF = CENTER - TUBE_TOP - 8;

function openingPath(shape: ReturnType<typeof apertureShape>, cx: number, cy: number, maxR: number, relativeOpening: number): string {
  const scale = maxR * relativeOpening;
  return (
    irisOutline(shape)
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${(cx + x * scale).toFixed(2)},${(cy + y * scale).toFixed(2)}`)
      .join(" ") + " Z"
  );
}

export default function Iris({ lens, fNumber }: Props) {
  const [view, setView] = useState<View>("front");
  const shape = apertureShape(lens, fNumber);
  // Opening diameter scales as 1/fNumber; normalized so wide open fills the barrel.
  const relativeOpening = lens.maxAperture / fNumber;
  const known = lens.apertureBlades !== undefined;

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

      <div className="iris-diagrams">
        <figure className="iris-diagram">
          {view === "front" ? (
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Aperture opening at ${formatFNumber(fNumber)}, ${shape.blades} blades`}>
              <circle cx={CENTER} cy={CENTER} r={BARREL_R} className="iris-barrel" />
              <path d={openingPath(shape, CENTER, CENTER, MAX_OPENING_R, relativeOpening)} className="iris-opening" />
            </svg>
          ) : (
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Schematic side view of the aperture at ${formatFNumber(fNumber)}`}>
              <ellipse cx={TUBE_X} cy={CENTER} rx={14} ry={60} className="iris-element" />
              <ellipse cx={TUBE_X + TUBE_WIDTH} cy={CENTER} rx={14} ry={60} className="iris-element" />
              <rect x={TUBE_X} y={TUBE_TOP} width={TUBE_WIDTH} height={TUBE_BOTTOM - TUBE_TOP} className="iris-tube" />
              {(() => {
                const gapHalf = Math.max(3, MAX_GAP_HALF * relativeOpening);
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
          <figcaption className="muted small">{view === "front" ? "Front view" : "Schematic side view — not this lens's real optical prescription"}</figcaption>
        </figure>

        <figure className="iris-diagram iris-bokeh">
          <svg viewBox={`0 0 ${BOKEH_SIZE} ${BOKEH_SIZE}`} role="img" aria-label="Simulated out-of-focus highlight shape">
            <defs>
              <radialGradient id="iris-bokeh-glow">
                <stop offset="0%" stopColor="#fff6df" stopOpacity="0.95" />
                <stop offset="65%" stopColor="#ffd479" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#ffd479" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width={BOKEH_SIZE} height={BOKEH_SIZE} className="iris-bokeh-bg" />
            <path d={openingPath(shape, BOKEH_CENTER, BOKEH_CENTER, BOKEH_R, relativeOpening)} fill="url(#iris-bokeh-glow)" />
          </svg>
          <figcaption className="muted small">Out-of-focus highlight</figcaption>
        </figure>
      </div>

      <p className="hint">
        {known
          ? `${shape.blades} blades, as published for this lens.`
          : `Generic ${GENERIC_BLADES}-blade rounded iris; Leica doesn't publish this lens's blade count, so the bokeh shape shown is an approximation.`}
      </p>
    </section>
  );
}
