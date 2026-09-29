import { useState } from "react";
import { forgetKey, looksLikeKey, maskKey, saveAiSettings, type AiSettings } from "../../services/ai/aiSettings";
import { testKey } from "../../services/ai/aiClient";
import { describeApiError } from "../../services/ai/errors";
import { ACTION_LABEL, MODELS, PRICES_AS_OF, PRICING_URL, WEB_SEARCH_PER_1000, estimate, formatEstimate, formatUsd, type AiAction, type ModelId } from "../../services/ai/pricing";
import { loadSpend, monthTotal } from "../../services/ai/spendLog";

const ACTIONS: AiAction[] = ["photo", "listing", "value"];
/** "0.01–0.04" for the table, where the header already says US$. */
const compact = (e: { low: number; high: number }) => formatEstimate(e).replace(/\$/g, "").replace(/^about /, "");
const SHORT: Record<AiAction, string> = { photo: "Photo ID", listing: "Listing check", value: "Value" };

interface Props {
  settings: AiSettings;
  onChange: (s: AiSettings) => void;
  onClose: () => void;
}

/**
 * AI & pricing: the user's own Anthropic key, which model runs what, what it
 * costs, and what has been spent this month. Everything stays on this device.
 */
export default function AiSettingsPanel({ settings, onChange, onClose }: Props) {
  const [draftKey, setDraftKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const spent = monthTotal(loadSpend(), new Date());

  function update(next: AiSettings) {
    if (!saveAiSettings(next)) setStatus("This device's storage refused the change; it's kept for this visit only.");
    onChange(next);
  }

  async function saveKey() {
    const k = draftKey.trim();
    if (!looksLikeKey(k)) {
      setStatus("That doesn't look like an Anthropic API key (they start with sk-ant-).");
      return;
    }
    update({ ...settings, key: k });
    setDraftKey("");
    setStatus("Key saved on this device. Use Test key to check it.");
  }

  async function test() {
    if (!settings.key) return;
    setTesting(true);
    setStatus(null);
    try {
      const c = await testKey(settings.key, "claude-haiku-4-5");
      setStatus(`The key works (that check cost ${formatUsd(c.usd)}).`);
    } catch (e) {
      setStatus(describeApiError(e).message);
    } finally {
      setTesting(false);
    }
  }

  const modelSelect = (value: ModelId | "", onPick: (m: ModelId | "") => void, label: string, allowDefault: boolean) => (
    <label className="field" key={label}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onPick(e.target.value as ModelId | "")}>
        {allowDefault && <option value="">Same as default</option>}
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="cl-panel" role="group" aria-label="AI and pricing">
      <h3>AI &amp; pricing</h3>
      <p className="small">
        The collector AI tools use Anthropic's Claude with <strong>your own API key</strong>. Photos and links go from this device straight to Anthropic, never to
        us. You pay Anthropic directly for what you use. Get a key at{" "}
        <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>
        .
      </p>

      <p className="cl-label">API key</p>
      {settings.key ? (
        <div className="cl-row">
          <span className="cl-cost">{maskKey(settings.key)}</span>
          <button type="button" className="btn btn-small" disabled={testing} onClick={test}>
            {testing ? "Testing…" : "Test key"}
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              forgetKey();
              onChange({ ...settings, key: null });
              setStatus("Key removed from this device.");
            }}
          >
            Forget key
          </button>
        </div>
      ) : (
        <div className="cl-row">
          <label className="field">
            <span>Anthropic API key</span>
            <input type="password" autoComplete="off" spellCheck={false} value={draftKey} placeholder="sk-ant-…" onChange={(e) => setDraftKey(e.target.value)} />
          </label>
          <button type="button" className="btn btn-red btn-small" disabled={!draftKey.trim()} onClick={saveKey}>
            Save key
          </button>
        </div>
      )}
      <p className="muted small">The key is stored in this browser only. Anyone using this browser can use it. Set a monthly limit below, and a spend limit in the Anthropic Console too.</p>
      {status && (
        <p className="sl-status" role="status">
          {status}
        </p>
      )}

      <p className="cl-label">Models</p>
      <div className="cl-row">
        {modelSelect(settings.model, (m) => m && update({ ...settings, model: m }), "Default model", false)}
        {ACTIONS.map((a) =>
          modelSelect(
            settings.perAction[a] ?? "",
            (m) => {
              const perAction = { ...settings.perAction };
              if (m) perAction[a] = m;
              else delete perAction[a];
              update({ ...settings, perAction });
            },
            ACTION_LABEL[a],
            true
          )
        )}
      </div>

      <p className="cl-label">What it costs per use (US$, estimates)</p>
      <div className="cl-table-wrap">
        <table className="cl-table">
          <thead>
            <tr>
              <th>Model</th>
              {ACTIONS.map((a) => (
                <th key={a} title={ACTION_LABEL[a]}>
                  {SHORT[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODELS.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.label}</th>
                {ACTIONS.map((a) => (
                  <td key={a}>{compact(estimate(a, m.id))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="cl-models small">
        {MODELS.map((m) => (
          <li key={m.id}>
            <strong>{m.label}</strong> · ${m.inPerM} in / ${m.outPerM} out per million tokens. {m.note}
          </li>
        ))}
      </ul>
      <p className="muted small">
        Listing checks and values include web searches (${WEB_SEARCH_PER_1000} per 1,000). The actual cost of each run is shown after it. Prices as of {PRICES_AS_OF}:{" "}
        <a href={PRICING_URL} target="_blank" rel="noreferrer">
          Anthropic pricing
        </a>
        .
      </p>

      <p className="cl-label">This month</p>
      <div className="cl-row">
        <span className="cl-range">{formatUsd(spent)}</span>
        <label className="field">
          <span>Monthly limit (US$)</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            value={settings.monthlyLimitUsd ?? ""}
            placeholder="No limit"
            onChange={(e) => {
              const v = Number(e.target.value);
              update({ ...settings, monthlyLimitUsd: e.target.value && v > 0 ? v : null });
            }}
          />
        </label>
      </div>

      <div className="cl-row">
        <button type="button" className="btn btn-small" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
