import { useEffect, useRef, useState } from "react";
import { BODIES, LENSES } from "../../data/gear";
import type { CollectionItem, ItemKind, Valuation } from "../../state/collection";
import { itemName } from "../../state/collectorDrafts";
import { scanThumbnail } from "../../state/shotLogStore";
import SerialFactsCard from "./SerialFactsCard";
import { sureness } from "./sureness";
import ValuationPanel from "./ValuationPanel";
import { t } from "../../i18n";


interface Props {
  item: CollectionItem;
  isNew: boolean;
  onChange: (item: CollectionItem) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onValued: (v: Valuation) => void;
}

/**
 * One item, one screen. The serial number comes first because it fills in
 * the rest; everything after the name is optional and says so.
 */
export default function ItemEditor({ item, isNew, onChange, onSave, onCancel, onRemove, onValued }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const set = <K extends keyof CollectionItem>(k: K, v: CollectionItem[K]) => onChange({ ...item, [k]: v });
  const catalogue = item.kind === "body" ? BODIES : item.kind === "lens" ? LENSES : [];
  const named = Boolean(item.name.trim());

  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "start" });
    ref.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [item.id]);

  const text = (k: "name" | "price" | "filter", label: string, placeholder: string) => (
    <label className="field">
      <span>{label}</span>
      <input type="text" value={item[k] ?? ""} placeholder={placeholder} onChange={(e) => set(k, e.target.value || undefined)} />
    </label>
  );
  const date = (k: "acquired" | "serviced", label: string) => (
    <label className="field">
      <span>{label}</span>
      <input type="date" value={item[k] ?? ""} onChange={(e) => set(k, e.target.value || undefined)} />
    </label>
  );

  return (
    <div className="cx-editor" ref={ref} role="group" aria-label={isNew ? t(`col.ed.add.${item.kind}`) : t("col.ed.editName", { name: item.name })}>
      <h2 className="cx-editor-title" tabIndex={-1}>
        {isNew ? t(`col.ed.add.${item.kind}`) : item.name}
      </h2>

      <fieldset className="cx-fieldset">
        <legend>{t("col.whatIsIt")}</legend>
        <div className="cx-actions" role="radiogroup" aria-label={t("col.ed.type")}>
          {(["body", "lens", "accessory"] as ItemKind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={item.kind === k} className={`cx-pick${item.kind === k ? " cx-pick-on" : ""}`} onClick={() => onChange({ ...item, kind: k, catalogueId: undefined })}>
              {t(`col.kind.a.${k}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {item.kind !== "accessory" && (
        <fieldset className="cx-fieldset">
          <legend>{t("col.ed.serial")}</legend>
          <label className="field cx-serial">
            <span>{t("col.ed.serialLabel")}</span>
            <input type="text" inputMode="numeric" autoComplete="off" value={item.serial ?? ""} placeholder={t("col.ed.serialHint")} onChange={(e) => set("serial", e.target.value || undefined)} />
          </label>
          <p className="cx-quiet">{t("col.ed.where", { where: t(`col.ed.where.${item.kind}`) })}</p>
          {item.serial && (
            <SerialFactsCard
              kind={item.kind}
              serial={item.serial}
              claim={{ model: item.kind === "body" ? (BODIES.find((b) => b.id === item.catalogueId)?.name ?? null) : null }}
              ai={item.aiFindings}
              onUseName={(name, bodyId) => onChange({ ...item, name, catalogueId: bodyId ?? item.catalogueId })}
            />
          )}
        </fieldset>
      )}

      <fieldset className="cx-fieldset">
        <legend>{t("col.ed.name")}</legend>
        {text("name", t("col.ed.nameLabel"), item.kind === "accessory" ? t("col.ed.nameHint.accessory") : t("col.ed.nameHint"))}
        {!named && <p className="cx-quiet">{t("col.ed.nameOnly")}</p>}
        {catalogue.length > 0 && (
          <label className="field">
            <span>{t("col.ed.pick")}</span>
            <select
              value={item.catalogueId ?? ""}
              onChange={(e) => {
                const id = e.target.value || undefined;
                const known = catalogue.find((x) => x.id === id);
                onChange({ ...item, catalogueId: id, name: item.name || known?.name || "" });
              }}
            >
              <option value="">{t("col.ed.notListed")}</option>
              {catalogue.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>

      {item.aiFindings && (
        <div className="cx-block cx-ai">
          <h3 className="cx-h">{t("col.ai.saw")}</h3>
          <dl className="cx-facts">
            <dt>{t("col.ai.looksLike")}</dt>
            <dd>
              {itemName(item.aiFindings.maker ?? null, item.aiFindings.model ?? null) || t("col.ai.couldntTell")} ({sureness(item.aiFindings.confidence.model).toLowerCase()})
            </dd>
            {item.aiFindings.serial && (
              <>
                <dt>{t("col.ai.serialRead")}</dt>
                <dd>
                  {item.aiFindings.serial} ({item.aiFindings.serialLegible === "partial" ? t("col.ai.partly") : sureness(item.aiFindings.confidence.serial).toLowerCase()})
                </dd>
              </>
            )}
            {item.aiFindings.finish && (
              <>
                <dt>{t("col.ai.finish")}</dt>
                <dd>{item.aiFindings.finish}</dd>
              </>
            )}
            {item.aiFindings.condition && (
              <>
                <dt>{t("col.ai.condition")}</dt>
                <dd>{item.aiFindings.condition}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      <fieldset className="cx-fieldset">
        <legend>{t("col.ed.records")}</legend>
        <div className="cx-grid">
          {date("acquired", t("col.ed.acquired"))}
          {text("price", t("col.ed.price"), t("col.ed.priceHint"))}
          {item.kind === "body" && date("serviced", t("col.ed.serviced"))}
          {item.kind === "lens" && text("filter", t("col.ed.filter"), t("col.ed.filterHint"))}
        </div>
        <label className="field">
          <span>{t("common.notes")}</span>
          <textarea value={item.notes ?? ""} placeholder={t("col.ed.notesHint")} onChange={(e) => set("notes", e.target.value || undefined)} />
        </label>
        <div className="cx-photo">
          {item.photo && <img src={item.photo} alt={t("col.ed.photoAlt")} />}
          <label className="btn cx-file">
            {item.photo ? t("col.ed.changePhoto") : t("col.ed.addPhoto")}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setPhotoError(null);
                try {
                  set("photo", await scanThumbnail(f, 480));
                } catch (err) {
                  setPhotoError(err instanceof Error ? err.message : String(err));
                }
              }}
            />
          </label>
          {photoError && <p className="cx-problem">{photoError}</p>}
        </div>
      </fieldset>

      <ValuationPanel item={item} onValued={onValued} />

      <div className="cx-savebar">
        <button type="button" className="btn btn-red" disabled={!named} onClick={onSave}>
          {isNew ? t("col.ed.saveNew") : t("col.ed.saveChanges")}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {isNew ? t("common.cancel") : t("common.back")}
        </button>
        {!named && <p className="cx-quiet">{t("col.ed.needName")}</p>}
      </div>

      {!isNew &&
        (confirmRemove ? (
          <div className="cx-progress" role="alertdialog" aria-label={t("col.ed.removeTitle")}>
            <p>{t("col.ed.removeQ", { name: item.name })}</p>
            <div className="cx-actions">
              <button type="button" className="btn btn-red" onClick={onRemove}>
                {t("col.ed.removeYes")}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmRemove(false)}>
                {t("col.ed.keep")}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="cx-link cx-remove" onClick={() => setConfirmRemove(true)}>
            {t("col.ed.remove")}
          </button>
        ))}
    </div>
  );
}
