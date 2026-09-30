import { useState } from "react";
import { BODIES } from "../data/gear";
import { ENGLISH_CARD, XRAY_CARD, cardFor } from "../data/xrayCard";
import { langTag, t, useLang } from "../i18n";
import { getString, setString } from "../services/persistence";
import { useCollection } from "../state/collectionStorage";
import { useFilmStock } from "../state/filmStockStore";
import { inCamera, totalRolls } from "../state/filmStock";
import { packingList, progress, type PackItem } from "../state/packing";
import { useWakeLock } from "../utils/useWakeLock";

const KEY = "rangefinder-travel";

interface Saved {
  gear: string[];
  done: string[];
  own: string[];
  owner: string;
  rolls: number;
}

function load(): Saved {
  try {
    const s = JSON.parse(getString(KEY) ?? "null") as Partial<Saved> | null;
    return { gear: s?.gear ?? [], done: s?.done ?? [], own: s?.own ?? [], owner: s?.owner ?? "", rolls: s?.rolls ?? 0 };
  } catch {
    return { gear: [], done: [], own: [], owner: "", rolls: 0 };
  }
}

type Tab = "card" | "pack" | "papers";

/**
 * Travel kit (#49): the airport card asking for a hand check of film, in
 * the checkpoint's language; the packing list; and a proof-of-ownership list
 * of the gear, with serial numbers, to print for customs and insurance.
 */
export default function TravelKit() {
  useLang();
  const [tab, setTab] = useState<Tab>("card");
  const [saved, setSaved] = useState<Saved>(load);
  const update = (patch: Partial<Saved>) => {
    const next = { ...saved, ...patch };
    setSaved(next);
    setString(KEY, JSON.stringify(next));
  };
  return (
    <section className="panel stage-travel cx" aria-label={t("tool.travel")}>
      <div className="cx-actions" role="tablist" aria-label={t("tool.travel")}>
        {(["card", "pack", "papers"] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={`cx-pick${tab === x ? " cx-pick-on" : ""}`} onClick={() => setTab(x)}>
            {t(`travel.tab.${x}`)}
          </button>
        ))}
      </div>
      {tab === "card" && <AirportCard />}
      {tab === "pack" && <Packing saved={saved} update={update} />}
      {tab === "papers" && <Papers saved={saved} update={update} />}
    </section>
  );
}

function AirportCard() {
  const [tag, setTag] = useState(() => cardFor(typeof navigator === "undefined" ? "en" : navigator.language).tag);
  const [big, setBig] = useState(false);
  const card = XRAY_CARD.find((c) => c.tag === tag) ?? ENGLISH_CARD;
  useWakeLock(big);
  const face = (
    <div className="xr-card">
      <p className="xr-icon" aria-hidden="true">
        ✋ ⟂ ☢
      </p>
      <p className="xr-main" lang={card.tag} dir={card.rtl ? "rtl" : "ltr"}>
        {card.text}
      </p>
      {card.tag !== "en" && (
        <p className="xr-en" lang="en">
          {ENGLISH_CARD.text}
        </p>
      )}
    </div>
  );
  if (big)
    return (
      <div className="xr-full" role="dialog" aria-modal="true" aria-label={t("travel.card.title")} onClick={() => setBig(false)}>
        {face}
        <p className="xr-exit">{t("travel.card.exit")}</p>
      </div>
    );
  return (
    <div>
      <h2 className="cx-h">{t("travel.card.title")}</h2>
      <p className="cx-quiet">{t("travel.card.intro")}</p>
      <label className="field cx-narrow">
        <span>{t("travel.card.lang")}</span>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          {XRAY_CARD.map((c) => (
            <option key={c.tag} value={c.tag}>
              {c.native} · {c.english}
            </option>
          ))}
        </select>
      </label>
      {face}
      <div className="cx-actions">
        <button type="button" className="btn btn-red" onClick={() => setBig(true)}>
          {t("travel.card.show")}
        </button>
      </div>
      <ul className="hc-how">
        <li>{t("travel.card.tip1")}</li>
        <li>{t("travel.card.tip2")}</li>
        <li>{t("travel.card.tip3")}</li>
      </ul>
      <p className="cx-quiet">{t("travel.card.honest")}</p>
    </div>
  );
}

