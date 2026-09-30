import { useEffect, useRef, useState } from "react";
import { DATASHEET_TIMES, datasheetOptions, datasheetTime } from "../../data/processTimes";
import { t, useLang } from "../../i18n";
import { AGITATION_PRESETS, c41Steps, clock, cues, elapsedSec, filmSteps, pause, resume, skip, stateAt, totalSeconds, type Agitation, type Run, type Step } from "../../physics/devTimer";
import { FILM_STOCKS } from "../../preview/film";
import { getString, setString } from "../../services/persistence";
import { playTone, unlockTones } from "../../services/cueTone";
import { setSafelight, useSafelight } from "../../state/safelight";
import { useWakeLock } from "../../utils/useWakeLock";
import { MinSec } from "./MinSec";

const RUN_KEY = "rangefinder-dev-run";

interface SavedRun {
  run: Run;
  steps: Step[];
  title: string;
}

const DATASHEET_FILMS = [...new Set(DATASHEET_TIMES.map((d) => d.filmId))];
const filmName = (id: string) => FILM_STOCKS.find((f) => f.id === id)?.name ?? id;

function loadRun(): SavedRun | null {
  try {
    const r = JSON.parse(getString(RUN_KEY) ?? "null") as SavedRun | null;
    if (!r || !Array.isArray(r.steps)) return null;
    // JSON has no Infinity: continuous agitation is stored as null.
    r.steps = r.steps.map((s) => (s.agitation && s.agitation.first === null ? { ...s, agitation: { ...s.agitation, first: Infinity } } : s));
    return r;
  } catch {
    return null;
  }
}

/**
 * Development timer (#46): choose the film and chemistry (the datasheet's
 * own time where the app has it), then a step-by-step clock with agitation,
 * "start pouring" and next-step cues, by sound and vibration, on a dim red
 * screen if wanted.
 */
export default function DevelopTimer() {
  useLang();
  const [saved, setSaved] = useState<SavedRun | null>(loadRun);
  if (saved) return <Running saved={saved} onStop={() => (setString(RUN_KEY, ""), setSaved(null))} />;
  return (
    <Setup
      onStart={(steps, title) => {
        unlockTones();
        const next = { run: { startedAt: Date.now(), pausedMs: 0, pausedAt: null }, steps, title };
        setString(RUN_KEY, JSON.stringify(next));
        setSaved(next);
        playTone("agitate");
      }}
    />
  );
}

