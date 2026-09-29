import { friendlyEstimate, friendlyUsd } from "../../services/ai/pricing";
import type { AiError } from "../../services/ai/errors";
import { openCollectorPage } from "../../state/collectorStore";

interface Props {
  est: { low: number; high: number };
  /** The actual cost once a run has finished. */
  actual?: number | null;
  error?: AiError | null;
}

/** "Costs 1–4 cents" before a run, "That cost 3 cents" after, and any problem in plain words with the way out. */
export default function RunCostLine({ est, actual, error }: Props) {
  return (
    <>
      <p className="cx-cost">{actual != null ? `That cost ${friendlyUsd(actual)}.` : `Costs ${friendlyEstimate(est)}.`}</p>
      {error && (
        <div className="cx-problem" role="alert">
          <p>{error.message}</p>
          {["no-key", "bad-key", "limit"].includes(error.kind) && (
            <button type="button" className="btn btn-small" onClick={() => openCollectorPage("aihelper")}>
              Open the AI helper
            </button>
          )}
        </div>
      )}
    </>
  );
}
