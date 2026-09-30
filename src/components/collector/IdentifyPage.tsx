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
import { t } from "../../i18n";

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
      if (files.length > room) setStatus(t("col.id.tooMany", { n: MAX_PHOTOS }));
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
    <section className="panel stage-identify cx" aria-label={t("tool.identify")}>
      <ol className="cx-flow">
        <li className={photos.length ? "cx-flow-done" : undefined}>
          <h2 className="cx-h">{t("col.way.photo")}</h2>
          <p>{t("col.id.how")}</p>
          <div className="cx-actions">
            <label className={`btn${photos.length ? "" : " btn-red"} cx-file`}>
              {photos.length ? t("col.id.another") : t("col.way.photo")}
              <input type="file" accept="image/*" capture="environment" disabled={photos.length >= MAX_PHOTOS} onChange={(e) => add(e.target.files)} />
            </label>
            <label className="btn cx-file">
              {t("col.id.choose")}
              <input type="file" accept="image/*" multiple disabled={photos.length >= MAX_PHOTOS} onChange={(e) => add(e.target.files)} />
            </label>
          </div>
          {photos.length > 0 && (
            <div className="cx-thumbs">
              {photos.map((p, i) => (
                <img key={i} src={p.dataUrl} alt={t("passport.photoAlt", { n: i + 1 })} />
              ))}
              <button type="button" className="cx-link" onClick={startOver}>
                {t("col.id.removePhotos")}
              </button>
            </div>
          )}
          {status && <p className="cx-problem">{status}</p>}
        </li>

        <li className={reading ? "cx-flow-done" : undefined}>
          <h2 className="cx-h">{t("col.id.check")}</h2>
          {!settings.key ? (
            <AiGate what={t("col.id.gate")} />
          ) : (
            <>
              <div className="cx-actions">
                <button type="button" className="btn btn-red" disabled={!photos.length || ai.busy} onClick={identify}>
                  {ai.busy ? t("col.id.busy") : t("col.id.go")}
                </button>
              </div>
              {!photos.length && <p className="cx-quiet">{t("col.id.needPhoto")}</p>}
              <RunCostLine est={ai.est} actual={cost} error={ai.error} />
            </>
          )}
        </li>

        <li aria-live="polite">
          <h2 className="cx-h">{t("col.id.answer")}</h2>
          {!reading ? (
            <p className="cx-quiet">{t("col.id.wait")}</p>
          ) : (
            <div className="cx-answer">
              <p className="cx-answer-lead">{name ? t("col.id.looks", { name }) : t("col.id.cant")}</p>
              {name && <p className="cx-quiet">{t("col.id.howSure", { s: sureness(reading.confidence.model) })}</p>}
              <dl className="cx-facts">
                <dt>{t("col.glance.serial")}</dt>
                <dd>{reading.serial ? `${reading.serial} (${reading.serialLegible === "partial" ? t("col.ai.partly") : sureness(reading.confidence.serial).toLowerCase()})` : t("col.id.noSerial")}</dd>
                {reading.finish && (
                  <>
                    <dt>{t("col.ai.finish")}</dt>
                    <dd>{reading.finish}</dd>
                  </>
                )}
                {reading.visibleCondition && (
                  <>
                    <dt>{t("col.id.see")}</dt>
                    <dd>{reading.visibleCondition}</dd>
                  </>
                )}
                {reading.engravings.length > 0 && (
                  <>
                    <dt>{t("col.id.writing")}</dt>
                    <dd>{reading.engravings.join(" · ")}</dd>
                  </>
                )}
              </dl>
              {reading.whatWouldHelp && <p className="cx-tip">{t("col.id.surer", { tip: reading.whatWouldHelp })}</p>}
              {reading.serial && (reading.kind === "body" || reading.kind === "lens") && <SerialFactsCard kind={reading.kind} serial={reading.serial} claim={{ model: reading.model }} />}
              <div className="cx-actions">
                <button
                  type="button"
                  className="btn btn-red"
                  onClick={() => sendDraftToCollection(draftFromReading(reading, thumb, { at: new Date().toISOString(), model: ai.model, usd: cost ?? 0 }))}
                >
                  {t("passport.receive.add")}
                </button>
                <button type="button" className="btn" onClick={startOver}>
                  {t("col.id.again")}
                </button>
              </div>
            </div>
          )}
        </li>
      </ol>
    </section>
  );
}
