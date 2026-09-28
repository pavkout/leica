import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Lens } from "../data/gear";
import { ALIGNED, CALIBRATION_ASSUMPTIONS, chartDistances, focusError, infinityEffect, type Misalignment } from "../physics/rangefinderCalibration";
import { formatDistance, formatFNumber, type Units } from "../utils/format";

interface Props {
  lens: Lens;
  fNumber: number;
  cocMm: number;
  units: Units;
}

// Chart palette: one series (validated dark-surface blue from the dataviz reference palette), recessive axes.
const SERIES = "#e9e6df";
const INK = "#e6e6e6";
const MUTED = "#9a9a9a";
const GRID = "#333";
const SURFACE = "#1a1a19";
const FOCALS = [28, 35, 50, 75, 90];
const Y_CAP = 12;

const W = 320;
const H = 160;
const PAD = { l: 34, r: 10, t: 12, b: 26 };

function LineChart({ points, units, onHover, hover }: { points: { d: number; r: number }[]; units: Units; onHover: (i: number | null) => void; hover: number | null }) {
  const minD = points[0].d;
  const maxD = points[points.length - 1].d;
  const x = (d: number) => PAD.l + ((Math.log(d) - Math.log(minD)) / (Math.log(maxD) - Math.log(minD))) * (W - PAD.l - PAD.r);
  const yMax = Math.min(Y_CAP, Math.max(2, ...points.map((p) => p.r)));
  const y = (r: number) => PAD.t + (1 - Math.min(r, yMax) / yMax) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.r).toFixed(1)}`).join(" ");
  const ticks = [700, 1000, 2000, 3000, 5000, 10000, 20000].filter((t) => t >= minD && t <= maxD);
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.d) - px) < Math.abs(x(points[best].d) - px)) best = i;
    });
    onHover(best);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cal-chart" fontFamily="Archivo, system-ui, sans-serif" role="img" aria-label="Subject blur against subject distance, as a multiple of the circle of confusion" onPointerMove={onMove} onPointerLeave={() => onHover(null)}>
      <rect x={0} y={0} width={W} height={H} fill={SURFACE} />
      {[0, 1, yMax].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={v === 1 ? MUTED : GRID} strokeWidth={1} strokeDasharray={v === 1 ? "4 3" : undefined} />
          <text x={PAD.l - 4} y={y(v) + 3} fill={MUTED} fontSize={9} textAnchor="end">
            {v}×
          </text>
        </g>
      ))}
      {/* Below the dashed line at the left, clear of a curve sitting just above 1×. */}
      <text x={PAD.l + 4} y={y(1) + 11} fill={MUTED} fontSize={9}>
        sharp limit
      </text>
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 8} fill={MUTED} fontSize={9} textAnchor="middle">
          {formatDistance(t, units).replace(" ", "")}
        </text>
      ))}
      <path d={path} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {hover !== null && (
        <g>
          <line x1={x(points[hover].d)} x2={x(points[hover].d)} y1={PAD.t} y2={H - PAD.b} stroke={MUTED} strokeWidth={1} />
          <circle cx={x(points[hover].d)} cy={y(points[hover].r)} r={4} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
        </g>
      )}
      {points.some((p) => p.r > Y_CAP) && (
        <text x={PAD.l + 4} y={PAD.t + 9} fill={MUTED} fontSize={9}>
          off scale above {Y_CAP}×
        </text>
      )}
    </svg>
  );
}

function BarChart({ bars, onHover, hover }: { bars: { f: number; r: number }[]; onHover: (i: number | null) => void; hover: number | null }) {
  const yMax = Math.min(Y_CAP, Math.max(2, ...bars.map((b) => b.r)));
  const y = (r: number) => PAD.t + (1 - Math.min(r, yMax) / yMax) * (H - PAD.t - PAD.b);
  const slot = (W - PAD.l - PAD.r) / bars.length;
  const bw = Math.min(28, slot - 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cal-chart" fontFamily="Archivo, system-ui, sans-serif" role="img" aria-label="Subject blur by focal length at this distance and aperture" onPointerLeave={() => onHover(null)}>
      <rect x={0} y={0} width={W} height={H} fill={SURFACE} />
      {[0, 1, yMax].map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={v === 1 ? MUTED : GRID} strokeWidth={1} strokeDasharray={v === 1 ? "4 3" : undefined} />
          <text x={PAD.l - 4} y={y(v) + 3} fill={MUTED} fontSize={9} textAnchor="end">
            {v}×
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const cx = PAD.l + slot * (i + 0.5);
        const top = y(b.r);
        const h = Math.max(0, H - PAD.b - top);
        return (
          <g key={b.f} onPointerEnter={() => onHover(i)}>
            {/* Hit target bigger than the mark */}
            <rect x={cx - slot / 2} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill="transparent" />
            <path d={`M${cx - bw / 2},${H - PAD.b} V${top + Math.min(4, h)} Q${cx - bw / 2},${top} ${cx - bw / 2 + 4},${top} H${cx + bw / 2 - 4} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + Math.min(4, h)} V${H - PAD.b} Z`} fill={SERIES} opacity={hover === null || hover === i ? 1 : 0.55} />
            <text x={cx} y={H - 8} fill={MUTED} fontSize={9} textAnchor="middle">
              {b.f} mm
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Rangefinder calibration simulator (feature #7): diagnostic education, not a repair procedure. */
export default function RangefinderCalibration({ lens, fNumber, cocMm, units }: Props) {
  const [m, setM] = useState<Misalignment>(ALIGNED);
  const [subjectMm, setSubjectMm] = useState(3000);
  const [hoverLine, setHoverLine] = useState<number | null>(null);
  const [hoverBar, setHoverBar] = useState<number | null>(null);
  const charts = useRef<HTMLDivElement>(null);

  const result = focusError(lens.focalMm, fNumber, cocMm, subjectMm, m);
  const points = chartDistances(Math.max(700, lens.minFocusMm)).map((d) => ({ d, r: focusError(lens.focalMm, fNumber, cocMm, d, m).blurRatio }));
  const bars = FOCALS.map((f) => ({ f, r: focusError(f, fNumber, cocMm, subjectMm, m).blurRatio }));
  const aligned = m.horizontalArcmin === 0 && m.verticalArcmin === 0 && m.baselineErrorPct === 0;
  const set = (k: keyof Misalignment) => (e: { target: { value: string } }) => setM((v) => ({ ...v, [k]: Number(e.target.value) }));

  function exportPng() {
    setHoverLine(null);
    setHoverBar(null);
    // Let the hover highlight clear before copying the charts.
    requestAnimationFrame(() => requestAnimationFrame(() => renderPng()));
  }

  function renderPng() {
    const svgs = charts.current?.querySelectorAll("svg.cal-chart");
    if (!svgs || svgs.length < 2) return;
    const lines = [
      `Rangefinder diagnostic (simulation) — ${lens.name} at ${formatFNumber(fNumber)}`,
      `Horizontal ${m.horizontalArcmin}′ · vertical ${m.verticalArcmin}′ · baseline ${m.baselineErrorPct}% · subject ${formatDistance(subjectMm, units)}`,
      `Focused at ${Number.isFinite(result.focusMm) ? formatDistance(result.focusMm, units) : "∞"}; blur ${result.blurRatio.toFixed(1)}× the circle of confusion`,
      "Education only — not a calibration procedure. See a qualified technician.",
    ];
    const text = lines.map((l, i) => `<text x="12" y="${22 + i * 18}" fill="${INK}" font-size="13" font-family="sans-serif">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`).join("");
    const inner = [...svgs].map((s, i) => `<g transform="translate(${12 + i * (W + 12)},96)" font-family="system-ui, sans-serif">${s.innerHTML}</g>`).join("");
    const width = 12 + 2 * (W + 12);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${96 + H + 12}"><rect width="100%" height="100%" fill="${SURFACE}"/>${text}${inner}</svg>`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width * 2;
      c.height = (96 + H + 12) * 2;
      const g = c.getContext("2d")!;
      g.scale(2, 2);
      g.drawImage(img, 0, 0);
      c.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "rangefinder-diagnostic.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, "image/png");
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const hp = hoverLine !== null ? points[hoverLine] : null;
  const hb = hoverBar !== null ? bars[hoverBar] : null;

  return (
    <section className="panel stage-calibration" aria-label="Rangefinder calibration simulator">
      <div className="panel-head">
        <h2>Rangefinder calibration</h2>
      </div>
      <p className="cal-service small" role="note">
        <strong>Service note:</strong> this is diagnostic education — what a misaligned rangefinder does to focus — not a calibration procedure. If your camera
        misfocuses, have it checked by a qualified technician.
      </p>

      <div className="cal-controls">
        <label className="field">
          <span>Horizontal offset · {m.horizontalArcmin}′</span>
          <input type="range" min={-10} max={10} step={0.5} value={m.horizontalArcmin} onChange={set("horizontalArcmin")} />
        </label>
        <label className="field">
          <span>Vertical offset · {m.verticalArcmin}′</span>
          <input type="range" min={0} max={10} step={0.5} value={m.verticalArcmin} onChange={set("verticalArcmin")} />
        </label>
        <label className="field">
          <span>Baseline error · {m.baselineErrorPct}%</span>
          <input type="range" min={-3} max={3} step={0.25} value={m.baselineErrorPct} onChange={set("baselineErrorPct")} />
        </label>
        <label className="field">
          <span>Subject distance · {formatDistance(subjectMm, units)}</span>
          <input type="range" min={Math.max(700, lens.minFocusMm)} max={10000} step={50} value={subjectMm} onChange={(e) => setSubjectMm(Number(e.target.value))} />
        </label>
      </div>

      <div className="cal-result">
        <svg className="cal-patch" viewBox="0 0 80 80" role="img" aria-label={m.verticalArcmin > 0 ? "Patch images offset vertically" : "Patch images coincide"}>
          <circle cx={40} cy={40} r={36} fill="#2a2d33" stroke="#555" />
          <rect x={37} y={10} width={6} height={60} fill="#cfcfcf" />
          <rect x={37} y={10 + Math.min(m.verticalArcmin, 10) * 2} width={6} height={60} fill="#e9c46a" opacity={0.6} />
        </svg>
        <p className="small" aria-live="polite">
          With the patch lined up on a subject {formatDistance(subjectMm, units)} away, the lens is focused at{" "}
          <strong>{result.pastInfinity ? "infinity (it would need to go past it)" : Number.isFinite(result.focusMm) ? formatDistance(result.focusMm, units) : "infinity"}</strong>.{" "}
          {aligned
            ? "No misalignment: focus is exactly on the subject."
            : `Subject blur: ${result.blurRatio.toFixed(1)}× the circle of confusion (${result.blurRatio <= 1 ? "still sharp" : "visibly soft"}) with the ${lens.focalMm} mm at ${formatFNumber(fNumber)}.`}
          {m.verticalArcmin > 0 && " The vertical offset makes the patch harder to judge but doesn't move focus by itself."}
          {(() => {
            const inf = infinityEffect(m);
            if (!inf) return null;
            return inf.kind === "stops-short"
              ? ` At the far end it can't reach true infinity: set to ∞, the lens actually focuses at ${formatDistance(inf.focusMm, units)}.`
              : ` At the far end, nothing beyond ${formatDistance(inf.distanceMm, units)} can be lined up — the patch would need to go past infinity.`;
          })()}
        </p>
      </div>

      <div ref={charts} className="cal-charts">
        <figure className="cal-figure">
          <figcaption className="small">Blur across distance · {lens.focalMm} mm at {formatFNumber(fNumber)}</figcaption>
          <div className="cal-chart-wrap">
            <LineChart points={points} units={units} onHover={setHoverLine} hover={hoverLine} />
            {hp && (
              <span className="cal-tip small" role="status">
                {formatDistance(hp.d, units)}: {hp.r.toFixed(1)}×
              </span>
            )}
          </div>
        </figure>
        <figure className="cal-figure">
          <figcaption className="small">Blur by focal length · subject {formatDistance(subjectMm, units)}, {formatFNumber(fNumber)}</figcaption>
          <div className="cal-chart-wrap">
            <BarChart bars={bars} onHover={setHoverBar} hover={hoverBar} />
            {hb && (
              <span className="cal-tip small" role="status">
                {hb.f} mm: {hb.r.toFixed(1)}×
              </span>
            )}
          </div>
        </figure>
      </div>
      <details className="cal-table">
        <summary className="small">Table</summary>
        <table className="small">
          <thead>
            <tr>
              <th>Focal length</th>
              <th>Blur ÷ CoC at {formatDistance(subjectMm, units)}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.f}>
                <td>{b.f} mm</td>
                <td>{b.r.toFixed(2)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="cal-actions">
        <button type="button" className="btn btn-small" onClick={() => setM(ALIGNED)} disabled={aligned}>
          Reset to aligned
        </button>
        <button type="button" className="btn btn-small" onClick={exportPng}>
          Save diagnostic image
        </button>
      </div>
      <details className="cal-model">
        <summary className="small">Model and units</summary>
        <p className="muted small">
          {CALIBRATION_ASSUMPTIONS.notes} Positive horizontal offset makes the rangefinder read closer than the subject; negative, further (past a point it can&apos;t reach
          infinity). Longer and faster lenses show the same offset as more blur.
        </p>
      </details>
    </section>
  );
}
