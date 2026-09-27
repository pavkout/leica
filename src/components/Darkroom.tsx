import { useState } from "react";
import { DEVELOP_LEVELS, eiStops as eiStopsOf } from "../physics/pushPull";
import {
  AGITATIONS,
  DEVELOPER_TYPES,
  DILUTIONS,
  REFERENCE_CHOICE,
  colourProcess,
  conceptualResult,
  densityAt,
  lookupTime,
  type Agitation,
  type DevelopChoice,
  type DeveloperType,
  type Dilution,
} from "../physics/darkroom";
import { FILM_STOCKS, type FilmLook } from "../preview/film";
import Segmented from "./Segmented";

interface Props {
  /** The film loaded in the camera (null on a digital body). */
  rollFilm: FilmLook | null;
  rollFrames: number;
  boxIso: number;
  /** The EI the roll is rated at, or null for box speed. */
  rollEi: number | null;
  /** Shared push/pull development state (drives the roll's preview). */
  pushPullStops: number;
  onPushPull: (stops: number) => void;
  recorded: string | null;
  onRecord: (filmId: string, choice: DevelopChoice) => void;
}

const BW = FILM_STOCKS.filter((f) => f.kind === "bw");
const CHART = { w: 300, h: 170, left: 34, right: 8, top: 10, bottom: 28 };
/** Log exposure (0.3 per stop): ±6 stops around middle grey. */
const X_MIN = -1.8;
const X_MAX = 1.8;
const D_MAX = 2.4;

function tendency(v: number) {
  if (v > 1.04) return "higher";
  if (v < 0.96) return "lower";
  return "about the same";
}

