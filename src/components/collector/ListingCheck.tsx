import { useState } from "react";
import { checkListing } from "../../services/ai/aiClient";
import type { AiSettings } from "../../services/ai/aiSettings";
import type { ListingReport } from "../../services/ai/schemas";
import type { CollectionItem } from "../../state/collection";
import { draftFromListing } from "../../state/collectorDrafts";
import { askingNote, formatMoney } from "../../state/market";
import PriceView from "./PriceView";
import RunCostLine from "./RunCostLine";
import SerialFactsCard from "./SerialFactsCard";
import { useAiRun } from "./useAiRun";

interface Props {
  settings: AiSettings;
  onDraft: (item: CollectionItem) => void;
  onSettings: () => void;
  onClose: () => void;
}

const isHttp = (u: string) => /^https?:\/\/\S+\.\S+/i.test(u.trim());


/** Paste a listing link: what it is, whether the serial fits, red flags, and a cited price range. */
export default function ListingCheck({ settings, onDraft, onSettings, onClose }: Props) {
  const ai = useAiRun(settings, "listing");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [report, setReport] = useState<ListingReport | null>(null);
  const [cost, setCost] = useState<number | null>(null);

  async function check() {
    setReport(null);
    setCost(null);
    const out = await ai.run((key, model) => checkListing(key, model, url.trim(), pasted));
    if (out) {
      setReport(out.report);
      setCost(out.cost.usd);
    } else setShowPaste(true);
  }

  const kind = report?.kind === "body" || report?.kind === "lens" ? report.kind : null;
  const note = report ? askingNote(report.asking, report.price.range) : null;

  return (
    <div className="cl-panel" role="group" aria-label="Check a listing">
      <h3>Check a listing</h3>
      <p className="small">Paste the link to a public listing (eBay, an auction house, a dealer). Claude reads it, checks the serial against the Leitz lists, looks for red flags, and finds comparable prices with their sources.</p>
      <div className="cl-row">
        <label className="field">
          <span>Listing link</span>
          <input type="url" inputMode="url" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
        </label>
      </div>
      {showPaste || pasted ? (
        <label className="field">
          <span>Listing text (optional; needed if the site can't be read)</span>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste the title, description and price" />
        </label>
      ) : (
        <button type="button" className="btn btn-small" onClick={() => setShowPaste(true)}>
          Paste the listing text too
        </button>
      )}
      <div className="cl-row">
        <button type="button" className="btn btn-red btn-small" disabled={!isHttp(url) || ai.busy} onClick={check}>
          {ai.busy ? "Checking… (up to a minute or two)" : "Check"}
        </button>
        <button type="button" className="btn btn-small" onClick={onClose}>
          Close
        </button>
      </div>
      <RunCostLine model={ai.model} est={ai.est} actual={cost} error={ai.error} onSettings={onSettings} />

      {report && (
        <div aria-live="polite">
          <div className="cl-card cl-ai">
            <p className="cl-label">The listing, as read by AI{!report.fetched && " (from your pasted text)"}</p>
            <p className="cl-facts-main">
              <strong>{[report.maker, report.model].filter(Boolean).join(" ") || report.title || "Not identified"}</strong>
            </p>
            {report.title && <p className="small">“{report.title}”</p>}
            <p>
              {report.asking ? `Asking ${formatMoney(report.asking.price, report.asking.currency)}` : "No asking price found"}
              {report.statedSerial && ` · serial stated: ${report.statedSerial}`}
              {report.statedYear && ` · year stated: ${report.statedYear}`}
            </p>
          </div>
          {kind && report.statedSerial ? (
            <SerialFactsCard kind={kind} serial={report.statedSerial} claim={{ model: report.model, year: report.statedYear }} />
          ) : (
            <p className="muted small">No serial stated in the listing, so it can't be checked against the lists. Ask the seller for a photo of it.</p>
          )}
          <div className="cl-card">
            <p className="cl-label">Red flags</p>
            {report.redFlags.length ? (
              report.redFlags.map((f, i) => (
                <p key={i} className="cl-flag">
                  <strong>{f.flag}.</strong> {f.why}
                </p>
              ))
            ) : (
              <p className="small">None found. That isn't a guarantee: inspect the item or buy with a return policy.</p>
            )}
          </div>
          <div className="cl-card">
            <p className="cl-label">Price</p>
            {note && <p>{note}</p>}
            <PriceView range={report.price.range} comparables={report.price.comparables} note={report.price.note} />
          </div>
          <div className="cl-row">
            <button type="button" className="btn btn-small" onClick={() => onDraft(draftFromListing(report, url.trim(), { at: new Date().toISOString(), model: ai.model, usd: cost ?? 0 }))}>
              Add to my collection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
