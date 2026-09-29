import { openCollectorPage } from "../../state/collectorStore";
import { MODELS, estimate, friendlyEstimate } from "../../services/ai/pricing";

/** Shown in place of an AI button until the AI helper is turned on. */
export default function AiGate({ what }: { what: string }) {
  const photo = friendlyEstimate(estimate("photo", MODELS[1].id));
  return (
    <div className="cx-gate" role="note">
      <p className="cx-gate-title">To {what}, turn on the AI helper</p>
      <p>It takes about two minutes. You pay the AI company directly, a few cents each time (a photo check costs {photo}).</p>
      <button type="button" className="btn btn-red" onClick={() => openCollectorPage("aihelper")}>
        Turn on the AI helper
      </button>
    </div>
  );
}
