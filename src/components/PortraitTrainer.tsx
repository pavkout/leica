import { useState } from "react";
import type { Lens } from "../data/gear";
import {
  DEFAULT_ASSUMED_HEIGHT_M,
  FRAMINGS,
  PORTRAIT_FRAMING_PROVENANCE,
  requiredDistanceMm,
  scaledSubjectHeightM,
  type FramingId,
} from "../physics/portrait";
import { formatDistance, type Units } from "../utils/format";
import DistanceInput from "./DistanceInput";

interface Props {
  lens: Lens;
  frameWidthMm: number;
  frameHeightMm: number;
  units: Units;
}

// A simple standing figure, 200 units tall, head at the top — framings crop
// it from the top, the same way tightening a portrait crop works in reality.
const FIGURE_HEIGHT = 200;
const FIGURE_WIDTH = 120;
const CX = FIGURE_WIDTH / 2;

export default function PortraitTrainer({ lens, frameWidthMm, frameHeightMm, units }: Props) {
  const [framingId, setFramingId] = useState<FramingId>("head-shoulders");
  const [assumedHeightMm, setAssumedHeightMm] = useState(DEFAULT_ASSUMED_HEIGHT_M * 1000);

  const framing = FRAMINGS.find((f) => f.id === framingId)!;
  const subjectHeightM = scaledSubjectHeightM(framing, assumedHeightMm / 1000);
  const distanceMm = requiredDistanceMm(lens.focalMm, frameHeightMm, subjectHeightM);
  const tooClose = distanceMm < lens.minFocusMm;

  // Crop window: how much of the reference figure is visible for this
  // framing, derived from the same subjectHeightM/1.7 ratio the distance
  // math uses — not a separately hand-tuned number.
  const cropHeight = FIGURE_HEIGHT * (framing.subjectHeightM / DEFAULT_ASSUMED_HEIGHT_M);
  const cropWidth = cropHeight * (frameWidthMm / frameHeightMm);
  const cropX = CX - cropWidth / 2;

  return (
    <section className="panel stage-portrait" aria-label="Portrait distance trainer">
      <div className="panel-head">
        <h2>Portrait distance</h2>
      </div>

      <div className="dial" role="radiogroup" aria-label="Framing">
        {FRAMINGS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={f.id === framingId}
            className={f.id === framingId ? "dial-step dial-on" : "dial-step"}
            onClick={() => setFramingId(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="portrait-body">
        <svg
          className="portrait-guide"
          viewBox={`${cropX} 0 ${cropWidth} ${cropHeight}`}
          preserveAspectRatio="xMidYMin slice"
          role="img"
          aria-label={`Framing guide: ${framing.label.toLowerCase()}`}
        >
          {/* Head */}
          <circle cx={CX} cy={22} r={18} className="portrait-figure" />
          {/* Shoulders/torso */}
          <path
            d={`M${CX - 34},68 Q${CX - 40},44 ${CX - 14},40 L${CX + 14},40 Q${CX + 40},44 ${CX + 34},68 L${CX + 30},120 L${CX - 30},120 Z`}
            className="portrait-figure"
          />
          {/* Legs */}
          <rect x={CX - 24} y={118} width={20} height={82} rx={8} className="portrait-figure" />
          <rect x={CX + 4} y={118} width={20} height={82} rx={8} className="portrait-figure" />
        </svg>

        <div className="portrait-result">
          <p className="gear-name">Stand back to {formatDistance(distanceMm, units)}</p>
          <p className="muted small">for a {framing.label.toLowerCase()} framing with the {lens.name}.</p>
          {tooClose && (
            <p className="warn-text small">
              Closer than this lens's minimum focus distance ({formatDistance(lens.minFocusMm, units)}) — it can't
              focus there. Use a shorter framing or a wider lens.
            </p>
          )}
        </div>
      </div>

      <DistanceInput mm={assumedHeightMm} units={units} minMm={500} onChange={setAssumedHeightMm} label="Assumed height" />

      <p className="hint">
        {PORTRAIT_FRAMING_PROVENANCE.notes} Geometric calculation only — no camera-based distance sensing, and
        nothing here looks at or identifies anyone in a photo.
      </p>
    </section>
  );
}
