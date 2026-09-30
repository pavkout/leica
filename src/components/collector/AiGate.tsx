import { openCollectorPage } from "../../state/collectorStore";
import { MODELS, estimate, friendlyEstimate } from "../../services/ai/pricing";
import { t } from "../../i18n";

/** Shown in place of an AI button until the AI helper is turned on. */
export default function AiGate({ what }: { what: string }) {
  const photo = friendlyEstimate(estimate("photo", MODELS[1].id));
  return (
    <div className="cx-gate" role="note">
      <p className="cx-gate-title">{t("col.gate.title", { what })}</p>
      <p>{t("col.gate.text", { photo })}</p>
      <button type="button" className="btn btn-red" onClick={() => openCollectorPage("aihelper")}>
        {t("col.gate.button")}
      </button>
    </div>
  );
}
