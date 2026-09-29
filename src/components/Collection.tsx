import { useState } from "react";
import { BODIES, LENSES } from "../data/gear";
import { getString, setString } from "../services/persistence";
import { collectionCsv, latestValuation, monthsSinceService, newItem, sorted, upsert, type CollectionItem, type ItemKind, type Valuation } from "../state/collection";
import { formatMoney } from "../state/market";
import { loadAiSettings, type AiSettings } from "../services/ai/aiSettings";
import { lookupSerialFacts } from "../state/serialFacts";
import { scanThumbnail } from "../state/shotLogStore";
import SerialFactsCard from "./collector/SerialFactsCard";
import AiSettingsPanel from "./collector/AiSettingsPanel";
import ListingCheck from "./collector/ListingCheck";
import PhotoIdentify from "./collector/PhotoIdentify";
import ValuationPanel from "./collector/ValuationPanel";
import ValueAll from "./collector/ValueAll";
import BodyArt from "./gear/BodyArt";
import GearImage from "./gear/GearImage";
import LensArt from "./gear/LensArt";

const KEY = "rangefinder-collection";

function load(): CollectionItem[] {
  try {
    const list = JSON.parse(getString(KEY) ?? "[]") as CollectionItem[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const KIND_LABEL: Record<ItemKind, string> = { body: "Camera", lens: "Lens", accessory: "Accessory" };

/** The owner's photo, or the catalogue drawing, or a quiet blank. */
function Picture({ item }: { item: CollectionItem }) {
  if (item.photo) return <img src={item.photo} alt="" className="co-pic" />;
  const body = item.kind === "body" && BODIES.find((b) => b.id === item.catalogueId);
  const lens = item.kind === "lens" && LENSES.find((l) => l.id === item.catalogueId);
  if (body)
    return (
      <GearImage kind="bodies" id={body.id} alt="" className="co-pic">
        <BodyArt body={body} />
      </GearImage>
    );
  if (lens)
    return (
      <GearImage kind="lenses" id={lens.id} alt="" className="co-pic">
        <LensArt lens={lens} />
      </GearImage>
    );
  return <span className="co-pic co-pic-blank" aria-hidden="true" />;
}

/**
 * My collection: every camera and lens you own, with serials, dates, filters
 * and service, your own photo of each, a service reminder, and a printable
 * record for insurance. Stored on this device only.
 */
export default function Collection() {
  const [items, setItems] = useState<CollectionItem[]>(load);
  const [editing, setEditing] = useState<CollectionItem | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ai, setAi] = useState<AiSettings>(loadAiSettings);
  const [tool, setTool] = useState<"ai" | "photo" | "listing" | null>(null);

  function save(next: CollectionItem[]) {
    setItems(next);
    if (!setString(KEY, JSON.stringify(next))) setStatus("This device's storage is full: changes are kept for this visit only. Export the CSV to keep them.");
  }

  function start(kind: ItemKind) {
    setEditing(newItem(kind, ""));
  }

  /** A draft from a photo or a listing: opens in the editor; saved only when the owner saves. */
  function openDraft(item: CollectionItem) {
    setTool(null);
    setEditing(item);
  }

  /** Valuations cost money, so a saved item keeps its new value at once. */
  function addValuation(id: string, v: Valuation) {
    setItems((list) => {
      const target = list.find((i) => i.id === id);
      if (!target) return list;
      const next = upsert(list, { ...target, valuations: [v, ...(target.valuations ?? [])] });
      if (!setString(KEY, JSON.stringify(next))) setStatus("This device's storage is full: the value is kept for this visit only.");
      return next;
    });
    setEditing((x) => (x && x.id === id ? { ...x, valuations: [v, ...(x.valuations ?? [])] } : x));
  }

  function commit() {
    if (!editing || !editing.name.trim()) return;
    const found = editing.kind !== "accessory" && editing.serial ? lookupSerialFacts(editing.kind, editing.serial) : null;
    const serialFacts = found?.status === "found" ? found.facts : undefined;
    save(upsert(items, { ...editing, name: editing.name.trim(), serialFacts }));
    setEditing(null);
  }

  const today = new Date();
  const list = sorted(items);
  const field = <K extends keyof CollectionItem>(k: K, label: string, placeholder = "", type = "text") => (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={(editing?.[k] as string | undefined) ?? ""} placeholder={placeholder} onChange={(e) => setEditing((x) => (x ? { ...x, [k]: e.target.value || undefined } : x))} />
    </label>
  );

  return (
    <section className="panel stage-collection" aria-label="My collection">
      <div className="co-actions">
        <button type="button" className="btn btn-red" onClick={() => start("body")}>
          Add a camera
        </button>
        <button type="button" className="btn" onClick={() => start("lens")}>
          Add a lens
        </button>
        <button type="button" className="btn" onClick={() => start("accessory")}>
          Add an accessory
        </button>
        <button type="button" className="btn" onClick={() => setTool(tool === "photo" ? null : "photo")} aria-pressed={tool === "photo"}>
          From photos
        </button>
        <button type="button" className="btn" onClick={() => setTool(tool === "listing" ? null : "listing")} aria-pressed={tool === "listing"}>
          Check a listing
        </button>
        <button type="button" className="btn btn-small" onClick={() => setTool(tool === "ai" ? null : "ai")} aria-pressed={tool === "ai"}>
          AI &amp; pricing
        </button>
        {items.length > 0 && (
          <>
            <ValueAll items={items} settings={ai} onValued={addValuation} onSettings={() => setTool("ai")} />
            <button type="button" className="btn btn-small" onClick={() => window.print()}>
              Print the record
            </button>
            <button type="button" className="btn btn-small" onClick={() => download("my-collection.csv", collectionCsv(items))}>
              Export CSV
            </button>
          </>
        )}
      </div>
      {status && (
        <p className="sl-status" role="status">
          {status}
        </p>
      )}

      {tool === "ai" && <AiSettingsPanel settings={ai} onChange={setAi} onClose={() => setTool(null)} />}
      {tool === "photo" && <PhotoIdentify settings={ai} onDraft={openDraft} onSettings={() => setTool("ai")} onClose={() => setTool(null)} />}
      {tool === "listing" && <ListingCheck settings={ai} onDraft={openDraft} onSettings={() => setTool("ai")} onClose={() => setTool(null)} />}

      {editing && (
        <div className="co-edit" role="group" aria-label={`${KIND_LABEL[editing.kind]} details`}>
          <h3>{items.some((i) => i.id === editing.id) ? `Edit ${editing.name}` : `New ${KIND_LABEL[editing.kind].toLowerCase()}`}</h3>
          <div className="co-grid">
            {editing.kind !== "accessory" && (
              <label className="field">
                <span>Model</span>
                <select
                  value={editing.catalogueId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || undefined;
                    const known = (editing.kind === "body" ? BODIES : LENSES).find((x) => x.id === id);
                    setEditing({ ...editing, catalogueId: id, name: editing.name || known?.name || "" });
                  }}
                >
                  <option value="">Not in the list</option>
                  {(editing.kind === "body" ? BODIES : LENSES).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {field("name", "Name", editing.kind === "accessory" ? "e.g. Visoflex 2, a half case" : "As you call it")}
            {field("serial", "Serial number", "As engraved")}
            {field("acquired", "Acquired", "", "date")}
            {field("price", "Paid", "Optional")}
            {editing.kind === "lens" && field("filter", "Filter thread", "e.g. E39")}
            {editing.kind === "body" && field("serviced", "Last serviced or rangefinder adjusted", "", "date")}
          </div>
          {editing.kind !== "accessory" && editing.serial && (
            <SerialFactsCard
              kind={editing.kind}
              serial={editing.serial}
              claim={{ model: editing.kind === "body" ? (BODIES.find((b) => b.id === editing.catalogueId)?.name ?? null) : null }}
              ai={editing.aiFindings}
              onUseName={(name, bodyId) => setEditing((x) => (x ? { ...x, name, catalogueId: bodyId ?? x.catalogueId } : x))}
            />
          )}
          {editing.aiFindings && (
            <div className="cl-card cl-ai">
              <p className="cl-label">Read by AI from your photo · {editing.aiFindings.at.slice(0, 10)}</p>
              <p>
                {[editing.aiFindings.maker, editing.aiFindings.model].filter(Boolean).join(" ") || "Not identified"}{" "}
                <span className="cl-tag">{editing.aiFindings.confidence.model} confidence</span>
              </p>
              {editing.aiFindings.serial && (
                <p>
                  Serial read: {editing.aiFindings.serial} <span className="cl-tag">{editing.aiFindings.serialLegible === "partial" ? "partly legible" : `${editing.aiFindings.confidence.serial} confidence`}</span>
                </p>
              )}
              {editing.aiFindings.finish && <p className="small">Finish: {editing.aiFindings.finish}</p>}
              {editing.aiFindings.engravings && editing.aiFindings.engravings.length > 0 && <p className="small">Engravings: {editing.aiFindings.engravings.join(" · ")}</p>}
              {editing.aiFindings.condition && <p className="small">Visible condition: {editing.aiFindings.condition}</p>}
            </div>
          )}
          {field("notes", "Notes", "Where it came from, its quirks, its story")}
          <ValuationPanel item={editing} settings={ai} onValued={(v) => (items.some((i) => i.id === editing.id) ? addValuation(editing.id, v) : setEditing((x) => (x ? { ...x, valuations: [v, ...(x.valuations ?? [])] } : x)))} onSettings={() => setTool("ai")} />
          <div className="co-edit-actions">
            <label className="btn btn-small sl-upload">
              {editing.photo ? "Change the photo" : "Add a photo"}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const photo = await scanThumbnail(f, 480);
                    setEditing((x) => (x ? { ...x, photo } : x));
                  } catch (err) {
                    setStatus(err instanceof Error ? err.message : String(err));
                  }
                }}
              />
            </label>
            <button type="button" className="btn btn-red btn-small" disabled={!editing.name.trim()} onClick={commit}>
              Save
            </button>
            <button type="button" className="btn btn-small" onClick={() => setEditing(null)}>
              Cancel
            </button>
            {items.some((i) => i.id === editing.id) && (
              <button
                type="button"
                className="btn btn-small co-remove"
                onClick={() => {
                  save(items.filter((i) => i.id !== editing.id));
                  setEditing(null);
                }}
              >
                Remove from the collection
              </button>
            )}
          </div>
        </div>
      )}

      {list.length === 0 && !editing ? (
        <p className="muted co-empty">Your collection is empty. Add the cameras and lenses you own: serials, dates and service in one place, printable for insurance.</p>
      ) : (
        <ul className="co-list">
          {list.map((i) => {
            const months = i.kind === "body" ? monthsSinceService(i, today) : null;
            return (
              <li key={i.id}>
                <button type="button" className="co-item" onClick={() => setEditing(i)} aria-label={`Edit ${i.name}`}>
                  <Picture item={i} />
                  <span className="co-body">
                    <span className="co-kind">{KIND_LABEL[i.kind]}</span>
                    <span className="co-name">{i.name}</span>
                    <span className="co-facts">
                      {i.serial && <span>No. {i.serial}</span>}
                      {i.serialFacts && <span className="co-listed">{[i.serialFacts.model, i.serialFacts.year].filter(Boolean).join(" · ")}</span>}
                      {i.acquired && <span>Since {i.acquired}</span>}
                      {i.filter && <span>{i.filter}</span>}
                    </span>
                    {(() => {
                      const lv = latestValuation(i, today);
                      return lv?.v.range ? (
                        <span className="co-listed">
                          Market {formatMoney(lv.v.range.low, lv.v.range.currency)}–{formatMoney(lv.v.range.high, lv.v.range.currency)} ({lv.v.at.slice(0, 7)}
                          {lv.stale ? ", old" : ""})
                        </span>
                      ) : null;
                    })()}
                    {months !== null && months >= 36 && <span className="co-service">Last serviced {Math.floor(months / 12)} years ago: worth a check</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* The printed record: everything, black on white, as a table. */}
      <div className="co-print" aria-hidden="true">
        <h2>Camera collection record</h2>
        <p>Printed {today.toISOString().slice(0, 10)}</p>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Serial</th>
              <th>Acquired</th>
              <th>Paid</th>
              <th>Serviced</th>
              <th>Market value</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.photo && <img src={i.photo} alt="" />}
                  {i.name}
                </td>
                <td>{i.serial}</td>
                <td>{i.acquired}</td>
                <td>{i.price}</td>
                <td>{i.serviced}</td>
                <td>{i.valuations?.[0]?.range ? `${formatMoney(i.valuations[0].range.low, i.valuations[0].range.currency)}–${formatMoney(i.valuations[0].range.high, i.valuations[0].range.currency)} (${i.valuations[0].at.slice(0, 10)}, ${i.valuations[0].comparables.length} sources)` : ""}</td>
                <td>{i.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Everything here is your own record, kept on this device only. Export the CSV or print it to keep a copy elsewhere. The AI tools send only what you give them (photos, a link, an item's details) to Anthropic, with your own key.</p>
    </section>
  );
}
