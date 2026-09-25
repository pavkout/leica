import { useEffect, useRef, useState } from "react";

export interface Frame {
  id: number;
  number: number;
  url: string;
  caption: string;
  fileName: string;
}

interface Props {
  frames: Frame[];
  /** Roll length for film; null for a memory card. */
  capacity: number | null;
  filmName: string | null;
  /** Colour negatives have an orange base; black and white is grey. */
  base: "color" | "bw" | "slide" | "digital";
  onRewind: () => void;
}

export default function ContactSheet({ frames, capacity, filmName, base, onRewind }: Props) {
  const [open, setOpen] = useState<Frame | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const film = capacity !== null;

  return (
    <section className="panel stage-roll" aria-label={film ? "Contact sheet" : "Memory card"}>
      <div className="panel-head">
        <h2>{film ? `Contact sheet · ${filmName}` : "Memory card"}</h2>
        {film && frames.length > 0 && (
          <button type="button" className="btn btn-small" onClick={onRewind}>
            Rewind &amp; new roll
          </button>
        )}
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
            <button key={f.id} type="button" className="sheet-frame" onClick={() => setOpen(f)} aria-label={`Frame ${f.number}: ${f.caption}`}>
              {film && <span className="sheet-edge">{f.number}  ▸ {f.number}A</span>}
              <img src={f.url} alt="" />
            </button>
          ))}
        </div>
      )}

      <dialog ref={dialog} className="lightbox" onClose={() => setOpen(null)} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
        {open && (
          <figure>
            <img src={open.url} alt={`Frame ${open.number}`} />
            <figcaption>
              <span>
                <b>#{open.number}</b> {open.caption}
              </span>
              <span className="lightbox-actions">
                <a className="btn btn-small" href={open.url} download={open.fileName}>
                  Download
                </a>
                <button type="button" className="btn btn-small" onClick={() => setOpen(null)}>
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
