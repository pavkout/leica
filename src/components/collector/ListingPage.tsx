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
      const t = (await navigator.clipboard.readText()).trim();
      if (isHttp(t)) setUrl(t);
      else setPasteNote("What you copied isn't a link. Copy the listing's link, then press Paste again.");
    } catch {
      setPasteNote("This browser didn't allow pasting. Press and hold in the box, then choose Paste.");
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
    <section className="panel stage-listing cx" aria-label="Before you buy">
      <ol className="cx-flow">
        <li className={isHttp(url) ? "cx-flow-done" : undefined}>
          <h2 className="cx-h">Copy the link to the listing</h2>
          <p>On the listing (eBay, an auction, a shop), press Share and then Copy link. Then paste it here.</p>
          <div className="cx-inline">
            <label className="field">
              <span>Link to the listing</span>
              <input type="url" inputMode="url" autoComplete="off" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
            </label>
            <button type="button" className="btn" onClick={pasteLink}>
              Paste
            </button>
          </div>
          {pasteNote && <p className="cx-quiet">{pasteNote}</p>}
          {url.trim() && !isHttp(url) && <p className="cx-quiet">A link starts with https://</p>}
          {showPaste || pasted ? (
            <label className="field">
              <span>The listing's text (only needed if the link can't be read)</span>
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Copy the title, description and price from the listing, and paste them here" />
            </label>
          ) : (
            <button type="button" className="cx-link" onClick={() => setShowPaste(true)}>
              I'd rather paste the listing's text
            </button>
          )}
        </li>

        <li className={report ? "cx-flow-done" : undefined}>
          <h2 className="cx-h">Check it</h2>
          {!settings.key ? (
            <AiGate what="check listings" />
          ) : (
            <>
              <div className="cx-actions">
                <button type="button" className="btn btn-red" disabled={!isHttp(url) || ai.busy} onClick={check}>
                  {ai.busy ? "Checking… this takes about a minute" : "Check this listing"}
                </button>
              </div>
              {!isHttp(url) && <p className="cx-quiet">Paste the link first.</p>}
              <RunCostLine est={ai.est} actual={cost} error={ai.error} />
            </>
          )}
        </li>

        <li aria-live="polite">
          <h2 className="cx-h">What we found</h2>
          {!report ? (
            <p className="cx-quiet">It appears here when the check is done.</p>
          ) : (
            <div className="cx-answer">
              <p className="cx-answer-lead">{what ? `A ${what}` : "We couldn't tell what's for sale."}</p>
              <p className="cx-quiet">
                {report.asking ? `Asking ${formatMoney(report.asking.price, report.asking.currency)}` : "No price found"}
                {!report.fetched && ". Read from the text you pasted"}
              </p>

              <ul className="cx-glance" aria-label="At a glance">
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
                  <h3 className="cx-h">The serial number</h3>
                  <SerialFactsCard kind={kind} serial={report.statedSerial} claim={{ model: report.model, year: report.statedYear }} />
                </>
              )}

              {report.redFlags.length > 0 && (
                <>
                  <h3 className="cx-h">Warning signs</h3>
                  <ul className="cx-flags">
                    {report.redFlags.map((f, i) => (
                      <li key={i}>
                        <strong>{f.flag}.</strong> {f.why}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3 className="cx-h">What similar items sold for</h3>
              <PriceView range={report.price.range} comparables={report.price.comparables} note={report.price.note} />

              <p className="cx-quiet">No warning signs doesn't mean no risk. Buy where you can return it, and see it in person if you can.</p>
              <div className="cx-actions">
                <button type="button" className="btn" onClick={() => sendDraftToCollection(draftFromListing(report, url.trim(), { at: new Date().toISOString(), model: ai.model, usd: cost ?? 0 }))}>
                  I bought it: add to my collection
                </button>
                <button type="button" className="btn" onClick={startOver}>
                  Check another listing
                </button>
              </div>
            </div>
          )}
        </li>
      </ol>
    </section>
  );
}
