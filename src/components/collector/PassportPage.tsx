import { useEffect, useRef, useState } from "react";
import { t, tn, langTag, useLang } from "../../i18n";
import { newItem, type CollectionItem } from "../../state/collection";
import { getCollection, saveCollection, useCollection } from "../../state/collectionStorage";
import { openCollectorPage } from "../../state/collectorStore";
import {
  EVENT_TYPES,
  addEvent,
  currentFingerprint,
  editable,
  fileName,
  newEventId,
  newPassport,
  owners,
  parsePassport,
  receive,
  replaceEvent,
  resubject,
  serialFlags,
  serialize,
  serviceStatus,
  timeline,
  verify,
  type EventType,
  type Passport,
  type PassportEvent,
  type Verification,
} from "../../state/passport";
import { putPassport, removePassport, usePassports } from "../../state/passportStore";
import { scanThumbnail } from "../../state/shotLogStore";
import { downloadBlob, drawPassportCard, shareOrDownload } from "./passportCard";

const todayIso = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return iso;
  try {
    return new Intl.DateTimeFormat(langTag(), { year: "numeric", month: "long", day: d ? "numeric" : undefined }).format(new Date(y, (m || 1) - 1, d || 1));
  } catch {
    return iso;
  }
}

/** The fingerprint of a passport, recomputed when it changes. */
function useFingerprint(p: Passport | undefined) {
  const [fp, setFp] = useState("");
  useEffect(() => {
    let live = true;
    if (p) currentFingerprint(p).then((f) => live && setFp(f));
    return () => {
      live = false;
    };
  }, [p]);
  return fp;
}

type Screen = { kind: "list" } | { kind: "item"; id: string } | { kind: "receive" };

/**
 * Leica Passport (#41): one page per camera or lens, with its whole life in
 * it. Start one from anything in My collection, add to it as things happen,
 * share its card, and hand it to the buyer when you sell.
 */
