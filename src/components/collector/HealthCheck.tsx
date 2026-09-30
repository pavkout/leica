import { useEffect, useRef, useState } from "react";
import { BODIES, formatShutter, type Body } from "../../data/gear";
import { checksFor } from "../../data/healthChecks";
import { t, tn, useLang } from "../../i18n";
import { TEST_SPEEDS, errorStops, exposureFrom, gradeSpeed, measureInterval, verdict, type SpeedGrade } from "../../physics/shutterTest";
import { micAvailable, openMic, type Mic } from "../../services/shutterMic";
import { useCollection } from "../../state/collectionStorage";
import { addEvent, newEventId, newPassport, resubject, type HealthSummary } from "../../state/passport";
import { getPassport, putPassport } from "../../state/passportStore";

type Answer = "ok" | "issue" | "skipped";
interface SpeedResult {
  nominalSec: number;
  label: string;
  indicative: boolean;
  intervalSec: number;
}

const itemFromHash = () => new URLSearchParams(location.hash.split("?")[1] ?? "").get("item") ?? "";

/**
 * Camera health check (#42): the shutter by sound, then a short guided look
 * at everything else, ending in a report you can keep in the camera's
 * passport or show a buyer.
 */
export default function HealthCheck() {
  useLang();
  const items = useCollection();
  const bodies = items.filter((i) => i.kind === "body");
  const [itemId, setItemId] = useState(() => itemFromHash());
  const [otherBodyId, setOtherBodyId] = useState(BODIES[0].id);
  const item = bodies.find((i) => i.id === itemId);
  const body: Body | undefined = item ? BODIES.find((b) => b.id === item.catalogueId) : BODIES.find((b) => b.id === otherBodyId);

  // Arriving from a passport's "Check its health" preselects that camera.
  useEffect(() => {
    const onHash = () => {
      const id = itemFromHash();
      if (id) setItemId(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const [travel, setTravel] = useState<number | null>(null);
  const [results, setResults] = useState<SpeedResult[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const speeds = TEST_SPEEDS.filter((s) => !body || (s.sec <= body.shutter.slowest * 1.001 && s.sec >= body.shutter.fastest * 0.999));
  const fastest = body?.shutter.fastest ?? 1 / 1000;
  const checks = checksFor(body);
  const measured = results.map((r) => {
    const sec = exposureFrom(r.intervalSec, travel ?? 0);
    const err = errorStops(r.nominalSec, sec);
    return { ...r, sec, err, grade: gradeSpeed(err) };
  });
  const issues = checks.filter((c) => answers[c.id] === "issue");
  const overall = verdict(
    measured.map((m) => m.grade),
    issues.length
  );
  const answered = checks.filter((c) => answers[c.id]).length;
  const done = measured.length > 0 || answered > 0;

  function reset() {
    setTravel(null);
    setResults([]);
    setAnswers({});
    setSaved(null);
  }

  async function saveToPassport() {
    if (!item) return;
    const health: HealthSummary = {
      speeds: measured.map((m) => ({ nominalSec: m.nominalSec, measuredSec: m.sec, errorStops: Math.round(m.err * 100) / 100 })),
      checks: Object.fromEntries(checks.map((c) => [c.id, answers[c.id] ?? "skipped"])),
      verdict: overall,
    };
    const detail = [
      ...measured.map((m) => `${m.label}: ${formatShutter(m.sec)} (${m.err >= 0 ? "+" : "−"}${Math.abs(m.err).toFixed(1)} EV)`),
      ...issues.map((c) => `${t(`health.check.${c.id}`)}: ${t("health.answer.issue")}`),
    ].join("; ");
    const stored = await getPassport(item.id);
    const base = stored ? await resubject(stored, item) : newPassport(item);
    const next = await addEvent(base, {
      id: newEventId(),
      type: "health",
      date: new Date().toISOString().slice(0, 10),
      title: t("health.eventTitle"),
      detail: detail || undefined,
      health,
      recordedAt: new Date().toISOString(),
    });
    setSaved((await putPassport(next)) ? t("health.saved", { name: item.name }) : t("passport.storageFull"));
  }

  return (
    <section className="panel stage-health cx" aria-label={t("tool.health")}>
      <ol className="cx-flow">
        <li className="cx-step">
          <h2 className="cx-h">{t("health.step.which")}</h2>
          <label className="field">
            <span>{t("common.camera")}</span>
            <select value={item ? item.id : ""} onChange={(e) => (setItemId(e.target.value), reset())}>
              {bodies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.serial ? ` · No. ${b.serial}` : ""}
                </option>
              ))}
              <option value="">{t("health.otherCamera")}</option>
            </select>
          </label>
          {!item && (
            <label className="field">
              <span>{t("health.model")}</span>
              <select value={otherBodyId} onChange={(e) => (setOtherBodyId(e.target.value), reset())}>
                {BODIES.filter((b) => b.family === "M film" || b.family === "M digital").map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </li>

        <li className="cx-step">
          <h2 className="cx-h">{t("health.step.shutter")}</h2>
          <ShutterTest
            fastest={fastest}
            speeds={speeds}
            travel={travel}
            onTravel={setTravel}
            results={measured}
            onResult={(r) => setResults((list) => [...list.filter((x) => x.nominalSec !== r.nominalSec), r].sort((a, b) => b.nominalSec - a.nominalSec))}
          />
        </li>

        <li className="cx-step">
          <h2 className="cx-h">{t("health.step.look")}</h2>
          <p className="cx-quiet">{t("health.look.intro")}</p>
          <ul className="hc-checks">
            {checks.map((c) => (
              <li key={c.id} className="hc-check">
                <p className="hc-check-title">{t(`health.check.${c.id}`)}</p>
                <p className="cx-quiet">{t(`health.check.${c.id}.how`)}</p>
                {c.tool && (
                  <p>
                    <a className="cx-link" href={c.tool === "rfcheck" ? "#/learn/rfcheck" : "#/shoot/live"}>
                      {t(`health.tool.${c.tool}`)}
                    </a>
                  </p>
                )}
                <div className="cx-actions" role="group" aria-label={t(`health.check.${c.id}`)}>
                  {(["ok", "issue", "skipped"] as Answer[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      className={`cx-pick${answers[c.id] === a ? " cx-pick-on" : ""}`}
                      aria-pressed={answers[c.id] === a}
                      onClick={() => setAnswers((x) => ({ ...x, [c.id]: a }))}
                    >
                      {t(`health.answer.${a}`)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </li>

        <li className="cx-step">
          <h2 className="cx-h">{t("health.step.result")}</h2>
          {!done ? (
            <p className="cx-quiet">{t("health.result.empty")}</p>
          ) : (
            <div className="hc-report">
              <p className={overall === "good" ? "cx-ok" : "cx-problem"}>
                <strong>{t(`health.verdict.${overall}`)}</strong> {t(`health.verdict.${overall}.text`)}
              </p>
              {measured.length > 0 && (
                <table className="hc-table">
                  <thead>
                    <tr>
                      <th>{t("health.col.set")}</th>
                      <th>{t("health.col.measured")}</th>
                      <th>{t("health.col.off")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measured.map((m) => (
                      <tr key={m.nominalSec} className={`hc-${m.grade}`}>
                        <td>{m.label}</td>
                        <td>{formatShutter(m.sec)}</td>
                        <td>
                          {m.err >= 0 ? "+" : "−"}
                          {Math.abs(m.err).toFixed(1)} EV · {t(`health.grade.${m.grade}`)}
                          {m.indicative ? ` (${t("health.indicative")})` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {travel === null && measured.length > 0 && <p className="cx-tip">{t("health.uncalibrated")}</p>}
              {issues.length > 0 && (
                <p>
                  {tn("health.issues", issues.length)}: {issues.map((c) => t(`health.check.${c.id}`)).join(", ")}
                </p>
              )}
              <p className="cx-quiet">{t("health.honest")}</p>
              {saved && (
                <p className="cx-ok" role="status">
                  {saved}
                </p>
              )}
              <div className="cx-actions">
                {item ? (
                  <button type="button" className="btn btn-red" onClick={saveToPassport} disabled={!!saved}>
                    {t("health.save", { name: item.name })}
                  </button>
                ) : (
                  <p className="cx-quiet">{t("health.saveNeedsItem")}</p>
                )}
                <button type="button" className="btn" onClick={() => window.print()}>
                  {t("health.print")}
                </button>
                <button type="button" className="btn" onClick={reset}>
                  {t("health.again")}
                </button>
              </div>
            </div>
          )}
        </li>
      </ol>
    </section>
  );
}

type Measured = SpeedResult & { sec: number; err: number; grade: SpeedGrade };

function ShutterTest({
  fastest,
  speeds,
  travel,
  onTravel,
  results,
  onResult,
}: {
  fastest: number;
  speeds: typeof TEST_SPEEDS;
  travel: number | null;
  onTravel: (sec: number | null) => void;
  results: Measured[];
  onResult: (r: SpeedResult) => void;
}) {
  const mic = useRef<Mic | null>(null);
  const [state, setState] = useState<"off" | "opening" | "ready" | "listening" | "denied">("off");
  const [target, setTarget] = useState<{ sec: number; label: string; indicative: boolean; calibrate?: boolean } | null>(null);
  const [level, setLevel] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => () => mic.current?.close(), []);

  if (!micAvailable()) return <p className="cx-tip">{t("health.mic.unavailable")}</p>;

  async function start() {
    setState("opening");
    try {
      mic.current = await openMic();
      setState("ready");
    } catch {
      setState("denied");
    }
  }

  async function listen(sec: number, label: string, indicative: boolean, calibrate = false) {
    if (!mic.current) return;
    setProblem(null);
    setTarget({ sec, label, indicative, calibrate });
    setState("listening");
    try {
      const take = await mic.current.take(sec, (l) => setLevel(l));
      const m = measureInterval(take.samples, take.sampleRate, sec);
      if (!m.ok) setProblem(t(`health.mic.${m.reason}`));
      else if (calibrate) onTravel(m.intervalSec);
      else onResult({ nominalSec: sec, label, indicative, intervalSec: m.intervalSec });
    } catch (e) {
      if ((e as Error).message === "timeout") setProblem(t("health.mic.timeout"));
    } finally {
      setState("ready");
      setTarget(null);
      setLevel(0);
    }
  }

  const fastLabel = formatShutter(fastest);
  return (
    <div className="hc-shutter">
      <ul className="hc-how">
        <li>{t("health.how.1")}</li>
        <li>{t("health.how.2")}</li>
        <li>{t("health.how.3")}</li>
      </ul>
      {state === "off" || state === "opening" ? (
        <div className="cx-actions">
          <button type="button" className="btn btn-red" onClick={start} disabled={state === "opening"}>
            {t("health.mic.start")}
          </button>
        </div>
      ) : state === "denied" ? (
        <p className="cx-problem">{t("health.mic.denied")}</p>
      ) : (
        <>
          <div className="hc-calibrate">
            <p>
              <strong>{t("health.cal.title", { speed: fastLabel })}</strong> {t("health.cal.text", { speed: fastLabel })}
            </p>
            <div className="cx-actions">
              <button type="button" className="btn" onClick={() => listen(fastest, fastLabel, false, true)} disabled={state === "listening"}>
                {travel === null ? t("health.cal.listen", { speed: fastLabel }) : t("health.cal.again", { ms: (travel * 1000).toFixed(1) })}
              </button>
            </div>
          </div>
          {state === "listening" && target && (
            <div className="hc-listen" role="status" aria-live="polite">
              <p>
                <strong>{t("health.listening", { speed: target.label })}</strong>
              </p>
              <span className="hc-meter" aria-hidden="true">
                <span style={{ transform: `scaleX(${Math.min(1, level * 3)})` }} />
              </span>
              <button type="button" className="cx-link" onClick={() => mic.current?.cancel()}>
                {t("common.cancel")}
              </button>
            </div>
          )}
          {problem && <p className="cx-problem">{problem}</p>}
          <p className="cx-quiet">{t("health.pick")}</p>
          <div className="hc-speeds">
            {speeds.map((s) => {
              const r = results.find((x) => x.nominalSec === s.sec);
              return (
                <button key={s.label} type="button" className={`hc-speed${r ? ` hc-${r.grade}` : ""}`} onClick={() => listen(s.sec, s.label, s.indicative)} disabled={state === "listening"}>
                  <span className="hc-speed-set">{s.label}</span>
                  <span className="hc-speed-got">{r ? formatShutter(r.sec) : s.indicative ? t("health.indicative") : t("health.tap")}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
