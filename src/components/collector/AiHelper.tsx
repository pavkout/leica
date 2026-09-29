import { useState } from "react";
import { looksLikeKey, maskKey } from "../../services/ai/aiSettings";
import { testKey } from "../../services/ai/aiClient";
import { describeApiError } from "../../services/ai/errors";
import { ACTION_LABEL, MODELS, PRICES_AS_OF, PRICING_URL, estimate, friendlyEstimate, friendlyUsd, type AiAction, type ModelId } from "../../services/ai/pricing";
import { loadSpend, monthTotal } from "../../services/ai/spendLog";
import { updateAiSettings, useAiSettings } from "../../state/collectorStore";

const ACTIONS: AiAction[] = ["photo", "listing", "value"];
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
    if (!updateAiSettings(next)) setMessage({ ok: false, text: "This browser wouldn't save the change. It works until you close the page." });
  }

  async function turnOn() {
    const k = draftKey.trim();
    if (!looksLikeKey(k)) {
      setMessage({ ok: false, text: "That doesn't look like a key. A key starts with sk-ant- and is about 100 characters long. Copy the whole thing and paste it again." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await testKey(k, "claude-haiku-4-5");
      save({ ...settings, key: k });
      setDraftKey("");
      setMessage({ ok: true, text: "It works. The AI helper is on." });
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
      setMessage({ ok: true, text: "Checked: the AI helper is working." });
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
    <section className="panel stage-aihelper cx" aria-label="AI helper">
      <div className={`cx-status${on ? " cx-status-on" : ""}`} role="status">
        <span className="cx-status-dot" aria-hidden="true" />
        <div>
          <p className="cx-status-title">{on ? "The AI helper is on" : "The AI helper is off"}</p>
          <p>
            {on
              ? "You can identify items from photos, check listings and find what things are worth."
              : "Turn it on to identify items from photos, check listings and find what things are worth. Everything else works without it."}
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
          <h2 className="cx-h">Your key</h2>
          <p>
            Saved on this device: <span className="cx-mono">{maskKey(settings.key!)}</span>
          </p>
          <div className="cx-actions">
            <button type="button" className="btn" disabled={busy} onClick={check}>
              {busy ? "Checking…" : "Check it works"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                save({ ...settings, key: null });
                setMessage({ ok: true, text: "The key is removed from this device. The AI helper is off." });
              }}
            >
              Turn off and remove the key
            </button>
          </div>
        </div>
      ) : (
        <div className="cx-block">
          <h2 className="cx-h">Turn it on in three steps</h2>
          <ol className="cx-steps">
            <li>
              <p className="cx-step-title">Make a free account with Anthropic</p>
              <p>
                Anthropic makes the AI (it's called Claude). Open{" "}
                <a href={CONSOLE} target="_blank" rel="noreferrer">
                  console.anthropic.com
                </a>{" "}
                and sign up.
              </p>
            </li>
            <li>
              <p className="cx-step-title">Add a little credit</p>
              <p>Under Billing, add $5. That's enough for about {photosFor5} photo checks. You only pay for what you use.</p>
            </li>
            <li>
              <p className="cx-step-title">Copy your key and paste it here</p>
              <p>Under API keys, press Create key, then copy it. It starts with sk-ant-.</p>
              <label className="field cx-key">
                <span>Your key</span>
                <input type="password" autoComplete="off" spellCheck={false} value={draftKey} placeholder="sk-ant-…" onChange={(e) => setDraftKey(e.target.value)} />
              </label>
              <button type="button" className="btn btn-red" disabled={!draftKey.trim() || busy} onClick={turnOn}>
                {busy ? "Checking the key…" : "Turn on the AI helper"}
              </button>
            </li>
          </ol>
          <p className="cx-quiet">Your key stays on this device. Anyone who uses this browser can use it, so set a spending limit below.</p>
        </div>
      )}

      <div className="cx-block">
        <h2 className="cx-h">How careful should it be?</h2>
        <div className="cx-choices" role="radiogroup" aria-label="How careful the AI helper is">
          {MODELS.map((m) => (
            <label key={m.id} className={`cx-choice${settings.model === m.id ? " cx-choice-on" : ""}`}>
              <input type="radio" name="ai-model" checked={settings.model === m.id} onChange={() => save({ ...settings, model: m.id })} />
              <span className="cx-choice-title">{m.plain}</span>
              <span className="cx-choice-text">{m.note}</span>
              <span className="cx-choice-cost">
                Photo check {perPhoto(m.id)}
                <br />
                Listing check {perCheck(m.id)}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="cx-block">
        <h2 className="cx-h">Spending</h2>
        <p>
          This month you've spent <strong>{friendlyUsd(spent)}</strong>
          {settings.monthlyLimitUsd !== null && ` of your $${settings.monthlyLimitUsd} limit`}.
        </p>
        <p className="cx-label-plain">Stop me from spending more than, each month:</p>
        <div className="cx-actions" role="radiogroup" aria-label="Monthly limit">
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
                {l === null ? "No limit" : `$${l}`}
              </button>
            );
          })}
          <button type="button" role="radio" aria-checked={custom} className={`cx-pick${custom ? " cx-pick-on" : ""}`} onClick={() => setCustom(true)}>
            Other
          </button>
        </div>
        {custom && (
          <label className="field cx-narrow">
            <span>Limit in US dollars</span>
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
        <summary>More details: exact prices, privacy, advanced options</summary>
        <h3 className="cx-h">Exact prices</h3>
        <div className="cl-table-wrap">
          <table className="cl-table">
            <thead>
              <tr>
                <th>Choice</th>
                {ACTIONS.map((a) => (
                  <th key={a}>{ACTION_LABEL[a]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.id}>
                  <th scope="row">
                    {m.plain}
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
          Estimates. Each use shows what it actually cost afterwards. Price checks include web searches ($10 per 1,000). Anthropic's prices as of {PRICES_AS_OF}:{" "}
          <a href={PRICING_URL} target="_blank" rel="noreferrer">
            anthropic.com pricing
          </a>
          .
        </p>
        <h3 className="cx-h">Privacy</h3>
        <p>Photos, links and item details go straight from this device to Anthropic, only when you press a button to check something. They never pass through us. Photos are made smaller and their location data is removed first.</p>
        <h3 className="cx-h">A different choice for each tool</h3>
        <div className="cx-grid">
          {ACTIONS.map((a) => (
            <label className="field" key={a}>
              <span>{ACTION_LABEL[a]}</span>
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
                <option value="">Same as above</option>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.plain} ({m.label})
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