export default function PassportPage() {
  useLang();
  const items = useCollection();
  const passports = usePassports();
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [status, setStatus] = useState<string | null>(null);

  const item = screen.kind === "item" ? items.find((i) => i.id === screen.id) : undefined;
  useEffect(() => {
    if (screen.kind === "item" && !item) setScreen({ kind: "list" });
  }, [screen, item]);

  if (screen.kind === "receive")
    return (
      <section className="panel stage-passport cx" aria-label={t("tool.passport")}>
        <Receive
          onCancel={() => setScreen({ kind: "list" })}
          onReceived={(id, name) => {
            setStatus(t("passport.received.saved", { name }));
            setScreen({ kind: "item", id });
          }}
        />
      </section>
    );

  if (item)
    return (
      <section className="panel stage-passport cx" aria-label={t("tool.passport")}>
        {status && (
          <p className="cx-ok" role="status">
            {status}
          </p>
        )}
        <PassportView
          item={item}
          stored={passports.get(item.id)}
          onBack={() => {
            setStatus(null);
            setScreen({ kind: "list" });
          }}
          onHandedOver={(msg) => {
            setStatus(msg);
            setScreen({ kind: "list" });
          }}
        />
      </section>
    );

  const list = items.filter((i) => i.kind !== "accessory" || passports.has(i.id));
  return (
    <section className="panel stage-passport cx" aria-label={t("tool.passport")}>
      {status && (
        <p className="cx-ok" role="status">
          {status}
        </p>
      )}
      <p className="cx-summary">{t("passport.intro")}</p>

      <div className="cx-ways">
        <button type="button" className="cx-way" onClick={() => setScreen({ kind: "receive" })}>
          <span className="cx-way-title">{t("passport.receive.title")}</span>
          <span className="cx-way-text">{t("passport.receive.text")}</span>
        </button>
      </div>

      <h2 className="cx-h">{t("passport.yours")}</h2>
      {list.length === 0 ? (
        <div className="cx-tip">
          <p>{t("passport.empty")}</p>
          <div className="cx-actions">
            <button type="button" className="btn btn-red" onClick={() => openCollectorPage("collection")}>
              {t("passport.empty.add")}
            </button>
          </div>
        </div>
      ) : (
        <ul className="pp-list">
          {list.map((i) => {
            const p = passports.get(i.id);
            const svc = p ? serviceStatus(p, new Date()) : null;
            return (
              <li key={i.id}>
                <button type="button" className="pp-row" onClick={() => (setStatus(null), setScreen({ kind: "item", id: i.id }))}>
                  {i.photo ? <img src={i.photo} alt="" className="pp-thumb" /> : <span className="pp-thumb pp-thumb-blank" aria-hidden="true" />}
                  <span className="pp-row-body">
                    <span className="pp-row-name">{i.name}</span>
                    {i.serial && <span className="cx-mono pp-row-serial">No. {i.serial}</span>}
                    <span className="pp-row-state">
                      {p && p.entries.length ? tn("passport.entries", p.entries.length) : t("passport.start")}
                      {svc?.due && <span className="pp-due"> · {t("passport.service.due")}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="cx-quiet cx-footnote">{t("passport.privacy")}</p>
    </section>
  );
}

function PassportView({ item, stored, onBack, onHandedOver }: { item: CollectionItem; stored?: Passport; onBack: () => void; onHandedOver: (msg: string) => void }) {
  const [adding, setAdding] = useState<PassportEvent | null>(null);
  const [handing, setHanding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const passport = stored ?? newPassport(item);
  const fp = useFingerprint(passport);
  const events = timeline(passport).reverse();
  const flags = serialFlags(passport.subject);
  const svc = serviceStatus(passport, new Date());
  const ownerCount = owners(passport).length;
  const locked = passport.lockedThrough !== undefined;
  const indexOf = (id: string) => passport.entries.findIndex((e) => e.event.id === id);

  // The owner edited the item in My collection: bring the passport along.
  useEffect(() => {
    if (!stored) return;
    let live = true;
    resubject(stored, item).then((next) => live && next !== stored && putPassport(next));
    return () => {
      live = false;
    };
  }, [stored, item]);

  async function save(next: Passport) {
    if (!(await putPassport(next))) setNote(t("passport.storageFull"));
  }

  async function commit(ev: PassportEvent) {
    const exists = passport.entries.some((e) => e.event.id === ev.id);
    const base = stored ? await resubject(stored, item) : newPassport(item);
    await save(exists ? await replaceEvent(base, ev.id, ev) : await addEvent(base, ev));
    setAdding(null);
    setNote(exists ? t("passport.changed") : t("passport.added"));
  }

  function start(type: EventType) {
    setNote(null);
    setAdding({ id: newEventId(), type, date: todayIso(), title: "", recordedAt: new Date().toISOString() });
  }

  async function shareCard() {
    const made = passport.subject.serialFacts?.year;
    const lines = [
      made ? t("passport.card.made", { year: made }) : null,
      tn("passport.card.owners", Math.max(1, ownerCount)),
      svc.last ? t("passport.card.serviced", { date: formatDate(svc.last) }) : null,
      tn("passport.entries", passport.entries.length),
    ].filter(Boolean) as string[];
    const blob = await drawPassportCard(
      { label: t("passport.card.label"), name: passport.subject.name, serial: passport.subject.serial, lines, fingerprintLabel: t("passport.fingerprint"), fingerprint: fp, footer: t("passport.card.footer") },
      passport.subject.photo
    );
    if (!blob) return setNote(t("passport.card.failed"));
    const how = await shareOrDownload(blob, fileName(passport).replace(".passport.json", "-passport.png"), passport.subject.name);
    if (how === "downloaded") setNote(t("passport.card.downloaded"));
  }

  if (adding) return <EventEditor event={adding} onChange={setAdding} onSave={commit} onCancel={() => setAdding(null)} />;
  if (handing)
    return (
      <HandOver
        passport={passport}
        item={item}
        onCancel={() => setHanding(false)}
        onDone={(msg) => {
          setHanding(false);
          onHandedOver(msg);
        }}
      />
    );

  return (
    <div className="pp">
      <button type="button" className="cx-link" onClick={onBack}>
        ← {t("passport.back")}
      </button>

      {/* The certificate: what it is, where it came from, and its seal. */}
      <div className="cx-plate pp-cert">
        <p className="pp-cert-label">{t("passport.card.label")}</p>
        {passport.subject.photo && <img src={passport.subject.photo} alt="" className="pp-cert-photo" />}
        <p className="cx-plate-what">{passport.subject.name}</p>
        {passport.subject.serial && <p className="cx-plate-no">No. {passport.subject.serial}</p>}
        <p className="cx-source">
          {[passport.subject.serialFacts?.year && t("passport.card.made", { year: passport.subject.serialFacts.year }), tn("passport.card.owners", Math.max(1, ownerCount))]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="pp-fp">
          <span>{t("passport.fingerprint")}</span> <span className="cx-mono">{fp}</span>
        </p>
      </div>

      {note && (
        <p className="cx-ok" role="status">
          {note}
        </p>
      )}

      {/* What the published serial lists say. */}
      {flags.map((f) => (
        <p key={f.key} className={f.level === "warn" ? "cx-problem" : f.level === "ok" ? "cx-ok" : "cx-tip"}>
          {t(f.key, f.vars)}
        </p>
      ))}
      <details className="pp-more">
        <summary>{t("passport.authentic.title")}</summary>
        <ul>
          <li>{t("passport.authentic.1")}</li>
          <li>{t("passport.authentic.2")}</li>
          <li>{t("passport.authentic.3")}</li>
          <li>{t("passport.authentic.4")}</li>
        </ul>
      </details>

      <h2 className="cx-h">{t("passport.addTitle")}</h2>
      <div className="pp-add">
        {(["service", "repair", "condition", "acquired", "note"] as EventType[]).map((type, i) => (
          <button key={type} type="button" className={i === 0 ? "btn btn-red" : "btn"} onClick={() => start(type)}>
            {t(`passport.add.${type}`)}
          </button>
        ))}
        {item.kind === "body" && (
          <button type="button" className="btn" onClick={() => (location.hash = `#/collect/health?item=${encodeURIComponent(item.id)}`)}>
            {t("passport.add.health")}
          </button>
        )}
      </div>

      {/* Service reminder: only if the owner wants one. */}
      <div className="cx-block">
        <h3 className="pp-h3">{t("passport.remind.title")}</h3>
        <div className="cx-actions" role="group" aria-label={t("passport.remind.title")}>
          {[undefined, 2, 3, 5].map((y) => (
            <button
              key={y ?? 0}
              type="button"
              className={`cx-pick${passport.remindYears === y ? " cx-pick-on" : ""}`}
              aria-pressed={passport.remindYears === y}
              onClick={() => save({ ...(stored ?? newPassport(item)), remindYears: y })}
            >
              {y ? tn("passport.remind.years", y) : t("passport.remind.off")}
            </button>
          ))}
        </div>
        <p className="cx-quiet">
          {svc.last
            ? svc.due
              ? t("passport.service.overdue", { date: formatDate(svc.last) })
              : svc.dueDate
                ? t("passport.service.next", { date: formatDate(svc.dueDate) })
                : t("passport.service.last", { date: formatDate(svc.last) })
            : t("passport.service.never")}
        </p>
      </div>

      <h2 className="cx-h">{t("passport.history")}</h2>
      {events.length === 0 ? (
        <p className="cx-quiet">{t("passport.history.empty")}</p>
      ) : (
        <ol className="pp-timeline">
          {events.map((e) => {
            const can = editable(passport, indexOf(e.id));
            return (
              <li key={e.id} className={`pp-event pp-event-${e.type}`}>
                <p className="pp-event-date">{formatDate(e.date)}</p>
                <p className="pp-event-title">
                  <span className="pp-event-type">{t(`passport.type.${e.type}`)}</span> {e.title}
                </p>
                {(e.by || e.to || e.cost) && (
                  <p className="cx-quiet">{[e.by && t("passport.field.by.short", { by: e.by }), e.to && t("passport.field.to.short", { to: e.to }), e.cost].filter(Boolean).join(" · ")}</p>
                )}
                {e.detail && <p>{e.detail}</p>}
                {e.health && <HealthLine event={e} />}
                {e.photos?.length ? (
                  <div className="pp-photos">
                    {e.photos.map((src, i) => (
                      <img key={i} src={src} alt={t("passport.photoAlt", { n: i + 1 })} />
                    ))}
                  </div>
                ) : null}
                {can ? (
                  <button type="button" className="cx-link" onClick={() => setAdding(e)}>
                    {t("common.edit")}
                  </button>
                ) : (
                  <p className="pp-locked">{t("passport.fromPrevious")}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <h2 className="cx-h">{t("passport.shareTitle")}</h2>
      <div className="cx-actions">
        <button type="button" className="btn" onClick={shareCard} disabled={!fp}>
          {t("passport.shareCard")}
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          {t("passport.print")}
        </button>
        <button type="button" className="btn" onClick={() => setHanding(true)} disabled={!stored || stored.entries.length === 0} title={!stored?.entries.length ? t("passport.handover.needsEntry") : undefined}>
          {t("passport.handover")}
        </button>
      </div>
      {!stored?.entries.length && <p className="cx-quiet">{t("passport.handover.needsEntry")}</p>}
      {locked && <p className="cx-quiet">{t("passport.lockedNote")}</p>}

      {/* The printed passport: black on white. */}
      <div className="pp-print" aria-hidden="true">
        <h2>
          {t("passport.card.label")}: {passport.subject.name}
          {passport.subject.serial ? ` · No. ${passport.subject.serial}` : ""}
        </h2>
        <p>
          {t("passport.fingerprint")}: {fp} · {formatDate(todayIso())}
        </p>
        <table>
          <tbody>
            {timeline(passport).map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{t(`passport.type.${e.type}`)}</td>
                <td>
                  {e.title}
                  {e.by ? ` (${e.by})` : ""}
                  {e.to ? ` → ${e.to}` : ""}
                  {e.detail ? ` — ${e.detail}` : ""}
                </td>
                <td>{e.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{t("passport.card.footer")}</p>
      </div>
    </div>
  );
}

function HealthLine({ event }: { event: PassportEvent }) {
  const h = event.health!;
  const issues = Object.values(h.checks).filter((v) => v === "issue").length;
  return (
    <p className={h.verdict === "good" ? "cx-ok" : "cx-tip"}>
      {t(`health.verdict.${h.verdict}`)}
      {h.speeds.length > 0 && ` · ${tn("health.speedsTested", h.speeds.length)}`}
      {issues > 0 && ` · ${tn("health.issues", issues)}`}
    </p>
  );
}

function EventEditor({ event, onChange, onSave, onCancel }: { event: PassportEvent; onChange: (e: PassportEvent) => void; onSave: (e: PassportEvent) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const set = <K extends keyof PassportEvent>(k: K, v: PassportEvent[K]) => onChange({ ...event, [k]: v });
  const photos = event.photos ?? [];
  const title = event.title.trim() || t(`passport.defaultTitle.${event.type}`);

  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "start" });
    ref.current?.querySelector<HTMLElement>("h2")?.focus();
  }, []);

  async function addPhotos(files: FileList | null) {
    setPhotoError(null);
    const room = 4 - photos.length;
    const picked = [...(files ?? [])].slice(0, room);
    try {
      const shots = await Promise.all(picked.map((f) => scanThumbnail(f, 720)));
      set("photos", [...photos, ...shots]);
    } catch {
      setPhotoError(t("passport.photoError"));
    }
  }

  return (
    <div className="cx-editor" ref={ref} role="group" aria-label={t(`passport.add.${event.type}`)}>
      <h2 className="cx-editor-title" tabIndex={-1}>
        {t(`passport.add.${event.type}`)}
      </h2>
      <label className="field">
        <span>{t("passport.field.type")}</span>
        <select value={event.type} onChange={(e) => set("type", e.target.value as EventType)}>
          {EVENT_TYPES.filter((x) => x !== "health" || event.type === "health").map((x) => (
            <option key={x} value={x}>
              {t(`passport.type.${x}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t("common.date")}</span>
        <input type="date" value={event.date} max={todayIso()} onChange={(e) => set("date", e.target.value || todayIso())} />
      </label>
      <label className="field">
        <span>{t("passport.field.title")}</span>
        <input type="text" value={event.title} placeholder={t(`passport.defaultTitle.${event.type}`)} onChange={(e) => set("title", e.target.value)} />
      </label>
      <label className="field">
        <span>
          {t(event.type === "transfer" ? "passport.field.to" : `passport.field.by.${event.type === "acquired" ? "seller" : "workshop"}`)} ({t("common.optional")})
        </span>
        <input
          type="text"
          value={(event.type === "transfer" ? event.to : event.by) ?? ""}
          onChange={(e) => set(event.type === "transfer" ? "to" : "by", e.target.value || undefined)}
        />
      </label>
      {event.type !== "note" && event.type !== "condition" && (
        <label className="field cx-narrow">
          <span>
            {t("passport.field.cost")} ({t("common.optional")})
          </span>
          <input type="text" value={event.cost ?? ""} placeholder="€ 450" onChange={(e) => set("cost", e.target.value || undefined)} />
        </label>
      )}
      <label className="field">
        <span>
          {t("passport.field.detail")} ({t("common.optional")})
        </span>
        <textarea rows={3} value={event.detail ?? ""} placeholder={t(`passport.detailHint.${event.type}`)} onChange={(e) => set("detail", e.target.value || undefined)} />
      </label>
      <fieldset className="cx-fieldset">
        <legend>{t("passport.field.photos")}</legend>
        <p className="cx-quiet">{t("passport.field.photosHint")}</p>
        {photos.length > 0 && (
          <div className="pp-photos">
            {photos.map((src, i) => (
              <span key={i} className="pp-photo-edit">
                <img src={src} alt={t("passport.photoAlt", { n: i + 1 })} />
                <button type="button" className="cx-link" onClick={() => set("photos", photos.filter((_, j) => j !== i))}>
                  {t("common.remove")}
                </button>
              </span>
            ))}
          </div>
        )}
        {photos.length < 4 && (
          <label className="btn pp-file">
            {t("passport.field.addPhotos")}
            <input type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} />
          </label>
        )}
        {photoError && <p className="cx-problem">{photoError}</p>}
      </fieldset>
      <div className="cx-savebar">
        <button type="button" className="btn btn-red" onClick={() => onSave({ ...event, title })}>
          {t("common.save")}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function HandOver({ passport, item, onCancel, onDone }: { passport: Passport; item: CollectionItem; onCancel: () => void; onDone: (msg: string) => void }) {
  const [to, setTo] = useState("");
  const [date, setDate] = useState(todayIso());
  const [sealed, setSealed] = useState<{ p: Passport; fp: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function seal() {
    const base = await resubject(passport, item);
    const p = await addEvent(base, { id: newEventId(), type: "transfer", date, title: t("passport.defaultTitle.transfer"), to: to.trim() || undefined, recordedAt: new Date().toISOString() });
    await putPassport(p);
    downloadBlob(new Blob([serialize(p)], { type: "application/json" }), fileName(p));
    setSealed({ p, fp: await currentFingerprint(p) });
  }

  if (sealed)
    return (
      <div className="pp">
        <h2 className="cx-editor-title">{t("passport.handover.doneTitle")}</h2>
        <ol className="cx-flow">
          <li className="cx-step">
            <p>{t("passport.handover.file", { file: fileName(sealed.p) })}</p>
            <div className="cx-actions">
              <button type="button" className="btn" onClick={() => downloadBlob(new Blob([serialize(sealed.p)], { type: "application/json" }), fileName(sealed.p))}>
                {t("passport.handover.again")}
              </button>
            </div>
          </li>
          <li className="cx-step">
            <p>{t("passport.handover.code")}</p>
            <p className="cx-plate-no pp-fp-big">{sealed.fp}</p>
            <div className="cx-actions">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  navigator.clipboard?.writeText(sealed.fp).then(
                    () => setCopied(true),
                    () => setCopied(false)
                  )
                }
              >
                {copied ? t("common.copied") : t("passport.handover.copy")}
              </button>
            </div>
          </li>
        </ol>
        <div className="cx-block">
          <p>{t("passport.handover.removeQ", { name: item.name })}</p>
          {confirmRemove ? (
            <div className="cx-actions">
              <button
                type="button"
                className="btn btn-red"
                onClick={async () => {
                  saveCollection(getCollection().filter((i) => i.id !== item.id));
                  await removePassport(item.id);
                  onDone(t("passport.handover.removed", { name: item.name }));
                }}
              >
                {t("passport.handover.removeYes")}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmRemove(false)}>
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <div className="cx-actions">
              <button type="button" className="btn" onClick={() => setConfirmRemove(true)}>
                {t("passport.handover.remove")}
              </button>
              <button type="button" className="btn" onClick={() => onDone(t("passport.handover.kept", { name: item.name }))}>
                {t("passport.handover.keep")}
              </button>
            </div>
          )}
        </div>
      </div>
    );

  return (
    <div className="pp">
      <h2 className="cx-editor-title">{t("passport.handover")}</h2>
      <p>{t("passport.handover.explain")}</p>
      <label className="field">
        <span>
          {t("passport.field.to")} ({t("common.optional")})
        </span>
        <input type="text" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <label className="field cx-narrow">
        <span>{t("common.date")}</span>
        <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value || todayIso())} />
      </label>
      <p className="cx-tip">{t("passport.handover.honest")}</p>
      <div className="cx-savebar">
        <button type="button" className="btn btn-red" onClick={seal}>
          {t("passport.handover.seal")}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function Receive({ onCancel, onReceived }: { onCancel: () => void; onReceived: (id: string, name: string) => void }) {
  const [state, setState] = useState<{ p: Passport; v: Verification } | { error: string } | null>(null);
  const [code, setCode] = useState("");

  async function read(file: File | undefined) {
    if (!file) return;
    const parsed = parsePassport(await file.text());
    if (!parsed.ok) return setState({ error: t(`passport.receive.error.${parsed.reason}`) });
    setState({ p: parsed.passport, v: await verify(parsed.passport) });
  }

  const typed = code.toUpperCase().replace(/[^0-9A-F]/g, "");
  const got = state && "v" in state && state.v.ok ? state.v.fingerprint.replace(/-/g, "") : "";
  const codeMatch = typed.length === 16 ? typed === got : null;

  return (
    <div className="pp">
      <button type="button" className="cx-link" onClick={onCancel}>
        ← {t("passport.back")}
      </button>
      <h2 className="cx-editor-title">{t("passport.receive.title")}</h2>
      <ol className="cx-flow">
        <li className="cx-step">
          <p>{t("passport.receive.step1")}</p>
          <label className="btn btn-red pp-file">
            {t("passport.receive.choose")}
            <input type="file" accept=".json,application/json" onChange={(e) => read(e.target.files?.[0])} />
          </label>
          {state && "error" in state && <p className="cx-problem">{state.error}</p>}
        </li>
        {state && "p" in state && (
          <>
            <li className="cx-step">
              <div className="cx-plate">
                <p className="cx-plate-what">{state.p.subject.name}</p>
                {state.p.subject.serial && <p className="cx-plate-no">No. {state.p.subject.serial}</p>}
                <p className="cx-source">{tn("passport.entries", state.p.entries.length)}</p>
              </div>
              {state.v.ok ? <p className="cx-ok">{t("passport.receive.intact")}</p> : <p className="cx-problem">{t("passport.receive.broken", { n: state.v.brokenAt + 1 })}</p>}
            </li>
            {state.v.ok && (
              <li className="cx-step">
                <p>{t("passport.receive.step2")}</p>
                <label className="field cx-serial">
                  <span>{t("passport.receive.codeLabel")}</span>
                  <input type="text" inputMode="text" autoCapitalize="characters" value={code} placeholder="XXXX-XXXX-XXXX-XXXX" onChange={(e) => setCode(e.target.value)} />
                </label>
                {codeMatch === true && <p className="cx-ok">{t("passport.receive.match")}</p>}
                {codeMatch === false && <p className="cx-problem">{t("passport.receive.noMatch")}</p>}
                <p className="cx-tip">{t("passport.handover.honest")}</p>
                <div className="cx-actions">
                  <button
                    type="button"
                    className="btn btn-red"
                    disabled={codeMatch === false}
                    title={codeMatch === false ? t("passport.receive.noMatch") : undefined}
                    onClick={async () => {
                      const id = newItem(state.p.subject.kind, state.p.subject.name).id;
                      const { item, passport } = receive(state.p, id);
                      saveCollection([...getCollection(), item]);
                      await putPassport(passport);
                      onReceived(id, item.name);
                    }}
                  >
                    {t("passport.receive.add")}
                  </button>
                </div>
              </li>
            )}
          </>
        )}
      </ol>
    </div>
  );
}
