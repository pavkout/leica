import { useEffect, useState } from "react";
import { langTag, t, useLang } from "../../i18n";
import { describeCondition } from "../../services/ai/aiClient";
import { prepareImage, type PreparedImage } from "../../services/ai/image";
import type { ConditionReport } from "../../services/ai/schemas";
import { useCollection } from "../../state/collectionStorage";
import { openCollectorPage, useAiSettings } from "../../state/collectorStore";
import { SELL_SHOTS, listingDraft, type SellShot } from "../../state/listingDraft";
import { currentFingerprint } from "../../state/passport";
import { usePassports } from "../../state/passportStore";
import AiGate from "./AiGate";
import RunCostLine from "./RunCostLine";
import { useAiRun } from "./useAiRun";

/**
 * Sell it well (#59): the photos a buyer wants, a factual condition
 * description (yours, or the AI's notes), and a listing drafted from the
 * piece's record, serial check and passport, ready to copy into a sale.
 */
export default function SellItWell() {
  useLang();
  const items = useCollection().filter((i) => i.kind !== "accessory");
  const passports = usePassports();
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const item = items.find((i) => i.id === itemId);
  const passport = item ? passports.get(item.id) : undefined;
  const [fp, setFp] = useState("");
  const [shots, setShots] = useState<Partial<Record<SellShot, PreparedImage>>>({});
  const [ownNotes, setOwnNotes] = useState("");
  const [included, setIncluded] = useState("");
  const [report, setReport] = useState<ConditionReport | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const settings = useAiSettings();
  const ai = useAiRun(settings, "condition");

  useEffect(() => {
    let live = true;
    if (passport) void currentFingerprint(passport).then((f) => live && setFp(f));
    else setFp("");
    return () => {
      live = false;
    };
  }, [passport]);

  if (!item)
    return (
      <section className="panel stage-sell cx" aria-label={t("tool.sell")}>
        <p className="cx-summary">{t("sell.intro")}</p>
        <div className="cx-block">
          <h2 className="cx-h">{t("sell.howTitle")}</h2>
          <ol className="cx-steps">
            {[1, 2, 3, 4].map((n) => (
              <li key={n}>
                <p className="cx-step-title">{t(`sell.how.${n}`)}</p>
              </li>
            ))}
          </ol>
        </div>
        <p className="cx-tip">{t("sell.empty")}</p>
        <div className="cx-actions">
          <button type="button" className="btn btn-red" onClick={() => openCollectorPage("collection")}>
            {t("sell.goCollection")}
          </button>
        </div>
      </section>
    );

  const date = (iso: string) => new Intl.DateTimeFormat(langTag(), { year: "numeric", month: "long" }).format(new Date(iso));
  const draft = listingDraft({ item, passport, fingerprint: fp, condition: report, ownNotes, included }, t, date);
  const images = SELL_SHOTS.map((s) => shots[s]).filter((x): x is PreparedImage => !!x);

  async function add(shot: SellShot, file: File | undefined) {
    if (!file) return;
    const img = await prepareImage(file, 1568);
    setShots((x) => ({ ...x, [shot]: img }));
  }

  async function describe() {
    const out = await ai.run((key, model) => describeCondition(key, model, images, `${item!.name}${item!.serial ? ` No. ${item!.serial}` : ""}`));
    if (out) {
      setReport(out.report);
      setCost(out.cost.usd);
    }
  }

  return (
    <section className="panel stage-sell cx" aria-label={t("tool.sell")}>
      <p className="cx-summary">{t("sell.intro")}</p>
      <ol className="cx-flow">
        <li>
          <h2 className="cx-h">{t("sell.which")}</h2>
          <select value={itemId} onChange={(e) => (setItemId(e.target.value), setReport(null), setShots({}))} aria-label={t("sell.which")}>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.serial ? ` · No. ${i.serial}` : ""}
              </option>
            ))}
          </select>
          {!passport && <p className="cx-tip">{t("sell.noPassport")}</p>}
        </li>
        <li>
          <h2 className="cx-h">{t("sell.photos")}</h2>
          <p className="cx-quiet">{t("sell.photosHint")}</p>
          <div className="sell-grid">
            {SELL_SHOTS.map((s) => (
              <label key={s} className={`sell-shot${shots[s] ? " sell-done" : ""}`}>
                {shots[s] ? <img src={shots[s]!.dataUrl} alt="" /> : <span className="sell-empty" aria-hidden="true">+</span>}
                <span className="sell-label">{t(`sell.shot.${s}`)}</span>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => add(s, e.target.files?.[0])} />
              </label>
            ))}
          </div>
        </li>
        <li>
          <h2 className="cx-h">{t("sell.condition")}</h2>
          <label className="field">
            <span>{t("sell.yourNotes")}</span>
            <textarea rows={3} value={ownNotes} placeholder={t("sell.yourNotesHint")} onChange={(e) => setOwnNotes(e.target.value)} />
          </label>
          {!settings.key ? (
            <AiGate what={t("sell.gate")} />
          ) : (
            <>
              <div className="cx-actions">
                <button type="button" className="btn" disabled={images.length === 0 || ai.busy} onClick={describe}>
                  {ai.busy ? t("fb.busy") : t("sell.describe")}
                </button>
              </div>
              {images.length === 0 && <p className="cx-quiet">{t("col.id.needPhoto")}</p>}
              <RunCostLine est={ai.est} actual={cost} error={ai.error} />
            </>
          )}
          <label className="field">
            <span>{t("sell.included")}</span>
            <input type="text" value={included} placeholder={t("sell.includedHint")} onChange={(e) => setIncluded(e.target.value)} />
          </label>
        </li>
        <li>
          <h2 className="cx-h">{t("sell.draft")}</h2>
          <p className="cx-plate-what">{draft.title}</p>
          <pre className="sell-draft">{draft.body}</pre>
          <div className="cx-actions">
            <button
              type="button"
              className="btn btn-red"
              onClick={() =>
                navigator.clipboard?.writeText(`${draft.title}\n\n${draft.body}`).then(
                  () => setCopied(true),
                  () => setCopied(false)
                )
              }
            >
              {copied ? t("common.copied") : t("sell.copy")}
            </button>
            {passport && (
              <a className="btn" href="#/collect/passport">
                {t("sell.passportCard")}
              </a>
            )}
            <a className="btn" href="#/collect/listing">
              {t("sell.checkPrice")}
            </a>
          </div>
          <p className="cx-quiet">{t("sell.honest")}</p>
        </li>
      </ol>
    </section>
  );
}
