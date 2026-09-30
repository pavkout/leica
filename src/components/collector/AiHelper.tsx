import { useState } from "react";
import { looksLikeKey, maskKey } from "../../services/ai/aiSettings";
import { testKey } from "../../services/ai/aiClient";
import { describeApiError } from "../../services/ai/errors";
import { MODELS, PRICES_AS_OF, PRICING_URL, estimate, friendlyEstimate, friendlyUsd, type AiAction, type ModelId } from "../../services/ai/pricing";
import { loadSpend, monthTotal } from "../../services/ai/spendLog";
import { updateAiSettings, useAiSettings } from "../../state/collectorStore";
import { t } from "../../i18n";

const ACTIONS: AiAction[] = ["photo", "listing", "value", "critique"];
const LIMITS: (number | null)[] = [5, 10, 25, null];
const CONSOLE = "https://console.anthropic.com/";

/**
 * The AI helper: turn it on with your own key, choose how careful (and how
 * costly) it is, and set a monthly limit. Written for people who have never
 * heard of an API key: three steps, plain prices in cents.
 */
export default function AiHelper() {
  const settings = useAiSettings();
  const [draftKey, setDraftKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [custom, setCustom] = useState(settings.monthlyLimitUsd !== null && !LIMITS.includes(settings.monthlyLimitUsd));
  const spent = monthTotal(loadSpend(), new Date());
  const on = Boolean(settings.key);

  function save(next: typeof settings) {
    if (!updateAiSettings(next)) setMessage({ ok: false, text: t("col.ai.noSave") });
  }

  async function turnOn() {
    const k = draftKey.trim();
    if (!looksLikeKey(k)) {
      setMessage({ ok: false, text: t("col.ai.badShape") });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await testKey(k, "claude-haiku-4-5");
      save({ ...settings, key: k });
      setDraftKey("");
      setMessage({ ok: true, text: t("col.ai.works") });
    } catch (e) {
      setMessage({ ok: false, text: describeApiError(e).message });
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!settings.key) return;
    setBusy(true);
    setMessage(null);
    try {
      await testKey(settings.key, "claude-haiku-4-5");
      setMessage({ ok: true, text: t("col.ai.checked") });
    } catch (e) {
      setMessage({ ok: false, text: describeApiError(e).message });
    } finally {
      setBusy(false);
    }
  }

  const perPhoto = (m: ModelId) => friendlyEstimate(estimate("photo", m));
  const perCheck = (m: ModelId) => friendlyEstimate(estimate("listing", m));
  const photosFor5 = Math.floor(5 / estimate("photo", settings.model).high);

  return (
    <section className="panel stage-aihelper cx" aria-label={t("tool.aihelper")}>
      <div className={`cx-status${on ? " cx-status-on" : ""}`} role="status">
        <span className="cx-status-dot" aria-hidden="true" />
        <div>
          <p className="cx-status-title">{on ? t("col.ai.on") : t("col.ai.off")}</p>
          <p>
            {on ? t("col.ai.onText") : t("col.ai.offText")}
          </p>
        </div>
      </div>

      {message && (
        <p className={message.ok ? "cx-ok" : "cx-problem"} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      {on ? (
        <div className="cx-block">
          <h2 className="cx-h">{t("col.ai.yourKey")}</h2>
          <p>
            {t("col.ai.savedHere")} <span className="cx-mono">{maskKey(settings.key!)}</span>
          </p>
          <div className="cx-actions">
            <button type="button" className="btn" disabled={busy} onClick={check}>
              {busy ? t("col.ai.checking") : t("col.ai.check")}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                save({ ...settings, key: null });
                setMessage({ ok: true, text: t("col.ai.removed") });
              }}
            >
              {t("col.ai.remove")}
            </button>
          </div>
        </div>
      ) : (
        <div className="cx-block">
          <h2 className="cx-h">{t("col.ai.steps")}</h2>
          <ol className="cx-steps">
            <li>
              <p className="cx-step-title">{t("col.ai.step1")}</p>
              <p>
                {t("col.ai.step1.a")}{" "}
                <a href={CONSOLE} target="_blank" rel="noreferrer">
                  console.anthropic.com
                </a>{" "}
                {t("col.ai.step1.b")}
              </p>
            </li>
            <li>
              <p className="cx-step-title">{t("col.ai.step2")}</p>
              <p>{t("col.ai.step2.text", { n: photosFor5 })}</p>
            </li>
            <li>
              <p className="cx-step-title">{t("col.ai.step3")}</p>
              <p>{t("col.ai.step3.text")}</p>
              <label className="field cx-key">
                <span>{t("col.ai.yourKey")}</span>
                <input type="password" autoComplete="off" spellCheck={false} value={draftKey} placeholder="sk-ant-…" onChange={(e) => setDraftKey(e.target.value)} />
              </label>
              <button type="button" className="btn btn-red" disabled={!draftKey.trim() || busy} onClick={turnOn}>
                {busy ? t("col.ai.checkingKey") : t("col.gate.button")}
              </button>
            </li>
          </ol>
          <p className="cx-quiet">{t("col.ai.keyNote")}</p>
        </div>
      )}

      <div className="cx-block">
        <h2 className="cx-h">{t("col.ai.careful")}</h2>
        <div className="cx-choices" role="radiogroup" aria-label={t("col.ai.careful")}>
          {MODELS.map((m) => (
            <label key={m.id} className={`cx-choice${settings.model === m.id ? " cx-choice-on" : ""}`}>
              <input type="radio" name="ai-model" checked={settings.model === m.id} onChange={() => save({ ...settings, model: m.id })} />
              <span className="cx-choice-title">{t(`ai.model.${m.id}`)}</span>
              <span className="cx-choice-text">{t(`ai.model.${m.id}.note`)}</span>
              <span className="cx-choice-cost">
                {t("col.ai.photoCheck", { cost: perPhoto(m.id) })}
                <br />
                {t("col.ai.listingCheck", { cost: perCheck(m.id) })}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="cx-block">
        <h2 className="cx-h">{t("col.ai.spending")}</h2>
        <p>
          {settings.monthlyLimitUsd !== null
            ? t("col.ai.spentOf", { spent: friendlyUsd(spent), limit: `$${settings.monthlyLimitUsd}` })
            : t("col.ai.spent", { spent: friendlyUsd(spent) })}
        </p>
        <p className="cx-label-plain">{t("col.ai.limitQ")}</p>
        <div className="cx-actions" role="radiogroup" aria-label={t("col.ai.limit")}>
          {LIMITS.map((l) => {
            const active = !custom && settings.monthlyLimitUsd === l;
            return (
              <button
                key={String(l)}
                type="button"
                role="radio"
                aria-checked={active}
                className={`cx-pick${active ? " cx-pick-on" : ""}`}
                onClick={() => {
                  setCustom(false);
                  save({ ...settings, monthlyLimitUsd: l });
                }}
              >
                {l === null ? t("col.ai.noLimit") : `$${l}`}
              </button>
            );
          })}
          <button type="button" role="radio" aria-checked={custom} className={`cx-pick${custom ? " cx-pick-on" : ""}`} onClick={() => setCustom(true)}>
            {t("col.ai.other")}
          </button>
        </div>
        {custom && (
          <label className="field cx-narrow">
            <span>{t("col.ai.limitUsd")}</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="decimal"
              value={settings.monthlyLimitUsd ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value);
                save({ ...settings, monthlyLimitUsd: e.target.value && v > 0 ? v : null });
              }}
            />
          </label>
        )}
      </div>

      <details className="cx-more">
        <summary>{t("col.ai.more")}</summary>
        <h3 className="cx-h">{t("col.ai.prices")}</h3>
        <div className="cl-table-wrap">
          <table className="cl-table">
            <thead>
              <tr>
                <th>{t("col.ai.choice")}</th>
                {ACTIONS.map((a) => (
                  <th key={a}>{t(`ai.action.${a}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.id}>
                  <th scope="row">
                    {t(`ai.model.${m.id}`)}
                    <br />
                    <span className="cx-quiet">{m.label}</span>
                  </th>
                  {ACTIONS.map((a) => (
                    <td key={a}>{friendlyEstimate(estimate(a, m.id))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cx-quiet">
          {t("col.ai.estimates", { date: PRICES_AS_OF })}{" "}
          <a href={PRICING_URL} target="_blank" rel="noreferrer">
            anthropic.com pricing
          </a>
          .
        </p>
        <h3 className="cx-h">{t("col.ai.privacy")}</h3>
        <p>{t("col.ai.privacyText")}</p>
        <h3 className="cx-h">{t("col.ai.perTool")}</h3>
        <div className="cx-grid">
          {ACTIONS.map((a) => (
            <label className="field" key={a}>
              <span>{t(`ai.action.${a}`)}</span>
              <select
                value={settings.perAction[a] ?? ""}
                onChange={(e) => {
                  const perAction = { ...settings.perAction };
                  const v = e.target.value as ModelId | "";
                  if (v) perAction[a] = v;
                  else delete perAction[a];
                  save({ ...settings, perAction });
                }}
              >
                <option value="">{t("col.ai.same")}</option>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {t(`ai.model.${m.id}`)} ({m.label})
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
