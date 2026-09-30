import { useRef, useState } from "react";
import { valueItem } from "../../services/ai/aiClient";
import { modelFor } from "../../services/ai/aiSettings";
import { describeApiError } from "../../services/ai/errors";
import { estimate, friendlyEstimate, friendlyUsd } from "../../services/ai/pricing";
import { loadSpend, wouldExceed } from "../../services/ai/spendLog";
import type { CollectionItem, Valuation } from "../../state/collection";
import { openCollectorPage, useAiSettings } from "../../state/collectorStore";
import { t } from "../../i18n";

interface Props {
  items: CollectionItem[];
  onValued: (id: string, v: Valuation) => void;
}

/** Finds the value of every item, one at a time, after saying what it will cost. Can be stopped; finished ones keep their value. */
export default function ValueAll({ items, onValued }: Props) {
  const settings = useAiSettings();
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [spent, setSpent] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const stop = useRef(false);
  const model = modelFor(settings, "value");
  const one = estimate("value", model);
  const total = { low: one.low * items.length, high: one.high * items.length };

  async function runAll() {
    setConfirming(false);
    if (!settings.key) return openCollectorPage("aihelper");
    stop.current = false;
    setRunning(true);
    setDone(0);
    setSpent(0);
    setStatus(null);
    let usd = 0;
    for (const [i, item] of items.entries()) {
      if (stop.current) {
        setStatus(t("col.all.stopped", { i, n: items.length }));
        break;
      }
      if (wouldExceed(loadSpend(), settings.monthlyLimitUsd, one.high, new Date())) {
        setStatus(t("col.all.limit", { i, n: items.length }));
        break;
      }
      try {
        const out = await valueItem(settings.key, model, item);
        usd += out.cost.usd;
        onValued(item.id, { at: new Date().toISOString(), modelUsed: model, range: out.price.range, comparables: out.price.comparables, note: out.price.note, costUsd: out.cost.usd });
      } catch (e) {
        const err = describeApiError(e);
        if (["bad-key", "no-credit", "offline", "no-key"].includes(err.kind)) {
          setStatus(`${err.message} ${t("col.all.checked", { i, n: items.length })}`);
          break;
        }
        setStatus(`${item.name}: ${err.message}`);
      }
      setDone(i + 1);
      setSpent(usd);
    }
    setRunning(false);
  }

  if (running)
    return (
      <div className="cx-progress" role="status">
        <p>
          {t("col.all.progress", { i: Math.min(done + 1, items.length), n: items.length, cost: friendlyUsd(spent) })}
        </p>
        <button type="button" className="btn" onClick={() => (stop.current = true)}>
          {t("col.all.stop")}
        </button>
      </div>
    );
  if (confirming)
    return (
      <div className="cx-progress" role="alertdialog" aria-label={t("col.all.button")}>
        <p>
          {t("col.all.confirm", { n: items.length, cost: friendlyEstimate(total) })}
        </p>
        <div className="cx-actions">
          <button type="button" className="btn btn-red" onClick={runAll}>
            {t("col.all.yes")}
          </button>
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  return (
    <>
      <button type="button" className="btn" onClick={() => (settings.key ? setConfirming(true) : openCollectorPage("aihelper"))}>
        {t("col.all.button")}
      </button>
      {status && (
        <p className="cx-quiet" role="status">
          {status} {done > 0 && t("col.all.cost", { cost: friendlyUsd(spent) })}
        </p>
      )}
    </>
  );
}