function GearPick({ saved, update }: { saved: Saved; update: (p: Partial<Saved>) => void }) {
  const items = useCollection();
  if (items.length === 0) return <p className="cx-tip">{t("travel.noCollection")}</p>;
  return (
    <ul className="wk-checklist">
      {items.map((i) => {
        const on = saved.gear.includes(i.id);
        return (
          <li key={i.id}>
            <button type="button" className={`wk-check${on ? " wk-check-on" : ""}`} aria-pressed={on} onClick={() => update({ gear: on ? saved.gear.filter((x) => x !== i.id) : [...saved.gear, i.id] })}>
              <span className="wk-box" aria-hidden="true">
                {on ? "✓" : ""}
              </span>
              {i.name}
              {i.serial ? <span className="cx-quiet"> · No. {i.serial}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Packing({ saved, update }: { saved: Saved; update: (p: Partial<Saved>) => void }) {
  const collection = useCollection();
  const stock = useFilmStock();
  const [extra, setExtra] = useState("");
  const gear = collection.filter((i) => saved.gear.includes(i.id));
  const bodies = gear.filter((i) => i.kind === "body").map((i) => BODIES.find((b) => b.id === i.catalogueId));
  const film = bodies.some((b) => !b || b.medium === "film") || inCamera(stock).length > 0;
  const digital = bodies.some((b) => b && b.medium !== "film");
  const list: PackItem[] = [...packingList(gear, { film, digital, filmRolls: saved.rolls }), ...saved.own.map((text, i): PackItem => ({ id: `own-${i}`, text, group: "own" }))];
  const done = new Set(saved.done);
  const p = progress(list, done);

  return (
    <div>
      <h2 className="cx-h">{t("travel.pack.gear")}</h2>
      <GearPick saved={saved} update={update} />
      {film && (
        <label className="field cx-narrow">
          <span>{t("travel.pack.rolls")}</span>
          <input type="number" min={0} max={200} value={saved.rolls} onChange={(e) => update({ rolls: Math.max(0, Number(e.target.value) || 0) })} />
          <span className="cx-quiet">{t("travel.pack.inFridge", { n: totalRolls(stock) })}</span>
        </label>
      )}
      <h2 className="cx-h">{t("travel.pack.list", { done: p.done, total: p.total })}</h2>
      <ul className="wk-checklist">
        {list.map((i) => {
          const on = done.has(i.id);
          return (
            <li key={i.id}>
              <button type="button" className={`wk-check${on ? " wk-check-on" : ""}`} aria-pressed={on} onClick={() => update({ done: on ? saved.done.filter((x) => x !== i.id) : [...saved.done, i.id] })}>
                <span className="wk-box" aria-hidden="true">
                  {on ? "✓" : ""}
                </span>
                {i.key ? t(i.key, i.vars) : i.text}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="cx-inline">
        <label className="field">
          <span>{t("travel.pack.add")}</span>
          <input type="text" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn"
          disabled={!extra.trim()}
          onClick={() => {
            update({ own: [...saved.own, extra.trim()] });
            setExtra("");
          }}
        >
          {t("common.add")}
        </button>
      </div>
      <div className="cx-actions">
        <button type="button" className="btn" onClick={() => update({ done: [] })}>
          {t("travel.pack.clear")}
        </button>
      </div>
    </div>
  );
}

function Papers({ saved, update }: { saved: Saved; update: (p: Partial<Saved>) => void }) {
  const collection = useCollection();
  const gear = collection.filter((i) => saved.gear.includes(i.id));
  const today = new Intl.DateTimeFormat(langTag(), { dateStyle: "long" }).format(new Date());
  return (
    <div>
      <h2 className="cx-h">{t("travel.papers.title")}</h2>
      <p className="cx-quiet">{t("travel.papers.intro")}</p>
      <GearPick saved={saved} update={update} />
      <label className="field cx-narrow">
        <span>{t("travel.papers.owner")}</span>
        <input type="text" value={saved.owner} onChange={(e) => update({ owner: e.target.value })} />
      </label>
      <p className="cx-tip">{t("travel.papers.customs")}</p>
      <div className="cx-actions">
        <button type="button" className="btn btn-red" disabled={gear.length === 0} onClick={() => window.print()}>
          {t("travel.papers.print")}
        </button>
      </div>
      <div className="co-print tr-print" aria-hidden="true">
        <h2>{t("travel.papers.heading")}</h2>
        <p>
          {t("travel.papers.owner")}: {saved.owner || "________________________"} · {today}
        </p>
        <table>
          <thead>
            <tr>
              <th>{t("col.th.item")}</th>
              <th>{t("col.th.serial")}</th>
              <th>{t("col.th.acquired")}</th>
            </tr>
          </thead>
          <tbody>
            {gear.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.photo && <img src={i.photo} alt="" />}
                  {i.name}
                </td>
                <td>{i.serial}</td>
                <td>{i.acquired}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{t("travel.papers.declare")}</p>
        <p>{t("travel.papers.signature")}: ________________________</p>
      </div>
    </div>
  );
}
