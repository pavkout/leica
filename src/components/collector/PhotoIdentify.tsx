import { useState } from "react";
import { identifyPhoto } from "../../services/ai/aiClient";
import type { AiSettings } from "../../services/ai/aiSettings";
import { prepareImage, type PreparedImage } from "../../services/ai/image";
import type { PhotoReading } from "../../services/ai/schemas";
import type { CollectionItem } from "../../state/collection";
import { draftFromReading } from "../../state/collectorDrafts";
import { scanThumbnail } from "../../state/shotLogStore";
import RunCostLine from "./RunCostLine";
import SerialFactsCard from "./SerialFactsCard";
import { useAiRun } from "./useAiRun";

const MAX_PHOTOS = 4;

interface Props {
  settings: AiSettings;
  /** Opens the editor with a draft; nothing is saved until the owner saves it. */
  onDraft: (item: CollectionItem) => void;
  onSettings: () => void;
  onClose: () => void;
}


/** Photo → item: Claude reads the item and its engravings; the serial lists check the number. */
export default function PhotoIdentify({ settings, onDraft, onSettings, onClose }: Props) {
  const ai = useAiRun(settings, "photo");
  const [photos, setPhotos] = useState<PreparedImage[]>([]);
  const [thumb, setThumb] = useState<string | undefined>();
  const [reading, setReading] = useState<PhotoReading | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setStatus(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const list = [...files].slice(0, room);
      const prepared = await Promise.all(list.map((f) => prepareImage(f)));
      if (!thumb) {
        setThumb(await scanThumbnail(list[0], 480));
      }
      setPhotos((p) => [...p, ...prepared]);
      if (files.length > room) setStatus(`Up to ${MAX_PHOTOS} photos; the rest were left out.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }

  async function identify() {
    setReading(null);
    setCost(null);
    const out = await ai.run((key, model) => identifyPhoto(key, model, photos));
    if (out) {
      setReading(out.reading);
      setCost(out.cost.usd);
    }
  }

  return (
    <div className="cl-panel" role="group" aria-label="Identify from photos">
      <h3>Identify from photos</h3>
      <p className="small">Take or choose 1–{MAX_PHOTOS} photos: the whole item, and a sharp close-up of the serial (top plate, or the lens's front ring). Photos are scaled down and their location data removed before they're sent.</p>
      <div className="cl-row">
        <label className="btn btn-small sl-upload">
          {photos.length ? "Add another photo" : "Take or choose photos"}
          <input type="file" accept="image/*" multiple disabled={photos.length >= MAX_PHOTOS} onChange={(e) => add(e.target.files)} />
        </label>
        {photos.length > 0 && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setPhotos([]);
              setThumb(undefined);
              setReading(null);
            }}
          >
            Clear
          </button>
        )}
      </div>
      {photos.length > 0 && (
        <div className="cl-thumbs">
          {photos.map((p, i) => (
            <img key={i} src={p.dataUrl} alt={`Photo ${i + 1}`} />
          ))}
        </div>
      )}
      {status && <p className="sl-status">{status}</p>}
      <div className="cl-row">
        <button type="button" className="btn btn-red btn-small" disabled={!photos.length || ai.busy} onClick={identify}>
          {ai.busy ? "Reading…" : "Identify"}
        </button>
        <button type="button" className="btn btn-small" onClick={onClose}>
          Close
        </button>
      </div>
      <RunCostLine model={ai.model} est={ai.est} actual={cost} error={ai.error} onSettings={onSettings} />

      {reading && (
        <div className="cl-card cl-ai" aria-live="polite">
          <p className="cl-label">Read by AI</p>
          <p className="cl-facts-main">
            <strong>{[reading.maker, reading.model, reading.lensName].filter(Boolean).join(" ") || "Not identified"}</strong>{" "}
            <span className="cl-tag">model: {reading.confidence.model} confidence</span>
          </p>
          <p>
            Serial:{" "}
            {reading.serial ? (
              <>
                {reading.serial} <span className="cl-tag">{reading.serialLegible === "partial" ? "partly legible" : `${reading.confidence.serial} confidence`}</span>
              </>
            ) : (
              "not legible in these photos"
            )}
          </p>
          {reading.finish && <p>Finish: {reading.finish}</p>}
          {reading.engravings.length > 0 && <p className="small">Engravings: {reading.engravings.join(" · ")}</p>}
          {reading.visibleCondition && <p className="small">Visible condition: {reading.visibleCondition}</p>}
          {reading.whatWouldHelp && <p className="small">To settle the rest: {reading.whatWouldHelp}</p>}
          {reading.serial && (reading.kind === "body" || reading.kind === "lens") && (
            <SerialFactsCard kind={reading.kind} serial={reading.serial} claim={{ model: reading.model }} />
          )}
          <div className="cl-row">
            <button
              type="button"
              className="btn btn-red btn-small"
              onClick={() => onDraft(draftFromReading(reading, thumb, { at: new Date().toISOString(), model: ai.model, usd: cost ?? 0 }))}
            >
              Make a draft item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
