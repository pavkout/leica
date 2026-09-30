import { useState } from "react";
import { formatShutter } from "../../data/gear";
import { t, tn, useLang } from "../../i18n";
import { patterns, rollStats } from "../../physics/rollReview";
import { reviewRoll } from "../../services/ai/aiClient";
import type { RollSuggestion } from "../../services/ai/schemas";
import { useAiSettings } from "../../state/collectorStore";
import { FRAME_ISSUES, rollsOf, type FrameIssue, type LogEntry } from "../../state/shotLog";
import { attachRollScans, scanThumbnail, updateEntry, useShotLog } from "../../state/shotLogStore";
import { formatFNumber } from "../../utils/format";
import AiGate from "../collector/AiGate";
import RunCostLine from "../collector/RunCostLine";
import { useAiRun } from "../collector/useAiRun";

const settingsOf = (e: LogEntry) => `${formatFNumber(e.fNumber)} · ${formatShutter(e.shutterSec)} · ${e.film}${e.lens ? ` · ${e.lens}` : ""}`;

/** A small JPEG (data URL) → base64, scaled down for the AI. */
async function smallBase64(dataUrl: string, edge = 512): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const s = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.75);
  return url.slice(url.indexOf(",") + 1);
}

/**
 * Roll review (#58): a roll's contact sheet from its scans, your keepers and
 * what went wrong, the keeper rate, and the patterns across every roll you've
 * reviewed, each with the Photography Lab exercise that practises it. An AI
 * editor can suggest picks.
 */
export default function RollReview() {
  useLang();
  const { log } = useShotLog();
  const rolls = rollsOf(log);
  const [roll, setRoll] = useState(rolls[rolls.length - 1] ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const settings = useAiSettings();
  const ai = useAiRun(settings, "review");
  const [suggestion, setSuggestion] = useState<RollSuggestion | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const entries = log.filter((e) => e.roll === roll).sort((a, b) => a.frame - b.frame);
  const stats = rollStats(entries);
  const found = patterns(log);
  const withScans = entries.filter((e) => e.scan);

  async function addScans(files: FileList | null) {
    if (!files?.length) return;
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const scans = await Promise.all(sorted.map((f) => scanThumbnail(f)));
    const r = attachRollScans(roll, scans);
    setStatus(r.unmatched ? tn("rr.unmatched", r.unmatched) : t("rr.attached", { n: scans.length }));
  }

  async function suggest() {
    const frames = await Promise.all(withScans.slice(0, 24).map(async (e) => ({ frame: e.frame, base64: await smallBase64(e.scan!), settings: settingsOf(e) })));
    const out = await ai.run((key, model) => reviewRoll(key, model, frames));
    if (out) {
      setSuggestion(out.suggestion);
      setCost(out.cost.usd);
    }
  }

  if (rolls.length === 0)
    return (
      <section className="panel stage-review cx" aria-label={t("tool.review")}>
        <p className="cx-summary">{t("rr.intro")}</p>
        <p className="cx-tip">{t("tag.noLog")}</p>
        <div className="cx-actions">
          <a className="btn btn-red" href="#/shoot/shotlog">
            {t("walk.toShotLog")}
          </a>
        </div>
      </section>
    );

  return (
    <section className="panel stage-review cx" aria-label={t("tool.review")}>
      <p className="cx-summary">{t("rr.intro")}</p>
      <label className="field cx-narrow">
        <span>{t("tag.roll")}</span>
        <select value={roll} onChange={(e) => (setRoll(e.target.value), setSuggestion(null))}>
          {rolls.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <p className="cx-quiet">{t("rr.stats", { picks: stats.picks, reviewed: stats.reviewed, frames: stats.frames })}</p>
      {stats.reviewed > 0 && (
        <p className="cx-plate-what">{t("rr.keeperRate", { pct: Math.round((stats.picks / stats.reviewed) * 100) })}</p>
      )}

      <div className="cx-actions">
        <label className="btn pp-file">
          {withScans.length ? t("rr.replaceScans") : t("rr.addScans")}
          <input type="file" accept="image/*" multiple onChange={(e) => addScans(e.target.files)} />
        </label>
      </div>
      {status && <p className="cx-ok">{status}</p>}

      <ul className="rr-sheet">
        {entries.map((e) => {
          const note = suggestion?.notes.find((n) => n.frame === e.frame)?.note;
          const suggested = suggestion?.picks.includes(e.frame);
          return (
            <li key={e.id} className={`rr-frame${e.pick ? " rr-pick" : ""}${suggested ? " rr-suggested" : ""}`}>
              {e.scan ? <img src={e.scan} alt={t("rr.frameAlt", { n: e.frame })} /> : <span className="rr-noscan">{e.frame}</span>}
              <p className="rr-meta">
                <span className="cx-mono">{e.frame}</span> {settingsOf(e)}
              </p>
              {note && <p className="rr-note">{note}</p>}
              <div className="rr-marks" role="group" aria-label={t("rr.marksFor", { n: e.frame })}>
                <button type="button" className={`cx-pick${e.pick ? " cx-pick-on" : ""}`} aria-pressed={!!e.pick} onClick={() => updateEntry(e.id, { pick: !e.pick, issue: e.pick ? e.issue : undefined })}>
                  ★ {t("rr.keeper")}
                </button>
                {FRAME_ISSUES.map((i: FrameIssue) => (
                  <button key={i} type="button" className={`cx-pick${e.issue === i ? " cx-pick-on" : ""}`} aria-pressed={e.issue === i} onClick={() => updateEntry(e.id, { issue: e.issue === i ? undefined : i, pick: e.issue === i ? e.pick : false })}>
                    {t(`rr.issue.${i}`)}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="cx-block">
        <h2 className="pp-h3">{t("rr.aiTitle")}</h2>
        {!settings.key ? (
          <AiGate what={t("rr.gate")} />
        ) : (
          <>
            <p className="cx-quiet">{t("rr.aiHint")}</p>
            <div className="cx-actions">
              <button type="button" className="btn" disabled={ai.busy || withScans.length === 0} onClick={suggest}>
                {ai.busy ? t("fb.busy") : t("rr.suggest")}
              </button>
            </div>
            {withScans.length === 0 && <p className="cx-quiet">{t("rr.needScans")}</p>}
            <RunCostLine est={ai.est} actual={cost} error={ai.error} />
            {suggestion && (
              <>
                <p className="cx-answer-lead">{suggestion.overall}</p>
                <p className="cx-quiet">{suggestion.picks.length ? t("rr.suggested", { list: suggestion.picks.join(", ") }) : t("rr.noneSuggested")}</p>
              </>
            )}
          </>
        )}
      </div>

      <h2 className="cx-h">{t("rr.patterns")}</h2>
      {found.length === 0 ? (
        <p className="cx-quiet">{t("rr.noPatterns")}</p>
      ) : (
        <ul className="mt-reasons">
          {found.map((p) => (
            <li key={p.group + p.issue}>
              <span aria-hidden="true">!</span> {t("rr.pattern", { group: t(p.group), issue: t(`rr.issue.${p.issue}`), count: p.count, of: p.of })}{" "}
              <a className="cx-link" href="#/learn/lab">
                {t("rr.practise", { ex: t(`lab.ex.${p.lab}`) })}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="cx-quiet cx-footnote">{t("rr.honest")}</p>
    </section>
  );
}
