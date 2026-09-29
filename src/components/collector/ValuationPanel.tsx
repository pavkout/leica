import { valueItem } from "../../services/ai/aiClient";
import type { CollectionItem, Valuation } from "../../state/collection";
import { openCollectorPage, useAiSettings } from "../../state/collectorStore";
import { formatMoney } from "../../state/market";
import PriceView from "./PriceView";
import RunCostLine from "./RunCostLine";
import { useAiRun } from "./useAiRun";

interface Props {
  item: CollectionItem;
  onValued: (v: Valuation) => void;
}

const YEAR = 365 * 24 * 3600 * 1000;

/** What is it worth? Similar sales, each linked, with the history of earlier checks. */
export default function ValuationPanel({ item, onValued }: Props) {
  const settings = useAiSettings();
  const ai = useAiRun(settings, "value");
  const [latest, ...older] = item.valuations ?? [];
  const named = Boolean(item.name.trim());

  async function find() {
    const out = await ai.run((key, model) => valueItem(key, model, item));
    if (out) onValued({ at: new Date().toISOString(), modelUsed: ai.model, range: out.price.range, comparables: out.price.comparables, note: out.price.note, costUsd: out.cost.usd });
  }

  return (
    <div className="cx-block cx-value">
      <h3 className="cx-h">What is it worth?</h3>
      {latest ? (
        <>
          <p className="cx-quiet">
            Checked on {new Date(latest.at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            {Date.now() - new Date(latest.at).getTime() > YEAR && ". That's over a year ago, so prices may have changed"}.
          </p>
          <PriceView range={latest.range} comparables={latest.comparables} note={latest.note} />
        </>
      ) : (
        <p>Find out what similar items sold for recently. We search public sales and show you each one.</p>
      )}
      {older.length > 0 && (
        <details className="cx-sources">
          <summary>Earlier checks ({older.length})</summary>
          <ul>
            {older.map((v) => (
              <li key={v.at}>
                <span>{v.at.slice(0, 10)}</span>
                <span>{v.range ? `${formatMoney(v.range.low, v.range.currency)} to ${formatMoney(v.range.high, v.range.currency)}` : "Not enough sales found"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!settings.key ? (
        <p className="cx-quiet">
          Needs the AI helper.{" "}
          <button type="button" className="cx-link" onClick={() => openCollectorPage("aihelper")}>
            Turn it on
          </button>
        </p>
      ) : (
        <>
          <div className="cx-actions">
            <button type="button" className="btn" disabled={ai.busy || !named} onClick={find}>
              {ai.busy ? "Searching sales… about a minute" : latest ? "Check the value again" : "Find the value"}
            </button>
          </div>
          {!named && <p className="cx-quiet">Give it a name first, so we know what to search for.</p>}
          <RunCostLine est={ai.est} error={ai.error} />
        </>
      )}
    </div>
  );
}
