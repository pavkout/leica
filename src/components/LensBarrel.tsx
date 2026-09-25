import { useRef } from "react";
import type { Lens } from "../data/gear";
import { isFullStop } from "../data/gear";
import {
  depthOfField,
  distanceFromExtension,
  focusExtension,
} from "../physics/optics";
import {
  IMPERIAL_SCALE_MM,
  METRIC_SCALE_MM,
  formatDistance,
  formatFNumber,
  scaleLabel,
  type Units,
} from "../utils/format";
import { useDrag } from "../utils/useDrag";
import { useElementWidth } from "../utils/useElementWidth";

interface Props {
  lens: Lens;
  stops: number[];
  fNumber: number;
  focusMm: number;
  cocMm: number;
  units: Units;
  onFocusChange: (mm: number) => void;
  onApertureChange: (fNumber: number) => void;
}

// Vertical layout of the barrel, top to bottom.
const KNURL_BOTTOM = 16;
const RING_BOTTOM = 78;
const SCALE_BOTTOM = 112;
const HEIGHT = 164;

/** Snap to ∞ when this close to the end stop, like a real focus ring's hard stop. */
const INFINITY_SNAP = 0.012;

export default function LensBarrel({
  lens,
  stops,
  fNumber,
  focusMm,
  cocMm,
  units,
  onFocusChange,
  onApertureChange,
}: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const cx = width / 2;
  const f = lens.focalMm;

  // Focus ring: rotation ∝ helicoid extension, full throw spans half the width.
  const maxExtension = focusExtension(f, lens.minFocusMm);
  const focusE = focusExtension(f, focusMm);
  const pxPerMm = (width / 2 - 28) / maxExtension;
  const xOfExtension = (e: number) => cx - (e - focusE) * pxPerMm;
  const xOfDistance = (mm: number) => xOfExtension(focusExtension(f, mm));

  function setExtension(e: number) {
    const clamped = Math.min(Math.max(e, 0), maxExtension);
    onFocusChange(
      clamped < maxExtension * INFINITY_SNAP ? Infinity : distanceFromExtension(f, clamped)
    );
  }

  const focusStart = useRef(0);
  const focusDrag = useDrag({
    onStart: () => (focusStart.current = focusE),
    onMove: (dx) => setExtension(focusStart.current + dx / pxPerMm),
    onTap: (x) => setExtension(focusE - (x - cx) / pxPerMm),
  });

  // Aperture ring: evenly spaced detents under a fixed index.
  const stopIndex = Math.max(0, stops.indexOf(fNumber));
  const stopSpacing = Math.min(Math.max(width / 10, 30), 54);
  const setStopIndex = (i: number) =>
    onApertureChange(stops[Math.min(Math.max(Math.round(i), 0), stops.length - 1)]);

  const apertureStart = useRef(0);
  const apertureDrag = useDrag({
    onStart: () => (apertureStart.current = stopIndex),
    onMove: (dx) => setStopIndex(apertureStart.current - dx / stopSpacing),
    onTap: (x) => setStopIndex(stopIndex + (x - cx) / stopSpacing),
  });

  function onFocusKey(e: React.KeyboardEvent) {
    const step = maxExtension / 40;
    const actions: Record<string, () => void> = {
      ArrowRight: () => setExtension(focusE + step),
      ArrowUp: () => setExtension(focusE + step),
      ArrowLeft: () => setExtension(focusE - step),
      ArrowDown: () => setExtension(focusE - step),
      Home: () => setExtension(maxExtension),
      End: () => setExtension(0),
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  }

  function onApertureKey(e: React.KeyboardEvent) {
    const delta: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (e.key in delta) {
      e.preventDefault();
      setStopIndex(stopIndex + delta[e.key]);
    }
  }

  // Current depth of field on the ring.
  const dof = depthOfField(f, fNumber, cocMm, focusMm);
  const xNear = xOfDistance(dof.nearMm);
  const xFar = xOfExtension(focusExtension(f, dof.farSignedMm));

  // Engraved DoF marks for full stops (other than the current one).
  const dofMarks = stops
    .filter((n) => isFullStop(n) && n !== fNumber && n >= 2.8)
    .map((n) => {
      const d = depthOfField(f, n, cocMm, focusMm);
      return {
        n,
        near: xOfDistance(d.nearMm),
        far: xOfExtension(focusExtension(f, d.farSignedMm)),
      };
    });
  const MARK_LABEL_GAP = 18;
  let lastLabelOffset = 10;
  const labelledMarks = new Set<number>();
  for (const m of dofMarks) {
    const offset = cx - m.near;
    if (offset - lastLabelOffset >= MARK_LABEL_GAP && offset < width / 2 - 8) {
      labelledMarks.add(m.n);
      lastLabelOffset = offset;
    }
  }

  const knurlSpacing = 6;
  const knurlOffset = (((focusE * pxPerMm) % knurlSpacing) + knurlSpacing) % knurlSpacing;
  const knurlLines: number[] = [];
  for (let x = knurlOffset - knurlSpacing; x < width + knurlSpacing; x += knurlSpacing) knurlLines.push(x);

  const ringRight = xOfExtension(0);

  return (
    <div ref={wrapRef} className="barrel">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="barrel-svg"
        aria-label={`${lens.name} focus and aperture rings`}
      >
        <defs>
          <linearGradient id="barrel-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.55" />
            <stop offset="0.18" stopColor="#000" stopOpacity="0" />
            <stop offset="0.82" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="barrel-edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0a0a0a" stopOpacity="1" />
            <stop offset="0.12" stopColor="#0a0a0a" stopOpacity="0" />
            <stop offset="0.88" stopColor="#0a0a0a" stopOpacity="0" />
            <stop offset="1" stopColor="#0a0a0a" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Focus ring */}
        <rect className="b-ring" x={0} y={0} width={width} height={RING_BOTTOM} />
        {knurlLines.map((x) => (
          <line key={x} className="b-knurl" x1={x} x2={x} y1={2} y2={KNURL_BOTTOM - 2} />
        ))}
        <line className="b-seam" x1={0} x2={width} y1={KNURL_BOTTOM} y2={KNURL_BOTTOM} />

        <rect
          className="b-dof-band"
          x={Math.min(xNear, xFar)}
          y={KNURL_BOTTOM + 1}
          width={Math.abs(xFar - xNear)}
          height={RING_BOTTOM - KNURL_BOTTOM - 2}
        />

        <DistanceScale
          scaleMm={METRIC_SCALE_MM}
          units="metric"
          lens={lens}
          xOfDistance={xOfDistance}
          baseline={44}
          className="b-label-m"
          width={width}
          infinityX={ringRight}
        />
        <DistanceScale
          scaleMm={IMPERIAL_SCALE_MM}
          units="imperial"
          lens={lens}
          xOfDistance={xOfDistance}
          baseline={67}
          className="b-label-ft"
          tickAtBottom
          width={width}
          infinityX={ringRight}
        />
        {ringRight + 24 < width && (
          <>
            <text className="b-unit" x={ringRight + 14} y={44}>m</text>
            <text className="b-unit" x={ringRight + 14} y={67}>ft</text>
          </>
        )}

        {/* Fixed barrel with the depth-of-field scale */}
        <rect className="b-fixed" x={0} y={RING_BOTTOM} width={width} height={SCALE_BOTTOM - RING_BOTTOM} />
        {dofMarks.map((m) => (
          <g key={m.n} className="b-mark">
            <line x1={m.near} x2={m.near} y1={RING_BOTTOM} y2={RING_BOTTOM + 7} />
            <line x1={m.far} x2={m.far} y1={RING_BOTTOM} y2={RING_BOTTOM + 7} />
            {labelledMarks.has(m.n) && (
              <>
                <text x={m.near} y={RING_BOTTOM + 20} textAnchor="middle">{m.n}</text>
                <text x={m.far} y={RING_BOTTOM + 20} textAnchor="middle">{m.n}</text>
              </>
            )}
          </g>
        ))}
        <g className="b-mark-current">
          <line x1={xNear} x2={xNear} y1={KNURL_BOTTOM + 1} y2={RING_BOTTOM + 12} />
          <line x1={xFar} x2={xFar} y1={KNURL_BOTTOM + 1} y2={RING_BOTTOM + 12} />
        </g>
        <line className="b-index" x1={cx} x2={cx} y1={KNURL_BOTTOM + 1} y2={SCALE_BOTTOM} />

        {/* Aperture ring */}
        <rect className="b-aperture" x={0} y={SCALE_BOTTOM} width={width} height={HEIGHT - SCALE_BOTTOM} />
        <path className="b-index-tri" d={`M${cx - 5},${SCALE_BOTTOM} L${cx + 5},${SCALE_BOTTOM} L${cx},${SCALE_BOTTOM + 7} Z`} />
        {stops.map((n, i) => {
          const x = cx + (i - stopIndex) * stopSpacing;
          if (x < -20 || x > width + 20) return null;
          const full = isFullStop(n) || i === 0;
          return full ? (
            <text
              key={n}
              className={n === fNumber ? "b-stop b-stop-current" : "b-stop"}
              x={x}
              y={SCALE_BOTTOM + 32}
              textAnchor="middle"
            >
              {n}
            </text>
          ) : (
            <circle key={n} className={n === fNumber ? "b-halfstop b-stop-current" : "b-halfstop"} cx={x} cy={SCALE_BOTTOM + 27} r={2} />
          );
        })}

        <rect className="b-shade" x={0} y={0} width={width} height={HEIGHT} />
        <rect className="b-edge" x={0} y={0} width={width} height={HEIGHT} />

        {/* Hit areas */}
        <rect
          className="barrel-hit"
          x={0}
          y={0}
          width={width}
          height={RING_BOTTOM}
          tabIndex={0}
          role="slider"
          aria-label="Focus ring"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((focusE / maxExtension) * 100)}
          aria-valuetext={formatDistance(focusMm, units)}
          onKeyDown={onFocusKey}
          {...focusDrag}
        />
        <rect
          className="barrel-hit"
          x={0}
          y={SCALE_BOTTOM}
          width={width}
          height={HEIGHT - SCALE_BOTTOM}
          tabIndex={0}
          role="slider"
          aria-label="Aperture ring"
          aria-valuemin={0}
          aria-valuemax={stops.length - 1}
          aria-valuenow={stopIndex}
          aria-valuetext={formatFNumber(fNumber)}
          onKeyDown={onApertureKey}
          {...apertureDrag}
        />
      </svg>
    </div>
  );
}

