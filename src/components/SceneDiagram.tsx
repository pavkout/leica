import { useRef } from "react";
import { blurDiscMm } from "../physics/optics";
import type { Shot } from "../physics/model";
import { formatDistance, type Units } from "../utils/format";
import { useDrag } from "../utils/useDrag";
import { useElementWidth } from "../utils/useElementWidth";

interface Props {
  shot: Shot;
  minFocusMm: number;
  units: Units;
  /** Hides where the subject stands (during the focus challenge). */
  hideSubject?: boolean;
  onFocusChange: (mm: number) => void;
  onBackgroundChange: (distanceMm: number) => void;
}

// Log axis from 15 cm to 100 m, plus a separate slot for ∞.
const AXIS_MIN_MM = 150;
const AXIS_MAX_MM = 100_000;
const PAD_LEFT = 44;
const PAD_RIGHT = 14;
const INFINITY_SLOT = 30;

const LABEL_ROW = 16;
const GROUND = 128;
const BLUR_TOP = 158;
const BLUR_BOTTOM = 204;
const HEIGHT = 214;

/** Blur-curve ceiling, in multiples of the circle of confusion. */
const BLUR_CAP = 40;

const METRIC_TICKS_MM = [200, 300, 500, 1000, 2000, 3000, 5000, 10_000, 20_000, 50_000, 100_000];
const IMPERIAL_TICKS_MM = [1, 2, 3, 5, 10, 20, 50, 100, 300].map((ft) => ft * 304.8);

