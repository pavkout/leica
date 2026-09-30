import { useEffect, useRef, useState } from "react";
import { t, useLang } from "../../i18n";
import { adjustStops, mix, newSizeTime, parseDilution, stripIncrements, testStripTimes } from "../../physics/printing";
import { getString, setString } from "../../services/persistence";
import { playTone, unlockTones } from "../../services/cueTone";
import { setSafelight, useSafelight } from "../../state/safelight";
import { useWakeLock } from "../../utils/useWakeLock";

const STEPS = [
  { v: 1 / 6, label: "1/6" },
  { v: 1 / 4, label: "1/4" },
  { v: 1 / 3, label: "1/3" },
  { v: 1 / 2, label: "1/2" },
  { v: 1, label: "1" },
];

const CHEM_KEY = "rangefinder-chemistry";

interface Chem {
  id: string;
  name: string;
  capacity: number;
  used: number;
  unit: "films" | "prints";
}

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const secs = (x: number) => `${x.toFixed(1).replace(/\.0$/, "")} s`;

/**
 * Printing (#52): an enlarger timer that runs a whole f-stop test strip one
 * exposure at a time, print-size and f-stop changes, and chemistry mixing
 * with a use counter for each bottle.
 */
export default function Printing() {
  useLang();
  return (
    <section className="panel stage-printing cx" aria-label={t("tool.printing")}>
      <Enlarger />
      <SizeChange />
      <Mixing />
      <Chemistry />
    </section>
  );
}

