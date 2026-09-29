import { useState } from "react";
import { AiError, aiError, describeApiError } from "../../services/ai/errors";
import { modelFor, type AiSettings } from "../../services/ai/aiSettings";
import { estimate, type AiAction, type ModelId } from "../../services/ai/pricing";
import { loadSpend, wouldExceed } from "../../services/ai/spendLog";

/**
 * Runs one AI action with the checks every run needs, in order: a key, the
 * monthly limit (against the high end of the estimate, before anything is
 * sent), then the call, with any failure turned into a plain message.
 */
export function useAiRun(settings: AiSettings, action: AiAction) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const model: ModelId = modelFor(settings, action);
  const est = estimate(action, model);

  async function run<T>(fn: (key: string, model: ModelId) => Promise<T>): Promise<T | null> {
    setError(null);
    if (!settings.key) {
      setError(aiError("no-key"));
      return null;
    }
    if (wouldExceed(loadSpend(), settings.monthlyLimitUsd, est.high, new Date())) {
      setError(aiError("limit"));
      return null;
    }
    setBusy(true);
    try {
      return await fn(settings.key, model);
    } catch (e) {
      setError(describeApiError(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error, model, est, clearError: () => setError(null) };
}
