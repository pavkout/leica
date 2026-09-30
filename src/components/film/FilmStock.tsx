import { useState } from "react";
import { langTag, t, tn, useLang } from "../../i18n";
import { FILM_STOCKS } from "../../preview/film";
import { useCollection } from "../../state/collectionStorage";
import {
  addStock,
  countFrame,
  developed,
  expiry,
  finishRoll,
  inCamera,
  loadRoll,
  loadedCameras,
  markDeveloped,
  pushStops,
  removeRoll,
  setCount,
  sortedStock,
  toDevelop,
  totalRolls,
  type Format,
  type Roll,
  type StockItem,
} from "../../state/filmStock";
import { getFilmStock, saveFilmStock, useFilmStock } from "../../state/filmStockStore";

const FILMS = FILM_STOCKS.filter((f) => f.kind !== "digital");

const monthName = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat(langTag(), { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
  } catch {
    return ym;
  }
};

/**
 * Film stock (#48): what's in the fridge (and what's expiring), what's in
 * each camera and how far along it is, and what's waiting to be developed.
 */
export default function FilmStock() {
  useLang();
  const state = useFilmStock();
  const collection = useCollection();
  const cameras = collection.filter((i) => i.kind === "body").map((i) => i.name);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState<StockItem | "outside" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const today = new Date();
  const save = (next: typeof state) => {
    if (!saveFilmStock(next)) setNote(t("passport.storageFull"));
  };

  const loaded = inCamera(state);
  const waiting = toDevelop(state);
  const done = developed(state).slice(0, 10);
  const stock = sortedStock(state, today);
  const warnings = stock.filter((s) => expiry(s, today) !== "ok" && expiry(s, today) !== "unknown");

  return (
    <section className="panel stage-filmstock cx" aria-label={t("tool.filmstock")}>
      {note && (
        <p className="cx-ok" role="status">
          {note}
        </p>
      )}
      <p className="cx-summary">
        {t("fs.summary", {
          loaded: tn("fs.rollsInCameras", loaded.length),
          fridge: tn("fs.rollsInFridge", totalRolls(state)),
          develop: tn("fs.rollsToDevelop", waiting.length),
        })}
      </p>
      {warnings.length > 0 && <p className="cx-problem">{tn("fs.expiringWarn", warnings.reduce((n, s) => n + s.count, 0))}</p>}

      <h2 className="cx-h">{t("fs.inCameras")}</h2>
      {loaded.length === 0 ? (
        <p className="cx-quiet">{t("fs.noneLoaded")}</p>
      ) : (
        <ul className="fs-rolls">
          {loaded.map((r) => (
            <RollCard key={r.id} roll={r} onCount={(by) => save(countFrame(getFilmStock(), r.id, by))} onFinish={() => save(finishRoll(getFilmStock(), r.id))} onRemove={() => save(removeRoll(getFilmStock(), r.id))} />
          ))}
        </ul>
      )}
      <div className="cx-actions">
        <button type="button" className="btn btn-red" onClick={() => setLoading(stock[0] ?? "outside")}>
          {t("fs.loadRoll")}
        </button>
      </div>

      {loading && (
        <LoadForm
          stock={stock}
          first={loading}
          cameras={cameras}
          busy={loadedCameras(state)}
          onCancel={() => setLoading(null)}
          onLoad={(from, camera, ei) => {
            save(loadRoll(getFilmStock(), from, camera, ei));
            setLoading(null);
            setNote(t("fs.loaded", { film: from.film, camera }));
          }}
        />
      )}

      {waiting.length > 0 && (
        <>
          <h2 className="cx-h">{t("fs.toDevelop")}</h2>
          <ul className="fs-list">
            {waiting.map((r) => (
              <li key={r.id}>
                <span className="fs-name">
                  {r.film}
                  {pushStops(r) !== 0 && <span className="fs-push"> · {t("fs.shotAt", { ei: r.ei, stops: (pushStops(r) > 0 ? "+" : "") + pushStops(r) })}</span>}
                </span>
                <span className="cx-quiet">
                  {r.camera} · {tn("fs.frames", r.frames)}
                </span>
                <span className="cx-actions">
                  <a className="btn" href="#/film/develop">
                    {t("fs.developIt")}
                  </a>
                  <button type="button" className="btn" onClick={() => save(markDeveloped(getFilmStock(), r.id))}>
                    {t("fs.markDeveloped")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="cx-h">{t("fs.fridge")}</h2>
      {stock.length === 0 ? (
        <p className="cx-quiet">{t("fs.fridgeEmpty")}</p>
      ) : (
        <ul className="fs-list">
          {stock.map((s) => {
            const e = expiry(s, today);
            return (
              <li key={s.id} className={`fs-${e}`}>
                <span className="fs-name">
                  {s.film} <span className="cx-quiet">· {s.format === "other" ? t("fs.format.other") : s.format} · {s.exposures}</span>
                </span>
                <span className={e === "expired" || e === "soon" ? "fs-exp-warn" : "cx-quiet"}>
                  {s.expires ? t(`fs.exp.${e}`, { month: monthName(s.expires) }) : t("fs.exp.unknown")}
                </span>
                <span className="fs-count" role="group" aria-label={t("fs.countOf", { film: s.film })}>
                  <button type="button" className="cx-pick" aria-label={t("fs.minus")} onClick={() => save(setCount(getFilmStock(), s.id, s.count - 1))}>
                    −
                  </button>
                  <span className="fs-n">{s.count}</span>
                  <button type="button" className="cx-pick" aria-label={t("fs.plus")} onClick={() => save(setCount(getFilmStock(), s.id, s.count + 1))}>
                    +
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {adding ? (
        <AddForm
          onCancel={() => setAdding(false)}
          onAdd={(item) => {
            save(addStock(getFilmStock(), item));
            setAdding(false);
            setNote(t("fs.added", { n: item.count, film: item.film }));
          }}
        />
      ) : (
        <div className="cx-actions">
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            {t("fs.addFilm")}
          </button>
        </div>
      )}

      {done.length > 0 && (
        <details className="pp-more">
          <summary>{t("fs.history", { n: done.length })}</summary>
          <ul>
            {done.map((r) => (
              <li key={r.id}>
                {r.film} · {r.camera} · {new Intl.DateTimeFormat(langTag(), { dateStyle: "medium" }).format(new Date(r.developedAt!))}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="cx-quiet cx-footnote">{t("fs.privacy")}</p>
    </section>
  );
}

function RollCard({ roll, onCount, onFinish, onRemove }: { roll: Roll; onCount: (by: number) => void; onFinish: () => void; onRemove: () => void }) {
  const [sure, setSure] = useState(false);
  const left = Math.max(0, roll.exposures - roll.frames);
  const p = pushStops(roll);
  return (
    <li className="fs-roll">
      <p className="pp-cert-label">{roll.camera}</p>
      <p className="cx-plate-what">
        {roll.film}
        {p !== 0 && <span className="fs-push"> · {t("fs.shotAt", { ei: roll.ei, stops: (p > 0 ? "+" : "") + p })}</span>}
      </p>
      <p className="fs-frames">
        <span className="cx-plate-no">{roll.frames}</span> <span className="cx-quiet">/ {roll.exposures}</span>
      </p>
      <p className="cx-quiet">{left > 0 ? tn("fs.left", left) : t("fs.full")}</p>
      <div className="cx-actions">
        <button type="button" className="btn btn-red" onClick={() => onCount(1)}>
          {t("fs.frameShot")}
        </button>
        <button type="button" className="btn" onClick={() => onCount(-1)} disabled={roll.frames === 0}>
          {t("fs.undo")}
        </button>
        <button type="button" className="btn" onClick={onFinish}>
          {t("fs.finished")}
        </button>
      </div>
      {sure ? (
        <p>
          <button type="button" className="cx-link" onClick={onRemove}>
            {t("fs.removeYes")}
          </button>{" "}
          <button type="button" className="cx-link" onClick={() => setSure(false)}>
            {t("common.cancel")}
          </button>
        </p>
      ) : (
        <button type="button" className="cx-link" onClick={() => setSure(true)}>
          {t("fs.remove")}
        </button>
      )}
    </li>
  );
}

function LoadForm({
  stock,
  first,
  cameras,
  busy,
  onCancel,
  onLoad,
}: {
  stock: StockItem[];
  first: StockItem | "outside";
  cameras: string[];
  busy: Set<string>;
  onCancel: () => void;
  onLoad: (from: StockItem | Omit<StockItem, "id" | "count">, camera: string, ei: number) => void;
}) {
  const [from, setFrom] = useState<string>(first === "outside" ? "outside" : first.id);
  const [outside, setOutside] = useState(FILMS[0]?.id ?? "");
  const [camera, setCamera] = useState(cameras[0] ?? "");
  const item = stock.find((s) => s.id === from);
  const look = FILMS.find((f) => f.id === (item?.filmId ?? outside));
  const iso = item?.iso ?? look?.iso ?? 400;
  const [ei, setEi] = useState(iso);
  const already = busy.has(camera.trim().toLowerCase());
  const EIS = [iso / 4, iso / 2, iso, iso * 2, iso * 4, iso * 8].filter((x) => x >= 6 && x <= 12800);

  return (
    <div className="cx-block" role="group" aria-label={t("fs.loadRoll")}>
      <h3 className="pp-h3">{t("fs.loadRoll")}</h3>
      <div className="cx-grid">
        <label className="field">
          <span>{t("fs.whichFilm")}</span>
          <select
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              const it = stock.find((s) => s.id === e.target.value);
              if (it) setEi(it.iso);
            }}
          >
            {stock.map((s) => (
              <option key={s.id} value={s.id}>
                {s.film} ({s.format}, {s.count})
              </option>
            ))}
            <option value="outside">{t("fs.notFromFridge")}</option>
          </select>
        </label>
        {from === "outside" && (
          <label className="field">
            <span>{t("dev.film")}</span>
            <select
              value={outside}
              onChange={(e) => {
                setOutside(e.target.value);
                setEi(FILMS.find((f) => f.id === e.target.value)?.iso ?? 400);
              }}
            >
              {FILMS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>{t("fs.camera")}</span>
          <input type="text" list="fs-cameras" value={camera} placeholder="M6" onChange={(e) => setCamera(e.target.value)} />
          <datalist id="fs-cameras">
            {cameras.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>{t("fs.ratedAt")}</span>
          <select value={ei} onChange={(e) => setEi(Number(e.target.value))}>
            {EIS.map((x) => (
              <option key={x} value={x}>
                EI {x}
                {x === iso ? ` (${t("dev.box")})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {already && <p className="cx-warn">{t("fs.alreadyLoaded", { camera })}</p>}
      <div className="cx-actions">
        <button
          type="button"
          className="btn btn-red"
          disabled={!camera.trim()}
          onClick={() =>
            onLoad(item ?? { film: look?.name ?? "", filmId: look?.id, format: "135", exposures: 36, iso: look?.iso ?? iso }, camera.trim(), ei)
          }
        >
          {t("fs.load")}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function AddForm({ onAdd, onCancel }: { onAdd: (item: Omit<StockItem, "id">) => void; onCancel: () => void }) {
  const [filmId, setFilmId] = useState(FILMS[0]?.id ?? "other");
  const [other, setOther] = useState("");
  const [iso, setIso] = useState(FILMS[0]?.iso ?? 400);
  const [format, setFormat] = useState<Format>("135");
  const [exposures, setExposures] = useState(36);
  const [count, setCountN] = useState(5);
  const [expires, setExpires] = useState("");
  const look = FILMS.find((f) => f.id === filmId);
  const name = filmId === "other" ? other.trim() : (look?.name ?? "");

  return (
    <div className="cx-block" role="group" aria-label={t("fs.addFilm")}>
      <h3 className="pp-h3">{t("fs.addFilm")}</h3>
      <div className="cx-grid">
        <label className="field">
          <span>{t("dev.film")}</span>
          <select
            value={filmId}
            onChange={(e) => {
              setFilmId(e.target.value);
              const l = FILMS.find((f) => f.id === e.target.value);
              if (l) setIso(l.iso);
            }}
          >
            {FILMS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value="other">{t("fs.otherFilm")}</option>
          </select>
        </label>
        {filmId === "other" && (
          <>
            <label className="field">
              <span>{t("fs.filmName")}</span>
              <input type="text" value={other} placeholder="Ilford FP4 Plus" onChange={(e) => setOther(e.target.value)} />
            </label>
            <label className="field">
              <span>ISO</span>
              <input type="number" min={1} value={iso} onChange={(e) => setIso(Number(e.target.value) || 100)} />
            </label>
          </>
        )}
        <label className="field">
          <span>{t("fs.format")}</span>
          <select
            value={format}
            onChange={(e) => {
              const f = e.target.value as Format;
              setFormat(f);
              setExposures(f === "120" ? 12 : 36);
            }}
          >
            <option value="135">135 (35 mm)</option>
            <option value="120">120</option>
            <option value="other">{t("fs.format.other")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("fs.exposures")}</span>
          <input type="number" min={1} max={72} value={exposures} onChange={(e) => setExposures(Number(e.target.value) || 36)} />
        </label>
        <label className="field">
          <span>{t("fs.howMany")}</span>
          <input type="number" min={1} max={500} value={count} onChange={(e) => setCountN(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <label className="field">
          <span>{t("fs.expires")}</span>
          <input type="month" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </label>
      </div>
      <div className="cx-actions">
        <button type="button" className="btn btn-red" disabled={!name} onClick={() => onAdd({ film: name, filmId: look?.id, format, exposures, iso, count, expires: expires || undefined })}>
          {t("fs.add")}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
