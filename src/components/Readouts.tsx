import type { Shot } from "../physics/model";
import { formatDistance, formatFNumber, formatLength, type Units } from "../utils/format";

export default function Readouts({ shot, units }: { shot: Shot; units: Units }) {
  const { dof } = shot;
  const tiles = [
    { label: "Near", value: formatDistance(dof.nearMm, units) },
    { label: "Far", value: formatDistance(dof.farMm, units) },
    { label: "Depth", value: formatLength(dof.totalMm, units) },
    { label: "Hyperfocal", value: formatDistance(dof.hyperfocalMm, units) },
  ];

  return (
    <section className="panel readouts" aria-label="Depth of field">
      <p className="headline">{headline(shot, units)}</p>
      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className="tile">
            <span className="tile-label">{t.label}</span>
            <span className="tile-value">{t.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function headline(shot: Shot, units: Units) {
  const { dof } = shot;
  const near = formatDistance(dof.nearMm, units);
  if (!Number.isFinite(dof.farMm)) {
    return `Sharp from ${near} to infinity.`;
  }
  return `Sharp from ${near} to ${formatDistance(dof.farMm, units)}.`;
}

export function Details({ shot }: { shot: Shot }) {
  const rows: { label: string; value: string; note?: string; warn?: boolean }[] = [
    {
      label: "Background blur",
      value: Number.isFinite(shot.focusMm)
        ? `${(shot.backgroundBlurFrameFraction * 100).toFixed(shot.backgroundBlurFrameFraction < 0.01 ? 2 : 1)}% of frame width`
        : "none (focused at ∞)",
      note: shot.backgroundBlurPixels
        ? `${formatSensorSize(shot.backgroundBlurMm)} disc ≈ ${Math.round(shot.backgroundBlurPixels)} px`
        : `${formatSensorSize(shot.backgroundBlurMm)} disc on film`,
    },
    {
      label: "Subject scale",
      value: shot.magnification > 0 ? `1 : ${formatRatio(1 / shot.magnification)}` : "—",
    },
    {
      label: "Angle of view",
      value: `${shot.horizontalAngle.toFixed(0)}° horizontal`,
      note: `${shot.diagonalAngle.toFixed(0)}° diagonal`,
    },
    {
      label: "Full-frame equivalent",
      value: `${Math.round(shot.equivalentFocalMm)} mm`,
    },
    {
      label: "Circle of confusion",
      value: `${(shot.cocMm * 1000).toFixed(1)} µm`,
      note: shot.pixelPitchMm ? `pixel pitch ${(shot.pixelPitchMm * 1000).toFixed(2)} µm` : undefined,
    },
    {
      label: "Diffraction",
      value: shot.diffractionLimited
        ? `Softening past ${formatFNumber(round1(shot.diffractionFNumber))}`
        : `Fine up to ${formatFNumber(round1(shot.diffractionFNumber))}`,
      note: `Airy disc ${(shot.airyMm * 1000).toFixed(1)} µm`,
      warn: shot.diffractionLimited,
    },
  ];

  return (
    <dl className="details">
      {rows.map((r) => (
        <div key={r.label} className={r.warn ? "detail warn" : "detail"}>
          <dt>{r.label}</dt>
          <dd>
            {r.value}
            {r.note && <small>{r.note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Sizes on the sensor, which are often a few micrometres. */
function formatSensorSize(mm: number) {
  return mm < 1 ? `${Math.round(mm * 1000)} µm` : `${mm.toFixed(2)} mm`;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function formatRatio(n: number) {
  return n < 10 ? n.toFixed(1) : String(Math.round(n));
}