/** Darkroom mode (feature #34): a conceptual black-and-white development model, tied to the roll. */
export default function Darkroom({ rollFilm, rollFrames, boxIso, rollEi, pushPullStops, onPushPull, recorded, onRecord }: Props) {
  const rollIsBw = rollFilm?.kind === "bw";
  const [filmId, setFilmId] = useState(() => (rollIsBw ? rollFilm!.id : BW[0].id));
  const [choice, setChoice] = useState<DevelopChoice>(() => ({ ...REFERENCE_CHOICE, developStops: pushPullStops }));
  const onRoll = rollIsBw && filmId === rollFilm!.id;
  const film = BW.find((f) => f.id === filmId) ?? BW[0];
  // The roll's rating ties the model to what was actually shot.
  const eiStops = onRoll && rollEi !== null ? eiStopsOf(boxIso, rollEi) : 0;
  const developStops = onRoll ? pushPullStops : choice.developStops;
  const c = { ...choice, developStops };
  const r = conceptualResult(film, c, eiStops);
  const normal = conceptualResult(film, REFERENCE_CHOICE, 0);
  const time = lookupTime(film.id, c.developer, c.dilution, c.temperatureC, c.developStops);
  const colour = rollFilm ? colourProcess(rollFilm) : null;
  const set = (patch: Partial<DevelopChoice>) => setChoice((prev) => ({ ...prev, ...patch }));

  const sx = (x: number) => CHART.left + ((x - X_MIN) / (X_MAX - X_MIN)) * (CHART.w - CHART.left - CHART.right);
  const sy = (d: number) => CHART.top + (1 - d / D_MAX) * (CHART.h - CHART.top - CHART.bottom);
  const path = (fn: (x: number) => number) =>
    Array.from({ length: 61 }, (_, i) => X_MIN + (i / 60) * (X_MAX - X_MIN))
      .map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(fn(x)).toFixed(1)}`)
      .join(" ");

  return (
    <section className="panel stage-darkroom" aria-label="Darkroom">
      <div className="panel-head">
        <h2>Darkroom</h2>
        <span className="dna-badge dna-illustrative" title={r.provenance.notes}>
          Conceptual
        </span>
      </div>
      <p className="muted small">
        How development choices shift contrast, grain and sharpness for black-and-white film. A learning model, not a process: it gives no
        times.
      </p>
      {colour && (
        <p className="small dr-note" role="note">
          The loaded {rollFilm!.name} is developed in the standardised {colour} process: developer, dilution and agitation aren't choices, and
          labs push it by extending development. The model below is for black-and-white film.
        </p>
      )}

      <div className="dr-grid">
        <label className="field">
          <span>Film</span>
          <select value={filmId} onChange={(e) => setFilmId(e.target.value)}>
            {BW.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
                {rollIsBw && f.id === rollFilm!.id ? " (in the camera)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Developer type</span>
          <select value={c.developer} onChange={(e) => set({ developer: e.target.value as DeveloperType })}>
            {DEVELOPER_TYPES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Dilution</span>
          <select value={c.dilution} onChange={(e) => set({ dilution: e.target.value as Dilution })}>
            {DILUTIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Agitation</span>
          <select value={c.agitation} onChange={(e) => set({ agitation: e.target.value as Agitation })}>
            {AGITATIONS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Temperature · {c.temperatureC} °C</span>
        <input type="range" min={18} max={24} step={0.5} value={c.temperatureC} onChange={(e) => set({ temperatureC: Number(e.target.value) })} />
      </label>
      <Segmented
        label="Development"
        value={developStops}
        onChange={(v) => (onRoll ? onPushPull(v) : set({ developStops: v }))}
        options={DEVELOP_LEVELS.map((l) => ({ value: l.stops, label: l.label }))}
      />
      {onRoll && (
        <p className="muted small">
          Linked to the roll in the camera ({rollFrames} frame{rollFrames === 1 ? "" : "s"}
          {rollEi !== null ? `, rated EI ${rollEi}` : ", box speed"}): changing development also changes the roll's preview.
        </p>
      )}

      <div className="dr-preview">
        <figure className="dr-figure">
          <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} className="dr-chart" role="img" aria-label="Illustrative characteristic curve: normal development against your choice">
            {[0, 0.5, 1, 1.5, 2].map((d) => (
              <g key={d}>
                <line x1={CHART.left} x2={CHART.w - CHART.right} y1={sy(d)} y2={sy(d)} stroke="#2c2d31" strokeWidth={1} />
                <text x={CHART.left - 5} y={sy(d) + 3} textAnchor="end" fill="#8b8b8b" fontSize={9} fontFamily="system-ui, sans-serif">
                  {d.toFixed(1)}
                </text>
              </g>
            ))}
            <text x={(CHART.left + CHART.w) / 2} y={CHART.h - 6} textAnchor="middle" fill="#8b8b8b" fontSize={9} fontFamily="system-ui, sans-serif">
              exposure (stops from middle grey) →
            </text>
            {[-6, -3, 0, 3, 6].map((st) => (
              <text key={st} x={sx(st * 0.3)} y={CHART.h - 17} textAnchor="middle" fill="#8b8b8b" fontSize={9} fontFamily="system-ui, sans-serif">
                {st > 0 ? `+${st}` : st}
              </text>
            ))}
            <path d={path((x) => densityAt(x, normal, 0))} fill="none" stroke="#8b8b8b" strokeWidth={1.5} strokeDasharray="4 3" />
            <path d={path((x) => densityAt(x, r, eiStops))} fill="none" stroke="#3987e5" strokeWidth={2} />
          </svg>
          <figcaption className="muted small">
            Negative density. <span className="dr-key dr-key-ref" /> normal development at box speed · <span className="dr-key dr-key-you" /> your
            choice{eiStops ? `, rated ${eiStops > 0 ? "+" : ""}${eiStops.toFixed(1)} stops` : ""}.
          </figcaption>
        </figure>
        <ul className="dr-result small" aria-label="Conceptual result">
          <li>
            <strong>Contrast:</strong> {tendency(r.contrast)}
          </li>
          <li>
            <strong>Grain:</strong> {tendency(r.grain)}
          </li>
          <li>
            <strong>Edge sharpness:</strong> {tendency(r.acutance)}
          </li>
          <li>
            <strong>Highlights:</strong> {r.highlights < 0.96 ? "held back (compensation)" : r.highlights > 1.04 ? "denser" : "about the same"}
          </li>
          <li>
            <strong>Shadows:</strong>{" "}
            {r.shadowLossStops > 0
              ? `about ${r.shadowLossStops.toFixed(1)} stops of shadow detail were never recorded; ${developStops > 0 ? "pushing adds contrast, not the missing detail" : "more development won't bring it back"}.`
              : "fully recorded"}
          </li>
          {r.unevenRisk && (
            <li>
              <strong>Risk:</strong> minimal agitation can develop unevenly (streaks, uneven skies).
            </li>
          )}
        </ul>
      </div>
      <ul className="dr-notes muted small">
        <li>{DEVELOPER_TYPES.find((d) => d.id === c.developer)!.note}</li>
        <li>{DILUTIONS.find((d) => d.id === c.dilution)!.note}</li>
        <li>{AGITATIONS.find((a) => a.id === c.agitation)!.note}</li>
      </ul>

      <div className="dr-process" role="region" aria-label="Process time">
        <h3>Process time</h3>
        {time ? (
          <p className="small">
            {time.minutes} min at {time.temperatureC} °C — <a href={time.url}>{time.source}</a>
          </p>
        ) : (
          <p className="small">
            No verified time for this film and developer in the app's data, so none is shown. Use the film or developer maker's datasheet, which
            also {c.temperatureC === 20 ? "gives its reference temperature" : `tells you how ${c.temperatureC} °C changes the time (warmer runs faster)`}.
          </p>
        )}
        <p className="muted small">Handle processing chemicals as their safety data sheets direct.</p>
      </div>

      {rollIsBw && rollFrames > 0 && (
        <div className="dr-record">
          <button type="button" className="btn btn-small" disabled={!onRoll} onClick={() => onRecord(film.id, c)}>
            Record for this roll
          </button>
          <span className="muted small">{recorded ? `Recorded: ${recorded}` : onRoll ? "Saves this development to the contact sheet." : `Choose ${rollFilm!.name} to record it for the roll.`}</span>
        </div>
      )}
    </section>
  );
}
