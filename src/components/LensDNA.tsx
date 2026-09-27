import { useState } from "react";
import type { Lens } from "../data/gear";
import ApertureStops from "./ApertureStops";
import { lensDNA, reachableFNumber, type CharacterProvenance, type DnaRow } from "../physics/lensCharacter";
import { apertureShape, irisOutline } from "../preview/aperture";
import { formatDistance, formatFNumber, type Units } from "../utils/format";

interface Props {
  lens: Lens;
  /** Lenses that fit the current body, for the comparison picker. */
  lenses: Lens[];
  fNumber: number;
  cocMm: number;
  frameWidthMm: number;
  frameHeightMm: number;
  digital: boolean;
  units: Units;
  /** The app's aperture setter: the stop buttons here change the real simulator state. */
  onAperture: (fNumber: number) => void;
}

const BADGE: Record<CharacterProvenance, string> = {
  calculated: "Calculated",
  published: "Published",
  measured: "Measured",
  community: "Community",
  approximate: "Approximation",
  none: "No data",
};

function formatValue(row: DnaRow, fNumber: number, units: Units): string {
  if (row.value === null) return "No data";
  switch (row.key) {
    case "minFocus":
      return formatDistance(row.value as number, units);
    case "apertures":
      return `f/${row.value}`;
    case "bokeh":
      return `${row.detail} blades${(row.value as number) >= 0.99 ? ", round" : ""}`;
    case "naturalVignetting":
      return `${(row.value as number).toFixed(1)} stops at the corners`;
    case "mechanicalVignetting":
      return (row.value as number) > 0.05 ? `${(row.value as number).toFixed(1)} stops at the corners` : "None at this aperture";
    case "diffraction":
      return `f/${Math.round(row.value as number)}${fNumber > (row.value as number) ? " — past it now" : ""}`;
    case "distortion":
      return `${(row.value as number) > 0 ? "+" : ""}${row.value}%`;
    default:
      return String(row.value);
  }
}

function IrisShape({ lens, fNumber }: { lens: Lens; fNumber: number }) {
  const r = 18 * (lens.maxAperture / fNumber) ** 0.5;
  const d =
    irisOutline(apertureShape(lens, fNumber), 72)
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${(22 + x * r).toFixed(2)},${(22 + y * r).toFixed(2)}`)
      .join(" ") + " Z";
  return (
    <svg className="dna-iris" viewBox="0 0 44 44" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Cell({ row, fNumber, units, lens, who }: { row: DnaRow; fNumber: number; units: Units; lens: Lens; who?: string }) {
  return (
    <div className="dna-cell">
      {/* In comparison on a phone the columns stack, so each value names its lens. */}
      {who && <span className="dna-who muted small">{who}</span>}
      <div className="dna-value">
        {row.key === "bokeh" && <IrisShape lens={lens} fNumber={fNumber} />}
        <span className={row.value === null ? "muted" : undefined}>{formatValue(row, fNumber, units)}</span>
        <span className={`dna-badge dna-${row.provenance}`}>{BADGE[row.provenance]}</span>
      </div>
      <details className="dna-about">
        <summary>About</summary>
        <p className="muted small">{row.note}</p>
      </details>
    </div>
  );
}

/** Lens DNA (feature #4): lens character from calculated physics, published specs and sourced data only. */
export default function LensDNA({ lens, lenses, fNumber, cocMm, frameWidthMm, frameHeightMm, digital, units, onAperture }: Props) {
  const [otherId, setOtherId] = useState("");
  const other = lenses.find((l) => l.id === otherId && l.id !== lens.id) ?? null;
  const ctx = { cocMm, frameHalfDiagonalMm: Math.hypot(frameWidthMm, frameHeightMm) / 2, digital };
  const rowsA = lensDNA(lens, { ...ctx, fNumber });
  const nB = other ? reachableFNumber(other, fNumber) : fNumber;
  const rowsB = other ? lensDNA(other, { ...ctx, fNumber: nB }) : null;

  return (
    <section className="panel stage-dna" aria-label="Lens DNA">
      <div className="panel-head">
        <h2>Lens DNA</h2>
      </div>
      <p className="muted small">
        What changes with aperture, from physics and published specs only. Every value says where it comes from; where the app has no data, it says so instead of guessing.
      </p>

      <ApertureStops lens={lens} fNumber={fNumber} onAperture={onAperture} label="Lens DNA aperture" />

      <label className="field field-narrow">
        <span>Compare with</span>
        <select value={other?.id ?? ""} onChange={(e) => setOtherId(e.target.value)}>
          <option value="">—</option>
          {lenses
            .filter((l) => l.id !== lens.id)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
        </select>
      </label>
      {other && nB !== fNumber && (
        <p className="warn-text small" aria-live="polite">
          {other.name} can't be set to {formatFNumber(fNumber)}; it's shown at {formatFNumber(nB)} ({Math.abs(2 * Math.log2(nB / fNumber)).toFixed(1)} stops {nB > fNumber ? "less" : "more"} light).
        </p>
      )}

      <div className={other ? "dna-table dna-compare" : "dna-table"} role="table" aria-label={other ? `${lens.name} compared with ${other.name}` : `${lens.name} character`}>
        <div className="dna-row dna-head" role="row">
          <span role="columnheader">Characteristic</span>
          <span role="columnheader">
            {lens.name} · {formatFNumber(fNumber)}
          </span>
          {other && (
            <span role="columnheader">
              {other.name} · {formatFNumber(nB)}
            </span>
          )}
        </div>
        {rowsA.map((row, i) => (
          <div className="dna-row" role="row" key={row.key}>
            <span className="dna-label" role="rowheader">
              {row.label}
            </span>
            <span role="cell">
              <Cell row={row} fNumber={fNumber} units={units} lens={lens} who={other ? lens.name : undefined} />
            </span>
            {other && rowsB && (
              <span role="cell">
                <Cell row={rowsB[i]} fNumber={nB} units={units} lens={other} who={other.name} />
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
