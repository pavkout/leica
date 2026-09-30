import { valueItem } from "../../services/ai/aiClient";
import type { CollectionItem, Valuation } from "../../state/collection";
import { openCollectorPage, useAiSettings } from "../../state/collectorStore";
import { formatMoney } from "../../state/market";
import PriceView from "./PriceView";
import RunCostLine from "./RunCostLine";
import { useAiRun } from "./useAiRun";
import { langTag, t } from "../../i18n";

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
      <h3 className="cx-h">{t("col.value.title")}</h3>
      {latest ? (
        <>
          <p className="cx-quiet">
            {t(Date.now() - new Date(latest.at).getTime() > YEAR ? "col.value.checkedOld" : "col.value.checked", {
              date: new Date(latest.at).toLocaleDateString(langTag() === "en" ? "en-GB" : langTag(), { day: "numeric", month: "long", year: "numeric" }),
            })}
          </p>
          <PriceView range={latest.range} comparables={latest.comparables} note={latest.note} />
        </>
      ) : (
        <p>{t("col.value.intro")}</p>
      )}
      {older.length > 0 && (
        <details className="cx-sources">
          <summary>{t("col.value.earlier", { n: older.length })}</summary>
          <ul>
            {older.map((v) => (
              <li key={v.at}>
                <span>{v.at.slice(0, 10)}</span>
                <span>{v.range ? t("col.price.range", { low: formatMoney(v.range.low, v.range.currency), high: formatMoney(v.range.high, v.range.currency) }) : t("col.value.notEnough")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!settings.key ? (
        <p className="cx-quiet">
          {t("col.needsAi")}{" "}
          <button type="button" className="cx-link" onClick={() => openCollectorPage("aihelper")}>
            {t("col.turnOn")}
          </button>
        </p>
      ) : (
        <>
          <div className="cx-actions">
            <button type="button" className="btn" disabled={ai.busy || !named} onClick={find}>
              {ai.busy ? t("col.value.busy") : latest ? t("col.value.again") : t("col.value.find")}
            </button>
          </div>
          {!named && <p className="cx-quiet">{t("col.value.needsName")}</p>}
          <RunCostLine est={ai.est} error={ai.error} />
        </>
      )}
    </div>
  );
}
