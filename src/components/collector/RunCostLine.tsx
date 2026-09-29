import { MODELS, formatEstimate, formatUsd, type ModelId } from "../../services/ai/pricing";
import type { AiError } from "../../services/ai/errors";

/** "Sonnet 5 · about $0.01–$0.04" before a run; the actual cost after; any error in plain words. */
export default function RunCostLine({ model, est, actual, error, onSettings }: { model: ModelId; est: { low: number; high: number }; actual?: number | null; error?: AiError | null; onSettings?: () => void }) {
  const label = MODELS.find((m) => m.id === model)?.label ?? model;
  return (
    <>
      <p className="cl-cost">
        {label} · {actual != null ? `this run cost ${formatUsd(actual)}` : `estimated ${formatEstimate(est)}`}
      </p>
      {error && (
        <p className="sl-status" role="alert">
          {error.message}
          {onSettings && ["no-key", "bad-key", "limit"].includes(error.kind) && (
            <>
              {" "}
              <button type="button" className="btn btn-small" onClick={onSettings}>
                Open AI &amp; pricing
              </button>
            </>
          )}
        </p>
      )}
    </>
  );
}
