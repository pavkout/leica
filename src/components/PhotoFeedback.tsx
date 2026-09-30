import { useState } from "react";
import { t, useLang } from "../i18n";
import { critiquePhoto } from "../services/ai/aiClient";
import { prepareImage, type PreparedImage } from "../services/ai/image";
import type { Critique } from "../services/ai/schemas";
import { useAiSettings } from "../state/collectorStore";
import { readExif, type ExifSettings } from "../utils/exif";
import { formatFNumber } from "../utils/format";
import { formatShutter } from "../data/gear";
import AiGate from "./collector/AiGate";
import RunCostLine from "./collector/RunCostLine";
import { useAiRun } from "./collector/useAiRun";

/** What the file says, for the teacher: "Leica M11, 35 mm, f/2.8, 1/250, ISO 400". */
function describe(e: ExifSettings): string {
  return [
    [e.make, e.model].filter(Boolean).join(" "),
    e.lens,
    e.focalMm && `${Math.round(e.focalMm)} mm`,
    e.fNumber && formatFNumber(e.fNumber),
    e.shutterSec && formatShutter(e.shutterSec),
    e.iso && `ISO ${e.iso}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Photo feedback (#54): one of your pictures, looked at by the AI as a kind,
 * honest teacher: what works, what to change, one thing to try next. An
 * opinion, never a score; the photo goes only to Anthropic, only on a tap.
 */
export default function PhotoFeedback() {
  useLang();
  const settings = useAiSettings();
  const ai = useAiRun(settings, "critique");
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [exif, setExif] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<Critique | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setResult(null);
    setCost(null);
    try {
      const [prepared, meta] = await Promise.all([prepareImage(file, 1568), file.arrayBuffer().then(readExif)]);
      setPhoto(prepared);
      setExif(describe(meta));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : t("lab.photoError"));
    }
  }

  async function ask() {
    if (!photo) return;
    const context = [exif, goal.trim() && `${t("fb.goalLabelEn")}: ${goal.trim()}`].filter(Boolean).join(". ");
    const out = await ai.run((key, model) => critiquePhoto(key, model, photo, context));
    if (out) {
      setResult(out.critique);
      setCost(out.cost.usd);
    }
  }

  return (
    <section className="panel stage-feedback cx" aria-label={t("tool.feedback")}>
      <p className="cx-summary">{t("fb.intro")}</p>
      <ol className="cx-flow">
        <li>
          <h2 className="cx-h">{t("fb.choose")}</h2>
          <label className={`btn${photo ? "" : " btn-red"} pp-file`}>
            {photo ? t("lab.otherPhoto") : t("lab.choosePhoto")}
            <input type="file" accept="image/*" onChange={(e) => choose(e.target.files?.[0])} />
          </label>
          {problem && <p className="cx-problem">{problem}</p>}
          {photo && <img src={photo.dataUrl} alt={t("lab.yourPhoto")} className="lab-photo" />}
          {exif && <p className="cx-quiet">{t("fb.fromFile", { exif })}</p>}
          <label className="field">
            <span>
              {t("fb.goal")} ({t("common.optional")})
            </span>
            <input type="text" value={goal} placeholder={t("fb.goalHint")} onChange={(e) => setGoal(e.target.value)} />
          </label>
        </li>
        <li>
          <h2 className="cx-h">{t("fb.ask")}</h2>
          {!settings.key ? (
            <AiGate what={t("fb.gate")} />
          ) : (
            <>
              <div className="cx-actions">
                <button type="button" className="btn btn-red" disabled={!photo || ai.busy} onClick={ask}>
                  {ai.busy ? t("fb.busy") : t("fb.go")}
                </button>
              </div>
              {!photo && <p className="cx-quiet">{t("col.id.needPhoto")}</p>}
              <RunCostLine est={ai.est} actual={cost} error={ai.error} />
            </>
          )}
        </li>
        <li aria-live="polite">
          <h2 className="cx-h">{t("fb.result")}</h2>
          {!result ? (
            <p className="cx-quiet">{t("col.id.wait")}</p>
          ) : (
            <div className="cx-answer">
              <p className="cx-answer-lead">{result.summary}</p>
              {result.strengths.length > 0 && (
                <>
                  <h3 className="pp-h3">{t("fb.works")}</h3>
                  <ul className="mt-reasons">
                    {result.strengths.map((s) => (
                      <li key={s} className="lab-pass">
                        <span aria-hidden="true">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {result.improvements.length > 0 && (
                <>
                  <h3 className="pp-h3">{t("fb.next")}</h3>
                  <ul className="mt-reasons">
                    {result.improvements.map((s) => (
                      <li key={s}>
                        <span aria-hidden="true">→</span> {s}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <dl className="cx-facts">
                {result.exposure && (
                  <>
                    <dt>{t("fb.exposure")}</dt>
                    <dd>{result.exposure}</dd>
                  </>
                )}
                {result.focus && (
                  <>
                    <dt>{t("fb.focus")}</dt>
                    <dd>{result.focus}</dd>
                  </>
                )}
                {result.composition && (
                  <>
                    <dt>{t("fb.composition")}</dt>
                    <dd>{result.composition}</dd>
                  </>
                )}
              </dl>
              <p className="cx-tip">
                <strong>{t("fb.try")}</strong> {result.tryNext}
              </p>
              <div className="cx-actions">
                <a className="btn" href="#/learn/lab">
                  {t("fb.toLab")}
                </a>
              </div>
            </div>
          )}
        </li>
      </ol>
      <p className="cx-quiet cx-footnote">{t("fb.honest")}</p>
    </section>
  );
}