function DistanceScale({
  scaleMm,
  units,
  lens,
  xOfDistance,
  baseline,
  className,
  width,
  infinityX,
  tickAtBottom = false,
}: {
  tickAtBottom?: boolean;
  scaleMm: number[];
  units: Units;
  lens: Lens;
  xOfDistance: (mm: number) => number;
  baseline: number;
  className: string;
  width: number;
  infinityX: number;
}) {
  // Real lenses start the metric scale at their closest focus distance; the
  // feet scale just starts at the next round number.
  const candidates = scaleMm.filter((mm) => mm >= lens.minFocusMm * 0.999);
  if (units === "metric" && !candidates.some((mm) => Math.abs(mm / lens.minFocusMm - 1) < 0.05)) {
    candidates.unshift(lens.minFocusMm);
  }

  // Keep labels from colliding: walk outward from ∞, which always shows.
  const minGap = units === "metric" ? 24 : 22;
  const labels: { mm: number; x: number }[] = [];
  let lastX = infinityX;
  for (const mm of [...candidates].reverse()) {
    const x = xOfDistance(mm);
    if (lastX - x >= minGap) {
      labels.push({ mm, x });
      lastX = x;
    }
  }

  const [tickY1, tickY2] = tickAtBottom
    ? [RING_BOTTOM - 6, RING_BOTTOM - 1]
    : [KNURL_BOTTOM + 1, KNURL_BOTTOM + 6];

  return (
    <g className={className}>
      {infinityX > -20 && infinityX < width + 20 && (
        <>
          <line className="b-tick" x1={infinityX} x2={infinityX} y1={tickY1} y2={tickY2} />
          <text x={infinityX} y={baseline} textAnchor="middle" className="b-infinity">∞</text>
        </>
      )}
      {labels
        .filter(({ x }) => x > -20 && x < width + 20)
        .map(({ mm, x }) => (
          <g key={mm}>
            <line className="b-tick" x1={x} x2={x} y1={tickY1} y2={tickY2} />
            <text x={x} y={baseline} textAnchor="middle">
              {scaleLabel(mm, units)}
            </text>
          </g>
        ))}
    </g>
  );
}
