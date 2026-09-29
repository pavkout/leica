import { useState } from "react";
import { identifyPhoto } from "../../services/ai/aiClient";
import { prepareImage, type PreparedImage } from "../../services/ai/image";
import type { PhotoReading } from "../../services/ai/schemas";
import { draftFromReading, itemName } from "../../state/collectorDrafts";
import { sendDraftToCollection, useAiSettings } from "../../state/collectorStore";
import { scanThumbnail } from "../../state/shotLogStore";
import AiGate from "./AiGate";
import RunCostLine from "./RunCostLine";
import SerialFactsCard from "./SerialFactsCard";
import { sureness } from "./sureness";
import { useAiRun } from "./useAiRun";

const MAX_PHOTOS = 4;

/**
 * What is this? Photograph a camera or lens; the AI names it and reads the
 * serial; the factory list checks the number. Three steps, one button each.
 */
export default function IdentifyPage() {
  const settings = useAiSettings();
  const ai = useAiRun(settings, "photo");
  const [photos, setPhotos] = useState<PreparedImage[]>([]);
  const [thumb, setThumb] = useState<string | undefined>();
  const [reading, setReading] = useState<PhotoReading | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setStatus(null);
    setReading(null);
    try {
      const room = MAX_PHOTOS - photos.length;
      const list = [...files].slice(0, room);
      const prepared = await Promise.all(list.map((f) => prepareImage(f)));
      if (!thumb) setThumb(await scanThumbnail(list[0], 480));
      setPhotos((p) => [...p, ...prepared]);
      if (files.length > room) setStatus(`You can use up to ${MAX_PHOTOS} photos, so the rest were left out.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  }

  function startOver() {
    setPhotos([]);
    setThumb(undefined);
    setReading(null);
    setCost(null);
    setStatus(null);
    ai.clearError();
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

  const name = reading ? itemName(reading.maker, reading.model, reading.lensName) : "";

  return (
    <section className="panel stage-identify cx" aria-label="What is this?">
      <ol className="cx-flow">
        <li className={photos.length ? "cx-flow-done" : undefined}>
          <h2 className="cx-h">Take a photo</h2>
          <p>Photograph the whole camera or lens. If you can, add a close-up of the serial number: on a camera it's on the top, next to the shutter button; on a lens it's on the front ring, around the glass.</p>
          <div className="cx-actions">
            <label className={`btn${photos.length ? "" : " btn-red"} cx-file`}>
              {photos.length ? "Add another photo" : "Take a photo"}
              <input type="file" accept="image/*" capture="environment" disabled={photos.length >= MAX_PHOTOS} onChange={(e) => add(e.target.files)} />
            </label>
            <label className="btn cx-file">
              Choose from my photos
              <input type="file" accept="image/*" multiple disabled={photos.length >= MAX_PHOTOS} onChange={(e) => add(e.target.files)} />
            </label>
          </div>
          {photos.length > 0 && (
            <div className="cx-thumbs">
              {photos.map((p, i) => (
                <img key={i} src={p.dataUrl} alt={`Your photo ${i + 1}`} />
              ))}
              <button type="button" className="cx-link" onClick={startOver}>
                Remove the photos
              </button>
            </div>
          )}
          {status && <p className="cx-problem">{status}</p>}
        </li>

        <li className={reading ? "cx-flow-done" : undefined}>
          <h2 className="cx-h">Check it</h2>
          {!settings.key ? (
            <AiGate what="recognise items from photos" />
          ) : (
            <>
              <div className="cx-actions">
                <button type="button" className="btn btn-red" disabled={!photos.length || ai.busy} onClick={identify}>
                  {ai.busy ? "Looking at your photo…" : "Tell me what this is"}
                </button>
              </div>
              {!photos.length && <p className="cx-quiet">Take or choose a photo first.</p>}
              <RunCostLine est={ai.est} actual={cost} error={ai.error} />
            </>
          )}
        </li>

        <li aria-live="polite">
          <h2 className="cx-h">The answer</h2>
          {!reading ? (
            <p className="cx-quiet">It appears here, usually within a few seconds.</p>
          ) : (
            <div className="cx-answer">
              <p className="cx-answer-lead">{name ? `This looks like a ${name}.` : "We couldn't tell what this is from these photos."}</p>
              {name && <p className="cx-quiet">How sure: {sureness(reading.confidence.model)}</p>}
              <dl className="cx-facts">
                <dt>Serial number</dt>
                <dd>{reading.serial ? `${reading.serial} (${reading.serialLegible === "partial" ? "partly readable" : sureness(reading.confidence.serial).toLowerCase()})` : "Not readable in these photos"}</dd>
                {reading.finish && (
                  <>
                    <dt>Finish</dt>
                    <dd>{reading.finish}</dd>
                  </>
                )}
                {reading.visibleCondition && (
                  <>
                    <dt>What we can see</dt>
                    <dd>{reading.visibleCondition}</dd>
                  </>
                )}
                {reading.engravings.length > 0 && (
                  <>
                    <dt>Writing on it</dt>
                    <dd>{reading.engravings.join(" · ")}</dd>
                  </>
                )}
              </dl>
              {reading.whatWouldHelp && <p className="cx-tip">To be surer: {reading.whatWouldHelp}</p>}
              {reading.serial && (reading.kind === "body" || reading.kind === "lens") && <SerialFactsCard kind={reading.kind} serial={reading.serial} claim={{ model: reading.model }} />}
              <div className="cx-actions">
                <button
                  type="button"
                  className="btn btn-red"
                  onClick={() => sendDraftToCollection(draftFromReading(reading, thumb, { at: new Date().toISOString(), model: ai.model, usd: cost ?? 0 }))}
                >
                  Add to my collection
                </button>
                <button type="button" className="btn" onClick={startOver}>
                  Check something else
                </button>
              </div>
            </div>
          )}
        </li>
      </ol>
    </section>
  );
}
