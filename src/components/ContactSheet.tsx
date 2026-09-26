import { useEffect, useRef, useState } from "react";
import { OUTCOME_TAGS, type ExportableFrame, type Frame, type FrameMeta, type OutcomeTag, framesToCsv, framesToJson } from "../state/rollExport";

export type { Frame, FrameMeta };

interface Props {
  frames: Frame[];
  /** Roll length for film; null for a memory card. */
  capacity: number | null;
  filmName: string | null;
  /** Colour negatives have an orange base; black and white is grey. */
  base: "color" | "bw" | "slide" | "digital";
  onRewind: () => void;
  onUpdateNote: (id: number, note: string) => void;
  onUpdateOutcome: (id: number, outcome: OutcomeTag | undefined) => void;
}

/** Triggers a browser download of in-memory text; no server round-trip. */
function downloadText(fileName: string, mimeType: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function toExportable(f: Frame): ExportableFrame {
  return { number: f.number, fileName: f.fileName, meta: f.meta, note: f.note };
}

export default function ContactSheet({ frames, capacity, filmName, base, onRewind, onUpdateNote, onUpdateOutcome }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = frames.find((f) => f.id === openId) ?? null;
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const film = capacity !== null;
  const rollLabel = film ? `roll-${filmName?.replace(/\s+/g, "-").toLowerCase() ?? "frames"}` : "card";

  return (
    <section className="panel stage-roll" aria-label={film ? "Contact sheet" : "Memory card"}>
      <div className="panel-head">
        <h2>{film ? `Contact sheet · ${filmName}` : "Memory card"}</h2>
        <span className="row-actions">
          {frames.length > 0 && (
            <>
              <button type="button" className="btn btn-small" onClick={() => downloadText(`${rollLabel}.csv`, "text/csv", framesToCsv(frames.map(toExportable)))}>
                Export CSV
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => downloadText(`${rollLabel}.json`, "application/json", framesToJson(frames.map(toExportable)))}
              >
                Export JSON
              </button>
            </>
          )}
          {film && frames.length > 0 && (
            <button type="button" className="btn btn-small" onClick={onRewind}>
              Rewind &amp; new roll
            </button>
          )}
        </span>
      </div>

      {frames.length === 0 ? (
        <p className="muted small">
          {film
            ? `${capacity} exposures loaded. Press the shutter to take your first frame; it's developed with the film's look and lands here.`
            : "Press the shutter. Your photos appear here and can be downloaded."}
        </p>
      ) : (
        <div className={`sheet sheet-${base}`}>
          {frames.map((f) => (
            <button key={f.id} type="button" className="sheet-frame" onClick={() => setOpenId(f.id)} aria-label={`Frame ${f.number}: ${f.caption}${f.outcome ? `, tagged ${f.outcome}` : ""}`}>
              {film && <span className="sheet-edge">{f.number}  ▸ {f.number}A</span>}
              {f.outcome && <span className={`sheet-tag sheet-tag-${f.outcome}`}>{OUTCOME_TAGS.find((t) => t.id === f.outcome)!.label}</span>}
              <img src={f.url} alt="" />
            </button>
          ))}
        </div>
      )}

      <dialog ref={dialog} className="lightbox" onClose={() => setOpenId(null)} onClick={(e) => e.target === e.currentTarget && setOpenId(null)}>
        {open && (
          <figure>
            <img src={open.url} alt={`Frame ${open.number}`} />
            <figcaption>
              <span>
                <b>#{open.number}</b> {open.caption}
              </span>
              <div className="field">
                <span>Outcome</span>
                <div className="dial" role="radiogroup" aria-label="Outcome tag">
                  {OUTCOME_TAGS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={open.outcome === t.id}
                      className={open.outcome === t.id ? "dial-step dial-on" : "dial-step"}
                      onClick={() => onUpdateOutcome(open.id, open.outcome === t.id ? undefined : t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span>Composition note</span>
                <input
                  type="text"
                  value={open.note ?? ""}
                  placeholder="Missed focus, great light, reshoot…"
                  onChange={(e) => onUpdateNote(open.id, e.target.value)}
                />
              </label>
              <span className="lightbox-actions">
                <a className="btn btn-small" href={open.url} download={open.fileName}>
                  Download
                </a>
                <button type="button" className="btn btn-small" onClick={() => setOpenId(null)}>
                  Close
                </button>
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </section>
  );
}