function Setup({ onStart }: { onStart: (steps: Step[], title: string) => void }) {
  const [process, setProcess] = useState<"bw" | "c41">("bw");
  const [film, setFilm] = useState<string>(DATASHEET_FILMS[0] ?? "own");
  const opts = film === "own" ? null : datasheetOptions(film);
  const [dev, setDev] = useState(opts?.developers[0] ?? "");
  const dils = opts ? opts.dilutions(dev) : [];
  const [dil, setDil] = useState(dils[0] ?? "");
  const temps = opts ? opts.temps(dev, dil) : [];
  const [temp, setTemp] = useState(temps.includes(20) ? 20 : (temps[0] ?? 20));
  const pushes = [...new Set(DATASHEET_TIMES.filter((d) => d.filmId === film && d.developer === dev && d.dilution === dil && d.temperatureC === temp).map((d) => d.developStops))].sort((a, b) => a - b);
  const [push, setPush] = useState(0);
  const sheet = film === "own" ? null : datasheetTime(film, dev, dil, temp, pushes.includes(push) ? push : (pushes[0] ?? 0));
  const [ownSec, setOwnSec] = useState(480);
  const [preset, setPreset] = useState<string>("kodak");
  const [presoak, setPresoak] = useState(false);
  const [stop, setStop] = useState(60);
  const [fix, setFix] = useState(300);
  const [wash, setWash] = useState(600);
  const [wetting, setWetting] = useState(30);
  const [c41, setC41] = useState({ blix: 390, wash: 180, stabilise: 60 });

  // Keep the chosen options valid as the film or developer changes.
  useEffect(() => {
    if (opts && !opts.developers.includes(dev)) setDev(opts.developers[0] ?? "");
  }, [film]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dils.includes(dil)) setDil(dils[0] ?? "");
  }, [dev, film]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!temps.includes(temp)) setTemp(temps.includes(20) ? 20 : (temps[0] ?? 20));
  }, [dev, dil, film]); // eslint-disable-line react-hooks/exhaustive-deps
  // The film maker's own agitation, by default.
  useEffect(() => {
    if (sheet) setPreset(/ilford|harman/i.test(sheet.source) ? "ilford" : "kodak");
  }, [sheet?.source]); // eslint-disable-line react-hooks/exhaustive-deps

  const agitation: Agitation = AGITATION_PRESETS.find((p) => p.id === preset)!.agitation;
  const devSec = process === "c41" ? 195 : sheet ? Math.round(sheet.minutes * 60) : ownSec;
  const steps =
    process === "c41"
      ? c41Steps(agitation, c41)
      : filmSteps(devSec, agitation, { presoak, stop, fix, wash, wetting });
  const title = process === "c41" ? "C-41" : sheet ? `${filmName(film)} · ${sheet.developer} ${sheet.dilution} · ${sheet.temperatureC} °C` : t("dev.ownTime");

  return (
    <section className="panel stage-develop cx" aria-label={t("tool.develop")}>
      <ol className="cx-flow">
        <li>
          <h2 className="cx-h">{t("dev.what")}</h2>
          <div className="cx-actions" role="group" aria-label={t("dev.what")}>
            {(["bw", "c41"] as const).map((p) => (
              <button key={p} type="button" className={`cx-pick${process === p ? " cx-pick-on" : ""}`} aria-pressed={process === p} onClick={() => setProcess(p)}>
                {t(`dev.process.${p}`)}
              </button>
            ))}
          </div>
        </li>

        {process === "bw" ? (
          <li>
            <h2 className="cx-h">{t("dev.filmChem")}</h2>
            <div className="cx-grid">
              <label className="field">
                <span>{t("dev.film")}</span>
                <select value={film} onChange={(e) => setFilm(e.target.value)}>
                  {DATASHEET_FILMS.map((f) => (
                    <option key={f} value={f}>
                      {filmName(f)}
                    </option>
                  ))}
                  <option value="own">{t("dev.otherFilm")}</option>
                </select>
              </label>
              {opts && (
                <>
                  <label className="field">
                    <span>{t("dev.developer")}</span>
                    <select value={dev} onChange={(e) => setDev(e.target.value)}>
                      {opts.developers.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("dev.dilution")}</span>
                    <select value={dil} onChange={(e) => setDil(e.target.value)}>
                      {dils.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{t("dev.temp")}</span>
                    <select value={temp} onChange={(e) => setTemp(Number(e.target.value))}>
                      {temps.map((x) => (
                        <option key={x} value={x}>
                          {x} °C
                        </option>
                      ))}
                    </select>
                  </label>
                  {pushes.length > 1 && (
                    <label className="field">
                      <span>{t("dev.push")}</span>
                      <select value={pushes.includes(push) ? push : pushes[0]} onChange={(e) => setPush(Number(e.target.value))}>
                        {pushes.map((p) => (
                          <option key={p} value={p}>
                            {p === 0 ? t("dev.box") : p > 0 ? t("dev.pushN", { n: p }) : t("dev.pullN", { n: -p })}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
            </div>
            {sheet ? (
              <div className="cx-plate">
                <p className="cx-plate-no">{clock(sheet.minutes * 60)}</p>
                <p className="cx-plate-what">{t("dev.sheetTime", { ei: sheet.ei })}</p>
                {sheet.note && <p className="cx-warn">{sheet.note}</p>}
                <p className="cx-source">
                  <a href={sheet.url} target="_blank" rel="noreferrer">
                    {sheet.source}
                  </a>{" "}
                  · {sheet.agitation}
                </p>
              </div>
            ) : film === "own" ? (
              <>
                <p className="cx-quiet">{t("dev.ownHint")}</p>
                <MinSec label={t("dev.devTime")} value={ownSec} onChange={setOwnSec} />
              </>
            ) : (
              <p className="cx-problem">{t("dev.noSheet")}</p>
            )}
          </li>
        ) : (
          <li>
            <h2 className="cx-h">{t("dev.c41")}</h2>
            <p className="cx-tip">{t("dev.c41Hint")}</p>
            <div className="cx-grid">
              <MinSec label={t("dev.step.blix")} value={c41.blix} onChange={(v) => setC41((x) => ({ ...x, blix: v }))} />
              <MinSec label={t("dev.step.wash")} value={c41.wash} onChange={(v) => setC41((x) => ({ ...x, wash: v }))} />
              <MinSec label={t("dev.step.stabilise")} value={c41.stabilise} onChange={(v) => setC41((x) => ({ ...x, stabilise: v }))} />
            </div>
          </li>
        )}

        <li>
          <h2 className="cx-h">{t("dev.agitation")}</h2>
          <div className="cx-actions" role="group" aria-label={t("dev.agitation")}>
            {AGITATION_PRESETS.filter((p) => p.id !== "continuous").map((p) => (
              <button key={p.id} type="button" className={`cx-pick${preset === p.id ? " cx-pick-on" : ""}`} aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>
                {t(`dev.agit.${p.id}`)}
              </button>
            ))}
          </div>
          <p className="cx-quiet">{t(`dev.agit.${preset}.how`)}</p>
        </li>

        {process === "bw" && (
          <li>
            <h2 className="cx-h">{t("dev.otherSteps")}</h2>
            <label className="cx-check">
              <input type="checkbox" checked={presoak} onChange={(e) => setPresoak(e.target.checked)} /> {t("dev.presoak")}
            </label>
            <div className="cx-grid">
              <MinSec label={t("dev.step.stop")} value={stop} onChange={setStop} />
              <MinSec label={t("dev.step.fix")} value={fix} onChange={setFix} />
              <MinSec label={t("dev.step.wash")} value={wash} onChange={setWash} />
              <MinSec label={t("dev.step.wetting")} value={wetting} onChange={setWetting} />
            </div>
            <p className="cx-quiet">{t("dev.checkChem")}</p>
          </li>
        )}

        <li>
          <h2 className="cx-h">{t("dev.ready")}</h2>
          <p>{t("dev.total", { time: clock(totalSeconds(steps)) })}</p>
          <ul className="dev-plan">
            {steps.map((s) => (
              <li key={s.id}>
                <span>{t(`dev.step.${s.kind}`)}</span>
                <span className="cx-mono">{clock(s.seconds)}</span>
              </li>
            ))}
          </ul>
          <p className="cx-quiet">{t("dev.startHint")}</p>
          <div className="cx-actions">
            <button type="button" className="btn btn-red" disabled={devSec <= 0 || (process === "bw" && film !== "own" && !sheet)} onClick={() => onStart(steps, title)}>
              {t("dev.start")}
            </button>
          </div>
        </li>
      </ol>
    </section>
  );
}

function Running({ saved, onStop }: { saved: SavedRun; onStop: () => void }) {
  const [run, setRun] = useState(saved.run);
  const [now, setNow] = useState(Date.now());
  const [confirmStop, setConfirmStop] = useState(false);
  const safelight = useSafelight();
  const steps = saved.steps;
  const elapsed = elapsedSec(run, now);
  const state = stateAt(steps, elapsed);
  const lastCue = useRef(elapsed);
  useWakeLock(!state.done);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setString(RUN_KEY, JSON.stringify({ ...saved, run }));
  }, [run, saved]);

  // Sound the cues passed since the last tick (at most the latest of each, after a long sleep).
  useEffect(() => {
    const passed = cues(steps).filter((c) => c.at > lastCue.current && c.at <= elapsed);
    lastCue.current = elapsed;
    const latest = passed[passed.length - 1];
    if (latest) playTone(latest.kind);
  }, [elapsed, steps]);

  const step = steps[state.step];
  const say = state.done ? t("dev.say.done") : state.draining ? t("dev.say.drain") : state.agitating ? t("dev.say.agitate") : step.kind === "wash" ? t("dev.say.wash") : t("dev.say.rest");
  return (
    <section className={`panel stage-develop cx dev-run${state.agitating ? " dev-agitate" : ""}${state.draining ? " dev-drain" : ""}`} aria-label={t("tool.develop")}>
      <p className="pp-cert-label">{saved.title}</p>
      <h2 className="dev-step">{state.done ? t("dev.say.done") : t(`dev.step.${step.kind}`)}</h2>
      <p className="dev-clock" aria-live="off">
        {clock(state.left)}
      </p>
      <p className="dev-say" role="status" aria-live="assertive">
        {say}
      </p>
      <span className="hc-meter dev-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${step ? state.inStep / step.seconds : 1})` }} />
      </span>
      <ol className="dev-plan dev-plan-run">
        {steps.map((s, i) => (
          <li key={s.id} className={i === state.step && !state.done ? "dev-now" : i < state.step || state.done ? "dev-past" : undefined}>
            <span>{t(`dev.step.${s.kind}`)}</span>
            <span className="cx-mono">{clock(s.seconds)}</span>
          </li>
        ))}
      </ol>
      {run.pausedAt && <p className="cx-tip">{t("dev.paused")}</p>}
      <div className="cx-actions">
        {!state.done && (
          <button type="button" className="btn btn-red" onClick={() => setRun((r) => (r.pausedAt ? resume(r, Date.now()) : pause(r, Date.now())))}>
            {run.pausedAt ? t("dev.resume") : t("dev.pause")}
          </button>
        )}
        {!state.done && (
          <button type="button" className="btn" onClick={() => setRun((r) => skip(r, steps, Date.now()))}>
            {t("dev.skip")}
          </button>
        )}
        <button type="button" className="btn" onClick={() => setSafelight(!safelight)}>
          {safelight ? t("dev.safelightOff") : t("dev.safelightOn")}
        </button>
        {state.done ? (
          <button type="button" className="btn" onClick={onStop}>
            {t("dev.again")}
          </button>
        ) : confirmStop ? (
          <>
            <button type="button" className="btn" onClick={onStop}>
              {t("dev.stopYes")}
            </button>
            <button type="button" className="cx-link" onClick={() => setConfirmStop(false)}>
              {t("common.cancel")}
            </button>
          </>
        ) : (
          <button type="button" className="cx-link" onClick={() => setConfirmStop(true)}>
            {t("dev.stop")}
          </button>
        )}
      </div>
      <p className="cx-quiet">{t("dev.keepOpen")}</p>
    </section>
  );
}