export default function SceneDiagram({ shot, minFocusMm, units, hideSubject, onFocusChange, onBackgroundChange }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const plotRight = width - PAD_RIGHT - INFINITY_SLOT;
  const plotWidth = plotRight - PAD_LEFT;
  const infinityX = width - PAD_RIGHT - INFINITY_SLOT / 2;
  const logSpan = Math.log(AXIS_MAX_MM / AXIS_MIN_MM);

  const xOf = (mm: number) => {
    if (!Number.isFinite(mm) || mm > AXIS_MAX_MM * 1.5) return infinityX;
    const clamped = Math.min(Math.max(mm, AXIS_MIN_MM), AXIS_MAX_MM);
    return PAD_LEFT + (Math.log(clamped / AXIS_MIN_MM) / logSpan) * plotWidth;
  };
  const mmOf = (x: number) => {
    if (x > plotRight + 6) return Infinity;
    const t = Math.min(Math.max((x - PAD_LEFT) / plotWidth, 0), 1);
    return AXIS_MIN_MM * Math.exp(t * logSpan);
  };

  const { dof, focusMm, backgroundMm, focalMm, fNumber, cocMm } = shot;
  const focusX = xOf(focusMm);
  const subjectX = xOf(shot.subjectMm);
  const bgX = xOf(backgroundMm);
  const nearX = xOf(dof.nearMm);
  const farX = xOf(dof.farMm);

  // Pointer: grab whichever marker is closer; the background tree only when near it.
  const target = useRef<"focus" | "background">("focus");
  function moveTo(x: number) {
    const mm = mmOf(x);
    if (target.current === "background") {
      onBackgroundChange(Number.isFinite(mm) ? Math.max(mm, shot.subjectMm + 50) : Infinity);
    } else {
      onFocusChange(Number.isFinite(mm) ? Math.max(mm, minFocusMm) : Infinity);
    }
  }
  const drag = useDrag({
    onStart: (x) => {
      target.current =
        Number.isFinite(shot.backgroundMm) && Math.abs(x - bgX) < Math.abs(x - focusX) && Math.abs(x - bgX) < 28
          ? "background"
          : "focus";
    },
    onMove: (_dx, x) => moveTo(x),
    onTap: (x) => {
      target.current = "focus";
      moveTo(x);
    },
  });

  // Blur curve: disc size at each distance, in CoC multiples, on a log scale.
  const blurY = (ratio: number) => {
    const t = Math.log1p(Math.min(ratio, BLUR_CAP)) / Math.log1p(BLUR_CAP);
    return BLUR_BOTTOM - t * (BLUR_BOTTOM - BLUR_TOP);
  };
  const samples = 120;
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = PAD_LEFT + (i / samples) * plotWidth;
    const ratio = blurDiscMm(focalMm, fNumber, focusMm, mmOf(x)) / cocMm;
    points.push(`${x.toFixed(1)},${blurY(ratio).toFixed(1)}`);
  }
  const infinityRatio = blurDiscMm(focalMm, fNumber, focusMm, Infinity) / cocMm;
  const blurPath = `M${PAD_LEFT},${BLUR_BOTTOM} L${points.join(" L")} L${plotRight},${blurY(infinityRatio)} L${infinityX + INFINITY_SLOT / 2},${blurY(infinityRatio)} L${infinityX + INFINITY_SLOT / 2},${BLUR_BOTTOM} Z`;
  const cocLineY = blurY(1);

  const ticks = (units === "metric" ? METRIC_TICKS_MM : IMPERIAL_TICKS_MM).filter(
    (mm) => mm >= AXIS_MIN_MM && mm <= AXIS_MAX_MM
  );
  const minTickGap = 30;
  let lastTickX = -Infinity;
  const visibleTicks = ticks.filter((mm) => {
    const x = xOf(mm);
    if (x - lastTickX < minTickGap || x > plotRight - 10) return false;
    lastTickX = x;
    return true;
  });

  const hyperfocalX = xOf(dof.hyperfocalMm);
  const showHyperfocal = dof.hyperfocalMm < AXIS_MAX_MM;

  // Near/far labels: flip to the inside when they'd run off the edge.
  const nearLabel = formatDistance(dof.nearMm, units);
  const farLabel = formatDistance(dof.farMm, units);
  const bandNarrow = farX - nearX < 110;

  return (
    <div ref={wrapRef} className="scene">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="scene-svg"
        role="img"
        aria-label={`Side view: sharp from ${nearLabel} to ${farLabel}, focused at ${formatDistance(focusMm, units)}`}
        {...drag}
      >
        {/* Sharp zone */}
        <rect className="s-band" x={nearX} y={LABEL_ROW + 8} width={Math.max(farX - nearX, 1.5)} height={GROUND - LABEL_ROW - 8} />
        <line className="s-limit" x1={nearX} x2={nearX} y1={LABEL_ROW + 8} y2={GROUND} />
        <line className="s-limit" x1={farX} x2={farX} y1={LABEL_ROW + 8} y2={GROUND} />
        {bandNarrow ? (
          <text className="s-limit-label" x={(nearX + farX) / 2} y={LABEL_ROW} textAnchor="middle">
            {nearLabel} – {farLabel}
          </text>
        ) : (
          <>
            <text className="s-limit-label" x={nearX + 4} y={LABEL_ROW} textAnchor="start">{nearLabel}</text>
            <text className="s-limit-label" x={farX - 4} y={LABEL_ROW} textAnchor="end">{farLabel}</text>
          </>
        )}

        {/* Ground and axis */}
        <line className="s-ground" x1={PAD_LEFT - 30} x2={width - PAD_RIGHT} y1={GROUND} y2={GROUND} />
        {visibleTicks.map((mm) => (
          <g key={mm} className="s-tick">
            <line x1={xOf(mm)} x2={xOf(mm)} y1={GROUND} y2={GROUND + 5} />
            <text x={xOf(mm)} y={GROUND + 18} textAnchor="middle">
              {units === "metric"
                ? mm >= 1000 ? `${mm / 1000}m` : `${mm / 10}cm`
                : `${Math.round(mm / 304.8)}′`}
            </text>
          </g>
        ))}
        <line className="s-break" x1={plotRight + 6} x2={plotRight + 10} y1={GROUND - 4} y2={GROUND + 4} />
        <line className="s-break" x1={plotRight + 10} x2={plotRight + 14} y1={GROUND - 4} y2={GROUND + 4} />
        <g className="s-tick">
          <text x={infinityX} y={GROUND + 18} textAnchor="middle" className="s-infinity">∞</text>
        </g>
        {showHyperfocal && (
          <g className="s-hyperfocal">
            <path d={`M${hyperfocalX - 4},${GROUND + 1} L${hyperfocalX + 4},${GROUND + 1} L${hyperfocalX},${GROUND - 6} Z`} />
            <text x={hyperfocalX} y={GROUND - 9} textAnchor="middle">H</text>
          </g>
        )}

        {/* Camera */}
        <g className="s-camera" transform={`translate(8 ${GROUND - 26})`}>
          <rect x={0} y={4} width={24} height={16} rx={2} />
          <rect x={24} y={8} width={7} height={8} />
          <rect x={4} y={1} width={6} height={3} />
        </g>

        {/* Background */}
        {Number.isFinite(shot.backgroundMm) && (
          <g className="s-background" transform={`translate(${bgX} ${GROUND})`}>
            <rect x={-1.5} y={-22} width={3} height={22} />
            <circle cx={0} cy={-34} r={15} />
          </g>
        )}

        {/* Subject */}
        {!hideSubject && Number.isFinite(shot.subjectMm) && (
          <g className="s-subject" transform={`translate(${subjectX} ${GROUND})`}>
            <circle cx={0} cy={-52} r={7} />
            <path d="M-9,-42 h18 a3,3 0 0 1 3,3 v18 h-5 v21 h-5 v-17 h-4 v17 h-5 v-21 h-5 v-18 a3,3 0 0 1 3,-3 Z" />
          </g>
        )}
        <line className="s-focus" x1={focusX} x2={focusX} y1={LABEL_ROW + 8} y2={GROUND} />

        {/* Blur profile */}
        <text className="s-caption" x={4} y={BLUR_TOP + 4}>blur</text>
        <path className="s-blur" d={blurPath} />
        <line className="s-coc" x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={cocLineY} y2={cocLineY} />
        <text className="s-caption" x={4} y={cocLineY + 3}>sharp</text>
      </svg>
    </div>
  );
}
