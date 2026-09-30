import { useState } from "react";
import { checkListing } from "../../services/ai/aiClient";
import type { ListingReport } from "../../services/ai/schemas";
import { draftFromListing, itemName } from "../../state/collectorDrafts";
import { sendDraftToCollection, useAiSettings } from "../../state/collectorStore";
import { listingGlance, type GlanceMark } from "../../state/listingGlance";
import { formatMoney } from "../../state/market";
import AiGate from "./AiGate";
import PriceView from "./PriceView";
import RunCostLine from "./RunCostLine";
import SerialFactsCard from "./SerialFactsCard";
import { useAiRun } from "./useAiRun";
import { t } from "../../i18n";

const isHttp = (u: string) => /^https?:\/\/\S+\.\S+/i.test(u.trim());

const MARK: Record<GlanceMark, string> = { good: "✓", warn: "!", none: "–" };

/**
 * Before you buy: paste a link to a listing; get what it is, whether the
 * serial number fits, any warning signs, and what similar items sold for.
 */
export default function ListingPage() {
  const settings = useAiSettings();
  const ai = useAiRun(settings, "listing");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [report, setReport] = useState<ListingReport | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [pasteNote, setPasteNote] = useState<string | null>(null);

  async function pasteLink() {
    setPasteNote(null);
    try {
      const copied = (await navigator.clipboard.readText()).trim();
      if (isHttp(copied)) setUrl(copied);
      else setPasteNote(t("col.li.notLink"));
    } catch {
      setPasteNote(t("col.li.noPaste"));
    }
  }

  async function check() {
    setReport(null);
    setCost(null);
    const out = await ai.run((key, model) => checkListing(key, model, url.trim(), pasted));
    if (out) {
      setReport(out.report);
      setCost(out.cost.usd);
    } else setShowPaste(true);
  }

  function startOver() {
    setUrl("");
    setPasted("");
    setShowPaste(false);
    setReport(null);
    setCost(null);
    ai.clearError();
  }

  const kind = report?.kind === "body" || report?.kind === "lens" ? report.kind : null;
  const what = report ? itemName(report.maker, report.model) || report.title : null;

  return (
    <section className="panel stage-listing cx" aria-label={t("tool.listing")}>
      <ol className="cx-flow">
        <li className={isHttp(url) ? "cx-flow-done" : undefined}>
          <h2 className="cx-h">{t("col.li.copy")}</h2>
          <p>{t("col.li.how")}</p>
          <div className="cx-inline">
            <label className="field">
              <span>{t("col.li.link")}</span>
              <input type="url" inputMode="url" autoComplete="off" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
            </label>
            <button type="button" className="btn" onClick={pasteLink}>
              {t("col.li.paste")}
            </button>
          </div>
          {pasteNote && <p className="cx-quiet">{pasteNote}</p>}
          {url.trim() && !isHttp(url) && <p className="cx-quiet">{t("col.li.https")}</p>}
          {showPaste || pasted ? (
            <label className="field">
              <span>{t("col.li.text")}</span>
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={t("col.li.textHint")} />
            </label>
          ) : (
            <button type="button" className="cx-link" onClick={() => setShowPaste(true)}>
              {t("col.li.rather")}
            </button>
          )}
        </li>

        <li className={report ? "cx-flow-done" : undefined}>
          <h2 className="cx-h">{t("col.id.check")}</h2>
          {!settings.key ? (
            <AiGate what={t("col.li.gate")} />
          ) : (
            <>
              <div className="cx-actions">
                <button type="button" className="btn btn-red" disabled={!isHttp(url) || ai.busy} onClick={check}>
                  {ai.busy ? t("col.li.busy") : t("col.li.go")}
                </button>
              </div>
              {!isHttp(url) && <p className="cx-quiet">{t("col.li.needLink")}</p>}
              <RunCostLine est={ai.est} actual={cost} error={ai.error} />
            </>
          )}
        </li>

        <li aria-live="polite">
          <h2 className="cx-h">{t("col.li.found")}</h2>
          {!report ? (
            <p className="cx-quiet">{t("col.li.wait")}</p>
          ) : (
            <div className="cx-answer">
              <p className="cx-answer-lead">{what ? t("col.li.what", { what }) : t("col.li.cant")}</p>
              <p className="cx-quiet">
                {report.asking ? t("col.li.asking", { price: formatMoney(report.asking.price, report.asking.currency) }) : t("col.li.noPrice")}
                {!report.fetched && ` · ${t("col.li.fromText")}`}
              </p>

              <ul className="cx-glance" aria-label={t("col.li.glance")}>
                {listingGlance(report).map((g) => (
                  <li key={g.label} className={`cx-glance-${g.mark}`}>
                    <span className="cx-glance-mark" aria-hidden="true">
                      {MARK[g.mark]}
                    </span>
                    <span>
                      <strong>{g.label}:</strong> {g.text}
                    </span>
                  </li>
                ))}
              </ul>

              {kind && report.statedSerial && (
                <>
                  <h3 className="cx-h">{t("col.glance.serial")}</h3>
                  <SerialFactsCard kind={kind} serial={report.statedSerial} claim={{ model: report.model, year: report.statedYear }} />
                </>
              )}

              {report.redFlags.length > 0 && (
                <>
                  <h3 className="cx-h">{t("col.glance.flags")}</h3>
                  <ul className="cx-flags">
                    {report.redFlags.map((f, i) => (
                      <li key={i}>
                        <strong>{f.flag}.</strong> {f.why}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3 className="cx-h">{t("col.li.similar")}</h3>
              <PriceView range={report.price.range} comparables={report.price.comparables} note={report.price.note} />

              <p className="cx-quiet">{t("col.li.risk")}</p>
              <div className="cx-actions">
                <button type="button" className="btn" onClick={() => sendDraftToCollection(draftFromListing(report, url.trim(), { at: new Date().toISOString(), model: ai.model, usd: cost ?? 0 }))}>
                  {t("col.li.bought")}
                </button>
                <button type="button" className="btn" onClick={startOver}>
                  {t("col.li.again")}
                </button>
              </div>
            </div>
          )}
        </li>
      </ol>
    </section>
  );
}
