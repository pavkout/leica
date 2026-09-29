import { useEffect, useState } from "react";
import { BODIES, LENSES } from "../data/gear";
import { getString, setString } from "../services/persistence";
import { collectionCsv, latestValuation, monthsSinceService, newItem, sorted, upsert, type CollectionItem, type ItemKind, type Valuation } from "../state/collection";
import { openCollectorPage, takeDraft, usePendingDraft } from "../state/collectorStore";
import { formatMoney } from "../state/market";
import { lookupSerialFacts } from "../state/serialFacts";
import ItemEditor from "./collector/ItemEditor";
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

function counted(items: CollectionItem[]): string {
  const n = (k: ItemKind) => items.filter((i) => i.kind === k).length;
  const part = (k: ItemKind, one: string, many: string) => (n(k) ? `${n(k)} ${n(k) === 1 ? one : many}` : null);
  const parts = [part("body", "camera", "cameras"), part("lens", "lens", "lenses"), part("accessory", "accessory", "accessories")].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] ?? "";
}

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
 * My collection: everything you own, in one place. Two ways in (photograph
 * it, or type it in), one item edited at a time, and a printable record for
 * insurance. Stored on this device only.
 */
export default function Collection() {
  const [items, setItems] = useState<CollectionItem[]>(load);
  const [editing, setEditing] = useState<CollectionItem | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const pending = usePendingDraft();

  // A draft sent from "What is this?" or "Before you buy" opens here, ready to check and save.
  useEffect(() => {
    if (!pending) return;
    const d = takeDraft();
    if (d) setEditing(d);
  }, [pending]);

  function save(next: CollectionItem[]) {
    setItems(next);
    if (!setString(KEY, JSON.stringify(next))) setStatus("This device's storage is full, so changes last only until you close the page. Download the spreadsheet to keep them.");
  }

  function start(kind: ItemKind) {
    setChoosing(false);
    setStatus(null);
    setEditing(newItem(kind, ""));
  }

  /** Values cost money, so a saved item keeps a new one straight away. */
  function addValuation(id: string, v: Valuation) {
    setItems((list) => {
      const target = list.find((i) => i.id === id);
      if (!target) return list;
      const next = upsert(list, { ...target, valuations: [v, ...(target.valuations ?? [])] });
      if (!setString(KEY, JSON.stringify(next))) setStatus("This device's storage is full, so the value lasts only until you close the page.");
      return next;
    });
    setEditing((x) => (x && x.id === id ? { ...x, valuations: [v, ...(x.valuations ?? [])] } : x));
  }

  function commit() {
    if (!editing || !editing.name.trim()) return;
    const found = editing.kind !== "accessory" && editing.serial ? lookupSerialFacts(editing.kind, editing.serial) : null;
    const serialFacts = found?.status === "found" ? found.facts : undefined;
    const isNew = !items.some((i) => i.id === editing.id);
    save(upsert(items, { ...editing, name: editing.name.trim(), serialFacts }));
    setStatus(isNew ? `Saved: ${editing.name.trim()} is in your collection.` : "Changes saved.");
    setEditing(null);
  }

  const today = new Date();
  const list = sorted(items);

  if (editing) {
    const isNew = !items.some((i) => i.id === editing.id);
    return (
      <section className="panel stage-collection cx" aria-label="My collection">
        <ItemEditor
          item={editing}
          isNew={isNew}
          onChange={setEditing}
          onSave={commit}
          onCancel={() => setEditing(null)}
          onRemove={() => {
            save(items.filter((i) => i.id !== editing.id));
            setStatus(`Removed ${editing.name}.`);
            setEditing(null);
          }}
          onValued={(v) => (isNew ? setEditing((x) => (x ? { ...x, valuations: [v, ...(x.valuations ?? [])] } : x)) : addValuation(editing.id, v))}
        />
      </section>
    );
  }

  return (
    <section className="panel stage-collection cx" aria-label="My collection">
      {status && (
        <p className="cx-ok" role="status">
          {status}
        </p>
      )}

      <p className="cx-summary">{items.length ? `You have ${counted(items)}.` : "Nothing here yet. Add the first thing you own: it takes a minute."}</p>

      <div className="cx-add">
        <h2 className="cx-h">Add something</h2>
        <div className="cx-ways">
          <button type="button" className="cx-way cx-way-main" onClick={() => openCollectorPage("identify")}>
            <span className="cx-way-title">Take a photo</span>
            <span className="cx-way-text">We'll recognise it and read the serial number for you.</span>
          </button>
          <button type="button" className="cx-way" aria-expanded={choosing} onClick={() => setChoosing((c) => !c)}>
            <span className="cx-way-title">Type it in</span>
            <span className="cx-way-text">Fill in the details yourself. Works without the AI helper.</span>
          </button>
        </div>
        {choosing && (
          <div className="cx-choose">
            <p>What is it?</p>
            <div className="cx-actions">
              <button type="button" className="btn btn-red" onClick={() => start("body")}>
                A camera
              </button>
              <button type="button" className="btn" onClick={() => start("lens")}>
                A lens
              </button>
              <button type="button" className="btn" onClick={() => start("accessory")}>
                An accessory
              </button>
            </div>
          </div>
        )}
      </div>

      {list.length > 0 && (
        <>
          <h2 className="cx-h">Your items</h2>
          <p className="cx-quiet">Tap an item to see it, change it or find its value.</p>
          <ul className="co-list">
            {list.map((i) => {
              const months = i.kind === "body" ? monthsSinceService(i, today) : null;
              const lv = latestValuation(i, today);
              return (
                <li key={i.id}>
                  <button type="button" className="co-item" onClick={() => setEditing(i)} aria-label={`Open ${i.name}`}>
                    <Picture item={i} />
                    <span className="co-body">
                      <span className="co-kind">{KIND_LABEL[i.kind]}</span>
                      <span className="co-name">{i.name}</span>
                      <span className="co-facts">
                        {i.serial && <span>No. {i.serial}</span>}
                        {i.serialFacts && <span className="co-listed">Made {i.serialFacts.year.replace("/", " or ")}</span>}
                      </span>
                      {lv?.v.range && (
                        <span className="co-listed">
                          Worth about {formatMoney(lv.v.range.low, lv.v.range.currency)} to {formatMoney(lv.v.range.high, lv.v.range.currency)}
                          {lv.stale && " (checked over a year ago)"}
                        </span>
                      )}
                      {months !== null && months >= 36 && <span className="co-service">Last serviced {Math.floor(months / 12)} years ago. Worth a check.</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="cx-keep">
            <h2 className="cx-h">Keep a copy</h2>
            <p className="cx-quiet">For insurance, or in case this device is lost.</p>
            <div className="cx-actions">
              <button type="button" className="btn" onClick={() => window.print()}>
                Print the list
              </button>
              <button type="button" className="btn" onClick={() => download("my-collection.csv", collectionCsv(items))}>
                Download as a spreadsheet
              </button>
              <ValueAll items={items} onValued={addValuation} />
            </div>
          </div>
        </>
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
      <p className="cx-quiet cx-footnote">Your collection is saved on this device only. The AI helper sends only what you ask it to check, straight to Anthropic.</p>
    </section>
  );
}
