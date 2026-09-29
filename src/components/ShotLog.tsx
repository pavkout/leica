import { useState } from "react";
import { formatShutter, type Body, type Lens } from "../data/gear";
import { logToCsv, rollsOf } from "../state/shotLog";
import { attachRollScans, logFrame, removeEntry, scanThumbnail, setCurrentRoll, updateEntry, useShotLog } from "../state/shotLogStore";
import { formatDistance, formatFNumber, sentenceEnd, type Units } from "../utils/format";

interface Props {
  body: Body;
  lens: Lens;
  fNumber: number;
  shutterSec: number;
  filmLabel: string;
  focusMm: number;
  units: Units;
  /** Open the Light meter, which can log a reading straight here. */
  onOpenMeter?: () => void;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * A notebook for a real film camera: log each frame as you shoot (the settings
 * set here, a place, a note), then drop the scans in when they're back and
 * see each picture beside what you did.
 */
export default function ShotLog({ body, lens, fNumber, shutterSec, filmLabel, focusMm, units, onOpenMeter }: Props) {
  const { log, roll } = useShotLog();
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [viewRoll, setViewRoll] = useState(roll);
  const rolls = rollsOf(log).includes(roll) ? rollsOf(log) : [...rollsOf(log), roll];
  const entries = log.filter((e) => e.roll === viewRoll).sort((a, b) => a.frame - b.frame);

  function add() {
    const ok = logFrame({ body: body.name, lens: lens.name, fNumber, shutterSec, film: filmLabel, focusMm, place: place || undefined, note: note || undefined });
    setNote("");
    setViewRoll(roll);
    setStatus(ok ? null : "This device's storage is full: the frame is logged for this visit only. Export the log to keep it.");
  }

  function newRoll() {
    const n = rollsOf(log).length + 1;
    const name = `Roll ${n}`;
    setCurrentRoll(name);
    setViewRoll(name);
  }

  async function addScans(files: FileList | null) {
    if (!files?.length) return;
    try {
      // File names from a lab or scanner sort in frame order.
      const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const scans = await Promise.all(sorted.map((f) => scanThumbnail(f)));
      const r = attachRollScans(viewRoll, scans);
      setStatus(
        !r.saved
          ? "This device's storage is full: scans are attached for this visit only."
          : r.unmatched
            ? `${scans.length - r.unmatched} scans matched. ${r.unmatched} had no logged frame left on ${viewRoll}.`
            : `${scans.length} scan${scans.length === 1 ? "" : "s"} matched to ${viewRoll}, in frame order.`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="panel stage-shotlog" aria-label="Shot log">
      <div className="sl-log">
        <div className="sl-now">
          <p className="sl-roll">
            {roll} · frame {log.filter((e) => e.roll === roll).length + 1}
          </p>
          <p className="sl-settings">
            <span>{formatFNumber(fNumber)}</span>
            <span>{formatShutter(shutterSec)}</span>
            <span>{filmLabel}</span>
            <span>{formatDistance(focusMm, units)}</span>
          </p>
          <p className="muted small">
            {body.name} · {sentenceEnd(lens.name)} Set these on the camera screen (or read them off the Light meter) to match what you set on your real camera.
          </p>
        </div>
        <div className="sl-form">
          <label className="field">
            <span>Place</span>
            <input type="text" value={place} placeholder="Where you are" onChange={(e) => setPlace(e.target.value)} />
          </label>
          <label className="field">
            <span>Note</span>
            <input type="text" value={note} placeholder="What you saw, why you shot it" onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="sl-actions">
            <button type="button" className="btn btn-red" onClick={add}>
              Log this frame
            </button>
            {onOpenMeter && (
              <button type="button" className="btn" onClick={onOpenMeter}>
                Meter first
              </button>
            )}
            <button type="button" className="btn" onClick={newRoll}>
              Start a new roll
            </button>
          </div>
        </div>
      </div>

      {status && (
        <p className="sl-status" role="status">
          {status}
        </p>
      )}

      <div className="sl-roll-head">
        {rolls.length > 1 ? (
          <div className="dial" role="radiogroup" aria-label="Roll">
            {rolls.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={r === viewRoll} className={r === viewRoll ? "dial-step dial-on" : "dial-step"} onClick={() => setViewRoll(r)}>
                {r}
              </button>
            ))}
          </div>
        ) : (
          <h3>{viewRoll}</h3>
        )}
        <span className="sl-roll-actions">
          <label className="btn btn-small sl-upload">
            Add scans
            <input type="file" accept="image/*" multiple onChange={(e) => void addScans(e.target.files)} />
          </label>
          {log.length > 0 && (
            <button type="button" className="btn btn-small" onClick={() => download("shot-log.csv", logToCsv(log))}>
              Export CSV
            </button>
          )}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="muted">Nothing logged on {viewRoll} yet. Log each frame as you take it; when the scans come back, add them and they line up in order.</p>
      ) : (
        <ol className="sl-entries">
          {entries.map((e) => (
            <li key={e.id}>
              <span className="sl-frame">{e.frame}</span>
              {e.scan ? <img src={e.scan} alt={`Scan of frame ${e.frame}`} className="sl-scan" /> : <span className="sl-scan sl-scan-empty">No scan yet</span>}
              <div className="sl-entry-body">
                <p className="sl-entry-settings">
                  {formatFNumber(e.fNumber)} · {formatShutter(e.shutterSec)} · {e.film}
                  {e.focusMm !== undefined && ` · ${formatDistance(e.focusMm, units)}`}
                </p>
                <p className="muted small">
                  {new Date(e.takenAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  {e.place && ` · ${e.place}`}
                </p>
                <input type="text" className="sl-note" value={e.note ?? ""} placeholder="Add a note" aria-label={`Note for frame ${e.frame}`} onChange={(ev) => updateEntry(e.id, { note: ev.target.value })} />
              </div>
              <button type="button" className="btn btn-small sl-remove" aria-label={`Remove frame ${e.frame}`} onClick={() => removeEntry(e.id)}>
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="hint">Stored on this device only. Scans are kept as small previews; export the CSV to keep the log elsewhere.</p>
    </section>
  );
}
