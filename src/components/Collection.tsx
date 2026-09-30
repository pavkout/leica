import { useEffect, useState } from "react";
import { BODIES, LENSES } from "../data/gear";
import { getCollection, saveCollection, useCollection } from "../state/collectionStorage";
import { collectionCsv, latestValuation, monthsSinceService, newItem, sorted, upsert, type CollectionItem, type ItemKind, type Valuation } from "../state/collection";
import { openCollectorPage, takeDraft, usePendingDraft } from "../state/collectorStore";
import { formatMoney } from "../state/market";
import { lookupSerialFacts } from "../state/serialFacts";
import ItemEditor from "./collector/ItemEditor";
import ValueAll from "./collector/ValueAll";
import BodyArt from "./gear/BodyArt";
import GearImage from "./gear/GearImage";
import LensArt from "./gear/LensArt";
import { langTag, t, tn } from "../i18n";


function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function counted(items: CollectionItem[]): string {
  const n = (k: ItemKind) => items.filter((i) => i.kind === k).length;
  const parts = (["body", "lens", "accessory"] as ItemKind[]).filter((k) => n(k)).map((k) => tn(`col.count.${k}`, n(k)));
  if (parts.length < 2) return parts[0] ?? "";
  try {
    // Intl.ListFormat is ES2021 (iOS 14.5+); the compile target is ES2020.
    const LF = (Intl as unknown as { ListFormat: new (l: string, o: { type: string }) => { format: (p: string[]) => string } }).ListFormat;
    return new LF(langTag(), { type: "conjunction" }).format(parts);
  } catch {
    return parts.join(", ");
  }
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
  const items = useCollection();
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
    if (!saveCollection(next)) setStatus(t("col.storageFull"));
  }

  function start(kind: ItemKind) {
    setChoosing(false);
    setStatus(null);
    setEditing(newItem(kind, ""));
  }

  /** Values cost money, so a saved item keeps a new one straight away. */
  function addValuation(id: string, v: Valuation) {
    const list = getCollection();
    const target = list.find((i) => i.id === id);
    if (target && !saveCollection(upsert(list, { ...target, valuations: [v, ...(target.valuations ?? [])] })))
      setStatus(t("col.storageFullValue"));
    setEditing((x) => (x && x.id === id ? { ...x, valuations: [v, ...(x.valuations ?? [])] } : x));
  }

  function commit() {
    if (!editing || !editing.name.trim()) return;
    const found = editing.kind !== "accessory" && editing.serial ? lookupSerialFacts(editing.kind, editing.serial) : null;
    const serialFacts = found?.status === "found" ? found.facts : undefined;
    const isNew = !items.some((i) => i.id === editing.id);
    save(upsert(items, { ...editing, name: editing.name.trim(), serialFacts }));
    setStatus(isNew ? t("col.saved", { name: editing.name.trim() }) : t("passport.changed"));
    setEditing(null);
  }

  const today = new Date();
  const list = sorted(items);

  if (editing) {
    const isNew = !items.some((i) => i.id === editing.id);
    return (
      <section className="panel stage-collection cx" aria-label={t("tool.collection")}>
        <ItemEditor
          item={editing}
          isNew={isNew}
          onChange={setEditing}
          onSave={commit}
          onCancel={() => setEditing(null)}
          onRemove={() => {
            save(items.filter((i) => i.id !== editing.id));
            setStatus(t("col.removed", { name: editing.name }));
            setEditing(null);
          }}
          onValued={(v) => (isNew ? setEditing((x) => (x ? { ...x, valuations: [v, ...(x.valuations ?? [])] } : x)) : addValuation(editing.id, v))}
        />
      </section>
    );
  }

  return (
    <section className="panel stage-collection cx" aria-label={t("tool.collection")}>
      {status && (
        <p className="cx-ok" role="status">
          {status}
        </p>
      )}

      <p className="cx-summary">{items.length ? t("col.youHave", { list: counted(items) }) : t("col.empty")}</p>

      <div className="cx-add">
        <h2 className="cx-h">{t("col.addTitle")}</h2>
        <div className="cx-ways">
          <button type="button" className="cx-way cx-way-main" onClick={() => openCollectorPage("identify")}>
            <span className="cx-way-title">{t("col.way.photo")}</span>
            <span className="cx-way-text">{t("col.way.photo.text")}</span>
          </button>
          <button type="button" className="cx-way" aria-expanded={choosing} onClick={() => setChoosing((c) => !c)}>
            <span className="cx-way-title">{t("col.way.type")}</span>
            <span className="cx-way-text">{t("col.way.type.text")}</span>
          </button>
        </div>
        {choosing && (
          <div className="cx-choose">
            <p>{t("col.whatIsIt")}</p>
            <div className="cx-actions">
              <button type="button" className="btn btn-red" onClick={() => start("body")}>
                {t("col.kind.a.body")}
              </button>
              <button type="button" className="btn" onClick={() => start("lens")}>
                {t("col.kind.a.lens")}
              </button>
              <button type="button" className="btn" onClick={() => start("accessory")}>
                {t("col.kind.a.accessory")}
              </button>
            </div>
          </div>
        )}
      </div>

      {list.length > 0 && (
        <>
          <h2 className="cx-h">{t("col.items")}</h2>
          <p className="cx-quiet">{t("col.items.hint")}</p>
          <ul className="co-list">
            {list.map((i) => {
              const months = i.kind === "body" ? monthsSinceService(i, today) : null;
              const lv = latestValuation(i, today);
              return (
                <li key={i.id}>
                  <button type="button" className="co-item" onClick={() => setEditing(i)} aria-label={t("col.open", { name: i.name })}>
                    <Picture item={i} />
                    <span className="co-body">
                      <span className="co-kind">{t(`col.kind.${i.kind}`)}</span>
                      <span className="co-name">{i.name}</span>
                      <span className="co-facts">
                        {i.serial && <span>No. {i.serial}</span>}
                        {i.serialFacts && <span className="co-listed">{t("col.made", { year: i.serialFacts.year.replace("/", t("col.or")) })}</span>}
                      </span>
                      {lv?.v.range && (
                        <span className="co-listed">
                          {t(lv.stale ? "col.worthOld" : "col.worth", { low: formatMoney(lv.v.range.low, lv.v.range.currency), high: formatMoney(lv.v.range.high, lv.v.range.currency) })}
                        </span>
                      )}
                      {months !== null && months >= 36 && <span className="co-service">{t("col.serviceOld", { n: Math.floor(months / 12) })}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="cx-keep">
            <h2 className="cx-h">{t("col.keep")}</h2>
            <p className="cx-quiet">{t("col.keep.hint")}</p>
            <div className="cx-actions">
              <button type="button" className="btn" onClick={() => window.print()}>
                {t("col.print")}
              </button>
              <button type="button" className="btn" onClick={() => download("my-collection.csv", collectionCsv(items))}>
                {t("col.csv")}
              </button>
              <ValueAll items={items} onValued={addValuation} />
            </div>
          </div>
        </>
      )}

      {/* The printed record: everything, black on white, as a table. */}
      <div className="co-print" aria-hidden="true">
        <h2>{t("col.record")}</h2>
        <p>{t("col.printed", { date: today.toISOString().slice(0, 10) })}</p>
        <table>
          <thead>
            <tr>
              <th>{t("col.th.item")}</th>
              <th>{t("col.th.serial")}</th>
              <th>{t("col.th.acquired")}</th>
              <th>{t("col.th.paid")}</th>
              <th>{t("col.th.serviced")}</th>
              <th>{t("col.th.value")}</th>
              <th>{t("common.notes")}</th>
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
                <td>{i.valuations?.[0]?.range ? `${formatMoney(i.valuations[0].range.low, i.valuations[0].range.currency)}–${formatMoney(i.valuations[0].range.high, i.valuations[0].range.currency)} (${i.valuations[0].at.slice(0, 10)}, ${tn("col.sources", i.valuations[0].comparables.length)})` : ""}</td>
                <td>{i.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cx-quiet cx-footnote">{t("col.privacy")}</p>
    </section>
  );
}
