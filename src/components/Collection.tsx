import { useState } from "react";
import { BODIES, LENSES } from "../data/gear";
import { getString, setString } from "../services/persistence";
import { collectionCsv, monthsSinceService, newItem, sorted, upsert, type CollectionItem, type ItemKind } from "../state/collection";
import { scanThumbnail } from "../state/shotLogStore";
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

  function save(next: CollectionItem[]) {
    setItems(next);
    if (!setString(KEY, JSON.stringify(next))) setStatus("This device's storage is full: changes are kept for this visit only. Export the CSV to keep them.");
  }

  function start(kind: ItemKind) {
    setEditing(newItem(kind, ""));
  }

  function commit() {
    if (!editing || !editing.name.trim()) return;
    save(upsert(items, { ...editing, name: editing.name.trim() }));
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
        {items.length > 0 && (
          <>
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
          {field("notes", "Notes", "Where it came from, its quirks, its story")}
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
                      {i.acquired && <span>Since {i.acquired}</span>}
                      {i.filter && <span>{i.filter}</span>}
                    </span>
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
                <td>{i.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Everything here is your own record, kept on this device only. Export the CSV or print it to keep a copy elsewhere.</p>
    </section>
  );
}
