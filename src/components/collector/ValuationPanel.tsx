import { valueItem } from "../../services/ai/aiClient";
import type { AiSettings } from "../../services/ai/aiSettings";
import type { CollectionItem, Valuation } from "../../state/collection";
import { formatMoney } from "../../state/market";
import PriceView from "./PriceView";
import RunCostLine from "./RunCostLine";
import { useAiRun } from "./useAiRun";

interface Props {
  item: CollectionItem;
  settings: AiSettings;
  onValued: (v: Valuation) => void;
  onSettings: () => void;
}

const YEAR = 365 * 24 * 3600 * 1000;

/** Suggest a value for an owned item from cited comparables; keeps the history. */
export default function ValuationPanel({ item, settings, onValued, onSettings }: Props) {
  const ai = useAiRun(settings, "value");
  const [latest, ...older] = item.valuations ?? [];

  async function suggest() {
    const out = await ai.run((key, model) => valueItem(key, model, item));
    if (out) onValued({ at: new Date().toISOString(), modelUsed: ai.model, range: out.price.range, comparables: out.price.comparables, note: out.price.note, costUsd: out.cost.usd });
  }

  return (
    <div className="cl-card">
      <p className="cl-label">Market value</p>
      {latest ? (
        <>
          <p className="small">
            Suggested {latest.at.slice(0, 10)}
            {Date.now() - new Date(latest.at).getTime() > YEAR && <strong> · over a year old: worth refreshing</strong>}
          </p>
          <PriceView range={latest.range} comparables={latest.comparables} note={latest.note} />
        </>
      ) : (
        <p className="small">No value suggested yet. Claude searches recent sales and listings of the same item and lists each one with its link.</p>
      )}
      {older.length > 0 && (
        <details>
          <summary className="small">Earlier values ({older.length})</summary>
          <ul className="cl-comps">
            {older.map((v) => (
              <li key={v.at}>
                <span>{v.at.slice(0, 10)}</span>
                <span>{v.range ? `${formatMoney(v.range.low, v.range.currency)}–${formatMoney(v.range.high, v.range.currency)}` : "not enough data"}</span>
                <span className="muted">{v.comparables.length} sources</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="cl-row">
        <button type="button" className="btn btn-small" disabled={ai.busy || !item.name.trim()} onClick={suggest}>
          {ai.busy ? "Searching… (up to a minute or two)" : latest ? "Refresh the value" : "Suggest a value"}
        </button>
      </div>
      <RunCostLine model={ai.model} est={ai.est} error={ai.error} onSettings={onSettings} />
    </div>
  );
}
