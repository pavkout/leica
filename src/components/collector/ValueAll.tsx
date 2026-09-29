import { useRef, useState } from "react";
import { valueItem } from "../../services/ai/aiClient";
import { modelFor, type AiSettings } from "../../services/ai/aiSettings";
import { describeApiError } from "../../services/ai/errors";
import { estimate, formatEstimate, formatUsd } from "../../services/ai/pricing";
import { loadSpend, wouldExceed } from "../../services/ai/spendLog";
import type { CollectionItem, Valuation } from "../../state/collection";

interface Props {
  items: CollectionItem[];
  settings: AiSettings;
  onValued: (id: string, v: Valuation) => void;
  onSettings: () => void;
}

/** Values every item, one at a time, after showing the total estimate. Stoppable; finished items keep their values. */
export default function ValueAll({ items, settings, onValued, onSettings }: Props) {
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
    if (!settings.key) return onSettings();
    stop.current = false;
    setRunning(true);
    setDone(0);
    setSpent(0);
    setStatus(null);
    let usd = 0;
    for (const [i, item] of items.entries()) {
      if (stop.current) {
        setStatus(`Stopped after ${i} of ${items.length}.`);
        break;
      }
      if (wouldExceed(loadSpend(), settings.monthlyLimitUsd, one.high, new Date())) {
        setStatus(`Stopped at your monthly limit after ${i} of ${items.length}.`);
        break;
      }
      try {
        const out = await valueItem(settings.key, model, item);
        usd += out.cost.usd;
        onValued(item.id, { at: new Date().toISOString(), modelUsed: model, range: out.price.range, comparables: out.price.comparables, note: out.price.note, costUsd: out.cost.usd });
      } catch (e) {
        const err = describeApiError(e);
        if (["bad-key", "no-credit", "offline", "no-key"].includes(err.kind)) {
          setStatus(`${err.message} Stopped after ${i} of ${items.length}.`);
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
      <p className="sl-status" role="status">
        Valuing {Math.min(done + 1, items.length)} of {items.length} · spent {formatUsd(spent)}{" "}
        <button type="button" className="btn btn-small" onClick={() => (stop.current = true)}>
          Stop
        </button>
      </p>
    );
  if (confirming)
    return (
      <p className="sl-status" role="alertdialog" aria-label="Value all items">
        Value all {items.length} items? Estimated {formatEstimate(total)} in total.{" "}
        <button type="button" className="btn btn-red btn-small" onClick={runAll}>
          Value all
        </button>{" "}
        <button type="button" className="btn btn-small" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </p>
    );
  return (
    <>
      <button type="button" className="btn btn-small" onClick={() => (settings.key ? setConfirming(true) : onSettings())}>
        Value all
      </button>
      {status && (
        <p className="sl-status" role="status">
          {status} {done > 0 && `Spent ${formatUsd(spent)}.`}
        </p>
      )}
    </>
  );
}
