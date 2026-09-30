import { useState } from "react";
import { RECIPROCITY, correct } from "../data/reciprocity";
import { t, useLang } from "../i18n";
import { ND_FILTERS, flashAperture, flashReach, formatLong, parseTime, ringAperture, withNd } from "../physics/exposureCalc";
import { formatFNumber } from "../utils/format";

const ISOS = [25, 50, 100, 200, 400, 800, 1600, 3200];

/**
 * Exposure calculators (#53): a long exposure through ND filters with the
 * film's own reciprocity correction, and a flash guide-number calculator.
 */
export default function ExposureCalcs() {
  useLang();
  return (
    <section className="panel stage-calcs cx" aria-label={t("tool.calcs")}>
      <LongExposure />
      <Flash />
    </section>
  );
}

function LongExposure() {
  const [metered, setMetered] = useState("1/125");
  const [nd, setNd] = useState<number[]>([10]);
  const [film, setFilm] = useState("digital");
  const base = parseTime(metered);
  const stops = nd.reduce((a, b) => a + b, 0);
  const afterNd = base ? withNd(base, stops) : null;
  const rec = afterNd && film !== "digital" ? correct(film, afterNd) : null;
  const final = rec?.ok ? rec.seconds : afterNd;
  const entry = RECIPROCITY[film];

  return (
    <div className="cx-block">
      <h2 className="cx-h">{t("calc.long")}</h2>
      <div className="cx-grid">
        <label className="field">
          <span>{t("calc.metered")}</span>
          <input type="text" value={metered} placeholder="1/125" onChange={(e) => setMetered(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("dev.film")}</span>
          <select value={film} onChange={(e) => setFilm(e.target.value)}>
            <option value="digital">{t("calc.digital")}</option>
            {Object.entries(RECIPROCITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v.name}
              </option>
            ))}
            <option value="gold200">{t("calc.otherFilm")}</option>
          </select>
        </label>
      </div>
      <p className="pp-h3">{t("calc.filters")}</p>
      <div className="cx-actions" role="group" aria-label={t("calc.filters")}>
        {ND_FILTERS.map((f) => {
          const on = nd.includes(f.stops);
          return (
            <button key={f.label} type="button" className={`cx-pick${on ? " cx-pick-on" : ""}`} aria-pressed={on} onClick={() => setNd((x) => (on ? x.filter((s) => s !== f.stops) : [...x, f.stops]))}>
              {f.label}
            </button>
          );
        })}
      </div>
      <p className="cx-quiet">{t("calc.stack")}</p>
      {!base ? (
        <p className="cx-quiet">{t("calc.typeTime")}</p>
      ) : (
        <div className="cx-plate">
          <p className="cx-plate-no">{final ? formatLong(final) : "—"}</p>
          <p className="cx-plate-what">{t("calc.withNd", { stops: stops, time: formatLong(afterNd!) })}</p>
          {rec?.ok && rec.stops > 0.05 && <p>{t("calc.reciprocity", { stops: rec.stops.toFixed(1), time: formatLong(rec.seconds) })}</p>}
          {rec && !rec.ok && rec.reason === "beyond" && <p className="cx-warn">{t("calc.beyond", { t: formatLong(rec.upTo!) })}</p>}
          {rec && !rec.ok && rec.reason === "unknown" && <p className="cx-warn">{t("calc.unknown")}</p>}
          {entry && film !== "digital" && <p className="cx-source">{entry.model.source}</p>}
          {final && final > 30 && <p className="cx-quiet">{t("calc.bulb")}</p>}
        </div>
      )}
      <p className="cx-quiet">{t("calc.recHonest")}</p>
    </div>
  );
}

function Flash() {
  const [gn, setGn] = useState("20");
  const [iso, setIso] = useState(100);
  const [distance, setDistance] = useState("3");
  const [f, setF] = useState(5.6);
  const g = Number(gn.replace(",", "."));
  const d = Number(distance.replace(",", "."));
  const exact = g > 0 && d > 0 ? flashAperture(g, iso, d) : null;
  return (
    <div className="cx-block">
      <h2 className="cx-h">{t("calc.flash")}</h2>
      <div className="cx-grid">
        <label className="field">
          <span>{t("calc.gn")}</span>
          <input type="text" inputMode="decimal" value={gn} onChange={(e) => setGn(e.target.value)} />
        </label>
        <label className="field">
          <span>ISO</span>
          <select value={iso} onChange={(e) => setIso(Number(e.target.value))}>
            {ISOS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("calc.distance")}</span>
          <input type="text" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />
        </label>
      </div>
      {exact && (
        <p className="cx-ok">
          {t("calc.setAperture", { f: formatFNumber(ringAperture(exact)), exact: exact.toFixed(1) })}
        </p>
      )}
      <label className="field cx-narrow">
        <span>{t("calc.orAperture")}</span>
        <select value={f} onChange={(e) => setF(Number(e.target.value))}>
          {[1.4, 2, 2.8, 4, 5.6, 8, 11, 16].map((x) => (
            <option key={x} value={x}>
              {formatFNumber(x)}
            </option>
          ))}
        </select>
      </label>
      {g > 0 && <p className="cx-ok">{t("calc.reach", { m: flashReach(g, iso, f).toFixed(1) })}</p>}
      <p className="cx-quiet">{t("calc.sync")}</p>
    </div>
  );
}
