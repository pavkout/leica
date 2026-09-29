import { useEffect, useRef, useState } from "react";
import { BODIES, LENSES } from "../../data/gear";
import type { CollectionItem, ItemKind, Valuation } from "../../state/collection";
import { itemName } from "../../state/collectorDrafts";
import { scanThumbnail } from "../../state/shotLogStore";
import SerialFactsCard from "./SerialFactsCard";
import { sureness } from "./sureness";
import ValuationPanel from "./ValuationPanel";

const KIND_WORD: Record<ItemKind, string> = { body: "camera", lens: "lens", accessory: "accessory" };

const WHERE_SERIAL: Record<ItemKind, string> = {
  body: "On the top of the camera, next to the shutter button (on some models, under the base plate or inside the film door).",
  lens: "On the front ring around the glass, or on the side of the lens barrel.",
  accessory: "Many accessories have none. Leave it empty if you can't find one.",
};

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
    <div className="cx-editor" ref={ref} role="group" aria-label={isNew ? `Add a ${KIND_WORD[item.kind]}` : `Edit ${item.name}`}>
      <h2 className="cx-editor-title" tabIndex={-1}>
        {isNew ? `Add a ${KIND_WORD[item.kind]}` : item.name}
      </h2>

      <fieldset className="cx-fieldset">
        <legend>What is it?</legend>
        <div className="cx-actions" role="radiogroup" aria-label="Type of item">
          {(["body", "lens", "accessory"] as ItemKind[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={item.kind === k} className={`cx-pick${item.kind === k ? " cx-pick-on" : ""}`} onClick={() => onChange({ ...item, kind: k, catalogueId: undefined })}>
              {k === "body" ? "A camera" : k === "lens" ? "A lens" : "An accessory"}
            </button>
          ))}
        </div>
      </fieldset>

      {item.kind !== "accessory" && (
        <fieldset className="cx-fieldset">
          <legend>Serial number</legend>
          <label className="field cx-serial">
            <span>The number engraved on it</span>
            <input type="text" inputMode="numeric" autoComplete="off" value={item.serial ?? ""} placeholder="For example 919251" onChange={(e) => set("serial", e.target.value || undefined)} />
          </label>
          <p className="cx-quiet">Where to find it: {WHERE_SERIAL[item.kind]}</p>
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
        <legend>Name</legend>
        {text("name", "What you call it", item.kind === "accessory" ? "For example: Visoflex II, leather half case" : "For example: My father's M3")}
        {!named && <p className="cx-quiet">A name is the only thing you must fill in.</p>}
        {catalogue.length > 0 && (
          <label className="field">
            <span>Pick the model from our list (optional)</span>
            <select
              value={item.catalogueId ?? ""}
              onChange={(e) => {
                const id = e.target.value || undefined;
                const known = catalogue.find((x) => x.id === id);
                onChange({ ...item, catalogueId: id, name: item.name || known?.name || "" });
              }}
            >
              <option value="">Not in the list, or not sure</option>
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
          <h3 className="cx-h">What the AI saw in your photo</h3>
          <dl className="cx-facts">
            <dt>It looks like</dt>
            <dd>
              {itemName(item.aiFindings.maker ?? null, item.aiFindings.model ?? null) || "Couldn't tell"} ({sureness(item.aiFindings.confidence.model).toLowerCase()})
            </dd>
            {item.aiFindings.serial && (
              <>
                <dt>Serial number read</dt>
                <dd>
                  {item.aiFindings.serial} ({item.aiFindings.serialLegible === "partial" ? "partly readable" : sureness(item.aiFindings.confidence.serial).toLowerCase()})
                </dd>
              </>
            )}
            {item.aiFindings.finish && (
              <>
                <dt>Finish</dt>
                <dd>{item.aiFindings.finish}</dd>
              </>
            )}
            {item.aiFindings.condition && (
              <>
                <dt>What it could see</dt>
                <dd>{item.aiFindings.condition}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      <fieldset className="cx-fieldset">
        <legend>Your records (all optional)</legend>
        <div className="cx-grid">
          {date("acquired", "When you got it")}
          {text("price", "What you paid", "For example: €1,800")}
          {item.kind === "body" && date("serviced", "Last serviced")}
          {item.kind === "lens" && text("filter", "Filter size", "For example: E39")}
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea value={item.notes ?? ""} placeholder="Where it came from, its story, anything to remember" onChange={(e) => set("notes", e.target.value || undefined)} />
        </label>
        <div className="cx-photo">
          {item.photo && <img src={item.photo} alt="Your photo of it" />}
          <label className="btn cx-file">
            {item.photo ? "Change the photo" : "Add a photo"}
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
          {isNew ? "Save to my collection" : "Save changes"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {isNew ? "Cancel" : "Back"}
        </button>
        {!named && <p className="cx-quiet">Type a name to save.</p>}
      </div>

      {!isNew &&
        (confirmRemove ? (
          <div className="cx-progress" role="alertdialog" aria-label="Remove this item">
            <p>Remove {item.name} from your collection? This can't be undone.</p>
            <div className="cx-actions">
              <button type="button" className="btn btn-red" onClick={onRemove}>
                Yes, remove it
              </button>
              <button type="button" className="btn" onClick={() => setConfirmRemove(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="cx-link cx-remove" onClick={() => setConfirmRemove(true)}>
            Remove from my collection
          </button>
        ))}
    </div>
  );
}