function Enlarger() {
  const [base, setBase] = useState("8");
  const [step, setStep] = useState(1 / 3);
  const [count, setCount] = useState(6);
  const [mode, setMode] = useState<"strip" | "single">("strip");
  const [single, setSingle] = useState("12");
  const b = num(base) ?? 8;
  const totals = mode === "strip" ? testStripTimes(b, step, count) : [num(single) ?? 12];
  const exposures = mode === "strip" ? stripIncrements(totals) : totals;
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState<{ start: number; secs: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const safelight = useSafelight();
  useWakeLock(running !== null || index > 0);
  const done = useRef(false);

  useEffect(() => {
    if (!running) return;
    done.current = false;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  const left = running ? Math.max(0, running.secs - (now - running.start) / 1000) : 0;
  useEffect(() => {
    if (running && left <= 0 && !done.current) {
      done.current = true;
      playTone(index + 1 >= exposures.length ? "done" : "next");
      setRunning(null);
      setIndex((i) => i + 1);
    }
  }, [left, running, index, exposures.length]);

  const finished = index >= exposures.length;
  const reset = () => (setIndex(0), setRunning(null));

  return (
    <div className="cx-block">
      <h2 className="cx-h">{t("pr.enlarger")}</h2>
      <div className="cx-actions" role="group" aria-label={t("pr.enlarger")}>
        {(["strip", "single"] as const).map((m) => (
          <button key={m} type="button" className={`cx-pick${mode === m ? " cx-pick-on" : ""}`} aria-pressed={mode === m} onClick={() => (setMode(m), reset())}>
            {t(`pr.mode.${m}`)}
          </button>
        ))}
      </div>
      {mode === "strip" ? (
        <div className="cx-grid">
          <label className="field">
            <span>{t("pr.base")}</span>
            <input type="text" inputMode="decimal" value={base} onChange={(e) => (setBase(e.target.value), reset())} />
          </label>
          <label className="field">
            <span>{t("pr.step")}</span>
            <select value={step} onChange={(e) => (setStep(Number(e.target.value)), reset())}>
              {STEPS.map((s) => (
                <option key={s.label} value={s.v}>
                  {t("pr.stepN", { n: s.label })}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("pr.count")}</span>
            <input type="number" min={2} max={12} value={count} onChange={(e) => (setCount(Math.min(12, Math.max(2, Number(e.target.value) || 6))), reset())} />
          </label>
        </div>
      ) : (
        <label className="field cx-narrow">
          <span>{t("pr.time")}</span>
          <input type="text" inputMode="decimal" value={single} onChange={(e) => (setSingle(e.target.value), reset())} />
        </label>
      )}

      {mode === "strip" && (
        <table className="hc-table">
          <thead>
            <tr>
              <th>{t("pr.strip")}</th>
              <th>{t("pr.total")}</th>
              <th>{t("pr.expose")}</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((x, i) => (
              <tr key={i} className={i === index && !finished ? "hc-attention" : i < index ? "dev-past" : undefined}>
                <td>{i + 1}</td>
                <td>{secs(x)}</td>
                <td>{secs(exposures[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {mode === "strip" && <p className="cx-quiet">{t("pr.stripHow")}</p>}

      <div className={`pr-timer${running ? " pr-on" : ""}`}>
        <p className="dev-clock">{running ? left.toFixed(1) : finished ? "✓" : exposures[index].toFixed(1)}</p>
        <p className="dev-say" role="status" aria-live="polite">
          {running ? t("pr.exposing") : finished ? t("pr.done") : mode === "strip" ? t("pr.next", { i: index + 1, n: exposures.length }) : t("pr.ready")}
        </p>
      </div>
      <div className="cx-actions">
        {!finished && (
          <button
            type="button"
            className="btn btn-red"
            disabled={running !== null}
            onClick={() => {
              unlockTones();
              playTone("agitate");
              setRunning({ start: Date.now(), secs: exposures[index] });
            }}
          >
            {t("pr.go", { s: secs(exposures[index]) })}
          </button>
        )}
        <button type="button" className="btn" onClick={reset}>
          {t("pr.reset")}
        </button>
        <button type="button" className="btn" onClick={() => setSafelight(!safelight)}>
          {safelight ? t("dev.safelightOff") : t("dev.safelightOn")}
        </button>
      </div>
      <p className="cx-quiet">{t("pr.timerNote")}</p>
    </div>
  );
}

function SizeChange() {
  const [time, setTime] = useState("12");
  const [from, setFrom] = useState("240");
  const [to, setTo] = useState("360");
  const [stops, setStops] = useState(0.5);
  const tm = num(time);
  const f = num(from);
  const tt = num(to);
  return (
    <div className="cx-block">
      <h2 className="cx-h">{t("pr.change")}</h2>
      <div className="cx-grid">
        <label className="field">
          <span>{t("pr.time")}</span>
          <input type="text" inputMode="decimal" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("pr.fromSize")}</span>
          <input type="text" inputMode="decimal" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("pr.toSize")}</span>
          <input type="text" inputMode="decimal" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {tm && f && tt && <p className="cx-ok">{t("pr.newTime", { s: secs(newSizeTime(tm, f, tt)) })}</p>}
      <p className="cx-quiet">{t("pr.sizeNote")}</p>
      <div className="cx-grid">
        <label className="field">
          <span>{t("pr.adjust")}</span>
          <select value={stops} onChange={(e) => setStops(Number(e.target.value))}>
            {[-1, -0.5, -1 / 3, -1 / 6, 1 / 6, 1 / 3, 0.5, 1].map((s) => (
              <option key={s} value={s}>
                {s > 0 ? "+" : "−"}
                {Math.abs(s) === 1 / 3 ? "1/3" : Math.abs(s) === 1 / 6 ? "1/6" : Math.abs(s) === 0.5 ? "1/2" : "1"} {t("pr.stop")}
              </option>
            ))}
          </select>
        </label>
      </div>
      {tm && <p className="cx-ok">{t("pr.adjusted", { s: secs(adjustStops(tm, stops)) })}</p>}
    </div>
  );
}

function Mixing() {
  const [volume, setVolume] = useState("500");
  const [dilution, setDilution] = useState("1+9");
  const v = num(volume);
  const n = parseDilution(dilution);
  const m = v && n !== null ? mix(v, n) : null;
  return (
    <div className="cx-block">
      <h2 className="cx-h">{t("pr.mix")}</h2>
      <div className="cx-grid">
        <label className="field">
          <span>{t("pr.volume")}</span>
          <input type="text" inputMode="decimal" value={volume} onChange={(e) => setVolume(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("dev.dilution")}</span>
          <input type="text" value={dilution} placeholder="1+9" onChange={(e) => setDilution(e.target.value)} />
        </label>
      </div>
      {m ? (
        <p className="cx-ok">{t("pr.mixResult", { c: m.concentrate, w: m.water })}</p>
      ) : (
        <p className="cx-quiet">{t("pr.mixHint")}</p>
      )}
    </div>
  );
}

function loadChem(): Chem[] {
  try {
    const x = JSON.parse(getString(CHEM_KEY) ?? "[]") as Chem[];
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
}

function Chemistry() {
  const [list, setList] = useState<Chem[]>(loadChem);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [unit, setUnit] = useState<Chem["unit"]>("films");
  const save = (next: Chem[]) => {
    setList(next);
    setString(CHEM_KEY, JSON.stringify(next));
  };
  return (
    <div className="cx-block">
      <h2 className="cx-h">{t("pr.chem")}</h2>
      <p className="cx-quiet">{t("pr.chemHint")}</p>
      {list.length > 0 && (
        <ul className="fs-list">
          {list.map((c) => {
            const left = c.capacity - c.used;
            return (
              <li key={c.id} className={left <= 0 ? "fs-expired" : left <= c.capacity * 0.15 ? "fs-soon" : undefined}>
                <span className="fs-name">{c.name}</span>
                <span className={left <= 0 ? "fs-exp-warn" : "cx-quiet"}>{left <= 0 ? t("pr.exhausted") : t(`pr.left.${c.unit}`, { n: left, of: c.capacity })}</span>
                <span className="cx-actions">
                  <button type="button" className="btn" onClick={() => save(list.map((x) => (x.id === c.id ? { ...x, used: x.used + 1 } : x)))}>
                    {t(`pr.used.${c.unit}`)}
                  </button>
                  <button type="button" className="cx-link" onClick={() => save(list.map((x) => (x.id === c.id ? { ...x, used: 0 } : x)))}>
                    {t("pr.fresh")}
                  </button>
                  <button type="button" className="cx-link" onClick={() => save(list.filter((x) => x.id !== c.id))}>
                    {t("common.remove")}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="cx-grid">
        <label className="field">
          <span>{t("pr.chemName")}</span>
          <input type="text" value={name} placeholder="Rapid fixer 1+4" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("pr.capacity")}</span>
          <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("pr.unit")}</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value as Chem["unit"])}>
            <option value="films">{t("pr.unit.films")}</option>
            <option value="prints">{t("pr.unit.prints")}</option>
          </select>
        </label>
      </div>
      <div className="cx-actions">
        <button
          type="button"
          className="btn"
          disabled={!name.trim() || !num(capacity)}
          onClick={() => {
            save([...list, { id: Date.now().toString(36), name: name.trim(), capacity: Math.round(num(capacity)!), used: 0, unit }]);
            setName("");
            setCapacity("");
          }}
        >
          {t("pr.addChem")}
        </button>
      </div>
    </div>
  );
}
