import { useEffect, useMemo, useRef, useState } from "react";
import { CITIES } from "../data/cities";
import { langTag, t, tn, useLang } from "../i18n";
import { sunDay } from "../physics/sun";
import { getString, setString } from "../services/persistence";
import { THEMES, decodeWalk, nextLight, promptsOf, themeOf, trackMetres, walkFromTheme, walkLink, walkZone, type Walk, type WalkLog } from "../state/walks";
import { formatFNumber } from "../utils/format";
import { startRoute, stopRoute } from "../state/trackStore";

const ACTIVE_KEY = "rangefinder-walk-active";
const LOG_KEY = "rangefinder-walk-log";
const PLACE_KEY = "rangefinder-walk-city";
/** The Light planner's "use my location" place, if the owner set one there. */
const HERE_KEY = "rangefinder-light-here";

interface Place {
  name: string;
  lat: number;
  lon: number;
  tz: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(getString(key) ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function initialPlace(): Place {
  const here = readJson<Place | null>(HERE_KEY, null);
  if (here && typeof here.lat === "number") return here;
  const id = getString(PLACE_KEY);
  const c = CITIES.find((x) => x.id === id) ?? CITIES.find((x) => x.id === "london") ?? CITIES[0];
  return { name: `${c.name}, ${c.country}`, lat: c.lat, lon: c.lon, tz: c.tz };
}

const walkFromHash = () => {
  const code = new URLSearchParams(location.hash.split("?")[1] ?? "").get("w");
  return code ? decodeWalk(code) : null;
};

const titleOf = (w: Walk) => w.title ?? (themeOf(w) ? t(`walk.theme.${w.theme}`) : t("walk.own.untitled"));
const r1 = (x: number) => (Number.isFinite(x) ? String(Math.round(x * 10) / 10) : "∞");

type View = { kind: "list" } | { kind: "walk"; walk: Walk; shared: boolean } | { kind: "make" } | { kind: "active" } | { kind: "done"; log: WalkLog };

/**
 * Photo walks (#44): pick a theme or write your own, set one lens for zone
 * focus, go when the light is right, and tick off what you find. A walk is a
 * link: send it and a friend or a club walks the same one.
 */
export default function PhotoWalks() {
  useLang();
  const [active, setActive] = useState<WalkLog | null>(() => readJson<WalkLog | null>(ACTIVE_KEY, null));
  const [view, setView] = useState<View>(() => {
    const shared = typeof location === "undefined" ? null : walkFromHash();
    if (shared) return { kind: "walk", walk: shared, shared: true };
    return readJson<WalkLog | null>(ACTIVE_KEY, null) ? { kind: "active" } : { kind: "list" };
  });
  const [log, setLog] = useState<WalkLog[]>(() => readJson<WalkLog[]>(LOG_KEY, []));
  const [place, setPlace] = useState<Place>(initialPlace);

  // A walk link opened while the page is already up.
  useEffect(() => {
    const onHash = () => {
      const w = walkFromHash();
      if (w) setView({ kind: "walk", walk: w, shared: true });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function saveActive(a: WalkLog | null) {
    setActive(a);
    setString(ACTIVE_KEY, a ? JSON.stringify(a) : "");
  }

  function start(walk: Walk) {
    // The link has done its job: a reload now returns to the walk in progress.
    if (location.hash.includes("?w=")) history.replaceState(null, "", "#/shoot/walks");
    saveActive({ id: Date.now().toString(36), walk, startedAt: new Date().toISOString(), found: [], metres: 0 });
    setView({ kind: "active" });
  }

  function finish(a: WalkLog) {
    const done = { ...a, endedAt: new Date().toISOString() };
    const next = [done, ...log].slice(0, 30);
    setLog(next);
    setString(LOG_KEY, JSON.stringify(next));
    saveActive(null);
    setView({ kind: "done", log: done });
  }

  const back = () => {
    if (location.hash.includes("?w=")) history.replaceState(null, "", "#/shoot/walks");
    setView({ kind: "list" });
  };

  if (view.kind === "active" && active) return <ActiveWalk log={active} onChange={saveActive} onFinish={finish} />;
  if (view.kind === "done") return <Summary log={view.log} onBack={back} />;
  if (view.kind === "make") return <MakeWalk onCancel={back} onMade={(walk) => setView({ kind: "walk", walk, shared: false })} />;
  if (view.kind === "walk") return <WalkView walk={view.walk} shared={view.shared} place={place} onPlace={setPlace} onBack={back} onStart={() => start(view.walk)} />;

  return (
    <section className="panel stage-walks cx" aria-label={t("tool.walks")}>
      <p className="cx-summary">{t("walk.intro")}</p>
      {active && (
        <div className="cx-block">
          <p>{t("walk.inProgress", { title: titleOf(active.walk) })}</p>
          <button type="button" className="btn btn-red" onClick={() => setView({ kind: "active" })}>
            {t("walk.resume")}
          </button>
        </div>
      )}
      <h2 className="cx-h">{t("walk.themes")}</h2>
      <ul className="lab-list">
        {THEMES.map((th) => (
          <li key={th.id}>
            <button type="button" className="cx-way" onClick={() => setView({ kind: "walk", walk: walkFromTheme(th), shared: false })}>
              <span className="cx-way-title">{t(`walk.theme.${th.id}`)}</span>
              <span className="cx-way-text">{t(`walk.theme.${th.id}.brief`)}</span>
              <span className="wk-kit">
                {th.focalMm} mm · {formatFNumber(th.fNumber)} · {t("walk.zoneShort", { m: th.zoneM })} · {tn("walk.minutes", th.minutes)}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="cx-way cx-way-main" onClick={() => setView({ kind: "make" })}>
            <span className="cx-way-title">{t("walk.make")}</span>
            <span className="cx-way-text">{t("walk.make.text")}</span>
          </button>
        </li>
      </ul>
      {log.length > 0 && (
        <>
          <h2 className="cx-h">{t("walk.history")}</h2>
          <ul className="wk-history">
            {log.map((l) => (
              <li key={l.id}>
                <span className="wk-history-title">{titleOf(l.walk)}</span>
                <span className="cx-quiet">
                  {new Intl.DateTimeFormat(langTag(), { dateStyle: "medium" }).format(new Date(l.startedAt))} · {t("walk.foundOf", { n: l.found.length, total: promptsOf(l.walk).length })}
                  {l.metres > 0 ? ` · ${r1(l.metres / 1000)} km` : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="cx-quiet cx-footnote">{t("walk.privacy")}</p>
    </section>
  );
}

function WalkView({ walk, shared, place, onPlace, onBack, onStart }: { walk: Walk; shared: boolean; place: Place; onPlace: (p: Place) => void; onBack: () => void; onStart: () => void }) {
  const theme = themeOf(walk);
  const zone = walkZone(walk);
  const prompts = promptsOf(walk);
  const [meet, setMeet] = useState(walk.meet ?? "");
  const [when, setWhen] = useState(walk.when ?? "");
  const [copied, setCopied] = useState(false);
  const now = useMemo(() => new Date(), []);
  const light = useMemo(() => {
    const day = sunDay(now, place.lat, place.lon);
    return nextLight(day, theme?.light ?? "any", now);
  }, [now, place.lat, place.lon, theme?.light]);
  const time = (d: Date) => new Intl.DateTimeFormat(langTag(), { hour: "2-digit", minute: "2-digit", timeZone: place.tz }).format(d);

  async function invite() {
    const link = walkLink({ ...walk, meet: meet.trim() || undefined, when: when || undefined }, location.href);
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (nav.share) await nav.share({ title: titleOf(walk), text: t("walk.inviteText", { title: titleOf(walk) }), url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    } catch {
      // Closed the share sheet: nothing to do.
    }
  }

  return (
    <section className="panel stage-walks cx" aria-label={titleOf(walk)}>
      <button type="button" className="cx-link" onClick={onBack}>
        ← {t("walk.back")}
      </button>
      {shared && <p className="cx-ok">{t("walk.sharedWith")}</p>}
      <h2 className="cx-editor-title">{titleOf(walk)}</h2>
      {theme && <p className="lab-brief">{t(`walk.theme.${theme.id}.brief`)}</p>}
      {(walk.meet || walk.when) && shared && (
        <p className="cx-block">
          {walk.when && <strong>{new Intl.DateTimeFormat(langTag(), { dateStyle: "full", timeStyle: "short" }).format(new Date(walk.when))}</strong>}
          {walk.meet && <span className="wk-meet">{t("walk.meetAt", { place: walk.meet })}</span>}
        </p>
      )}

      <div className="cx-plate wk-set">
        <p className="pp-cert-label">{t("walk.setup")}</p>
        <p className="cx-plate-no">
          {walk.focalMm} mm · {formatFNumber(walk.fNumber)}
        </p>
        <p className="cx-plate-what">{t("walk.zone", { m: walk.zoneM })}</p>
        <p className="cx-source">{Number.isFinite(zone.farM) ? t("walk.sharp", { near: r1(zone.nearM), far: r1(zone.farM) }) : t("walk.sharpInf", { near: r1(zone.nearM) })}</p>
      </div>

      <h3 className="pp-h3">{t("walk.when")}</h3>
      <p>
        {light
          ? t(`walk.light.${light.phase}`, { from: time(light.start), to: time(light.end) })
          : t("walk.light.none")}
      </p>
      <label className="field cx-narrow wk-place">
        <span>{t("walk.place")}</span>
        <select
          value={CITIES.find((c) => `${c.name}, ${c.country}` === place.name)?.id ?? ""}
          onChange={(e) => {
            const c = CITIES.find((x) => x.id === e.target.value);
            if (!c) return;
            setString(PLACE_KEY, c.id);
            onPlace({ name: `${c.name}, ${c.country}`, lat: c.lat, lon: c.lon, tz: c.tz });
          }}
        >
          {!CITIES.some((c) => `${c.name}, ${c.country}` === place.name) && <option value="">{place.name}</option>}
          {[...CITIES]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.country}
              </option>
            ))}
        </select>
      </label>

      <h3 className="pp-h3">{t("walk.find")}</h3>
      <ol className="wk-prompts">
        {prompts.map((p, i) => (
          <li key={i}>{p.key ? t(p.key) : p.text}</li>
        ))}
      </ol>

      <div className="cx-actions">
        <button type="button" className="btn btn-red" onClick={onStart}>
          {t("walk.start")}
        </button>
      </div>

      <details className="pp-more">
        <summary>{t("walk.invite")}</summary>
        <p className="cx-quiet">{t("walk.invite.text")}</p>
        <label className="field">
          <span>
            {t("walk.meet")} ({t("common.optional")})
          </span>
          <input type="text" value={meet} maxLength={140} onChange={(e) => setMeet(e.target.value)} />
        </label>
        <label className="field cx-narrow">
          <span>
            {t("walk.meetWhen")} ({t("common.optional")})
          </span>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <div className="cx-actions">
          <button type="button" className="btn" onClick={invite}>
            {copied ? t("walk.linkCopied") : t("walk.sendLink")}
          </button>
        </div>
      </details>
    </section>
  );
}

function ActiveWalk({ log, onChange, onFinish }: { log: WalkLog; onChange: (l: WalkLog) => void; onFinish: (l: WalkLog) => void }) {
  const prompts = promptsOf(log.walk);
  const zone = walkZone(log.walk);
  const [now, setNow] = useState(() => Date.now());
  const [gps, setGps] = useState<"off" | "on" | "denied" | "none">("off");
  const track = useRef<{ lat: number; lon: number; accuracy?: number }[]>([]);
  const latest = useRef(log);
  latest.current = log;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Keep the screen awake on the walk, where the browser allows it.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => void lock?.release();
  }, []);

  // Counting the distance also records the route, for placing the walk's frames on the map later (#57).
  useEffect(() => {
    if (gps !== "on") return;
    startRoute();
    return () => stopRoute();
  }, [gps]);

  useEffect(() => {
    if (gps !== "on") return;
    if (!navigator.geolocation) return setGps("none");
    const id = navigator.geolocation.watchPosition(
      (p) => {
        track.current.push({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy });
        onChange({ ...latest.current, metres: Math.max(latest.current.metres, trackMetres(track.current)) });
      },
      () => setGps("denied"),
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [gps, onChange]);

  const minutes = Math.floor((now - new Date(log.startedAt).getTime()) / 60_000);
  const toggle = (i: number) => onChange({ ...log, found: log.found.includes(i) ? log.found.filter((x) => x !== i) : [...log.found, i] });

  return (
    <section className="panel stage-walks cx wk-active" aria-label={titleOf(log.walk)}>
      <p className="pp-cert-label">{t("walk.onWalk")}</p>
      <h2 className="cx-editor-title">{titleOf(log.walk)}</h2>
      <div className="wk-dash">
        <div className="wk-big">
          <span className="wk-big-n">{formatFNumber(log.walk.fNumber)}</span>
          <span className="wk-big-l">{t("walk.zone", { m: log.walk.zoneM })}</span>
        </div>
        <div className="wk-big">
          <span className="wk-big-n">
            {r1(zone.nearM)}–{r1(zone.farM)}
          </span>
          <span className="wk-big-l">{t("walk.sharpShort")}</span>
        </div>
        <div className="wk-big">
          <span className="wk-big-n">{minutes}</span>
          <span className="wk-big-l">
            {t("walk.ofMinutes", { n: log.walk.minutes })}
            {log.metres > 0 ? ` · ${r1(log.metres / 1000)} km` : ""}
          </span>
        </div>
      </div>
      {gps === "off" && (
        <button type="button" className="cx-link" onClick={() => setGps("on")}>
          {t("walk.gps")}
        </button>
      )}
      {gps === "denied" && <p className="cx-quiet">{t("walk.gpsDenied")}</p>}
      {gps === "on" && <p className="cx-quiet">{t("walk.gpsOn")}</p>}

      <h3 className="pp-h3">{t("walk.foundOf", { n: log.found.length, total: prompts.length })}</h3>
      <ul className="wk-checklist">
        {prompts.map((p, i) => (
          <li key={i}>
            <button type="button" className={`wk-check${log.found.includes(i) ? " wk-check-on" : ""}`} aria-pressed={log.found.includes(i)} onClick={() => toggle(i)}>
              <span className="wk-box" aria-hidden="true">
                {log.found.includes(i) ? "✓" : ""}
              </span>
              {p.key ? t(p.key) : p.text}
            </button>
          </li>
        ))}
      </ul>
      <div className="cx-savebar">
        <button type="button" className="btn btn-red" onClick={() => onFinish(log)}>
          {t("walk.finish")}
        </button>
      </div>
    </section>
  );
}

function Summary({ log, onBack }: { log: WalkLog; onBack: () => void }) {
  const total = promptsOf(log.walk).length;
  const minutes = Math.round((new Date(log.endedAt ?? Date.now()).getTime() - new Date(log.startedAt).getTime()) / 60_000);
  return (
    <section className="panel stage-walks cx" aria-label={t("walk.doneTitle")}>
      <h2 className="cx-editor-title">{t("walk.doneTitle")}</h2>
      <p className="cx-summary">{t("walk.done", { n: log.found.length, total, title: titleOf(log.walk) })}</p>
      <p className="cx-quiet">
        {tn("walk.minutes", minutes)}
        {log.metres > 0 ? ` · ${r1(log.metres / 1000)} km` : ""}
      </p>
      <p className="cx-tip">{t("walk.next")}</p>
      <div className="cx-actions">
        <a className="btn btn-red" href="#/shoot/shotlog">
          {t("walk.toShotLog")}
        </a>
        <button type="button" className="btn" onClick={onBack}>
          {t("walk.back")}
        </button>
      </div>
    </section>
  );
}

const FOCALS = [21, 24, 28, 35, 40, 50, 75, 90];
const APERTURES = [2, 2.8, 4, 5.6, 8, 11, 16];
const ZONES = [1.5, 2, 3, 5, 10];

function MakeWalk({ onCancel, onMade }: { onCancel: () => void; onMade: (w: Walk) => void }) {
  const [title, setTitle] = useState("");
  const [focal, setFocal] = useState(35);
  const [f, setF] = useState(8);
  const [zoneM, setZone] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [prompts, setPrompts] = useState("");
  const list = prompts
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

  return (
    <section className="panel stage-walks cx" aria-label={t("walk.make")}>
      <button type="button" className="cx-link" onClick={onCancel}>
        ← {t("walk.back")}
      </button>
      <h2 className="cx-editor-title">{t("walk.make")}</h2>
      <label className="field">
        <span>{t("walk.field.title")}</span>
        <input type="text" value={title} maxLength={80} placeholder={t("walk.field.titleHint")} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="cx-grid">
        <label className="field">
          <span>{t("lab.field.focal")}</span>
          <select value={focal} onChange={(e) => setFocal(Number(e.target.value))}>
            {FOCALS.map((x) => (
              <option key={x} value={x}>
                {x} mm
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("common.aperture")}</span>
          <select value={f} onChange={(e) => setF(Number(e.target.value))}>
            {APERTURES.map((x) => (
              <option key={x} value={x}>
                {formatFNumber(x)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("walk.field.zone")}</span>
          <select value={zoneM} onChange={(e) => setZone(Number(e.target.value))}>
            {ZONES.map((x) => (
              <option key={x} value={x}>
                {x} m
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("walk.field.minutes")}</span>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[30, 45, 60, 90, 120, 180].map((x) => (
              <option key={x} value={x}>
                {tn("walk.minutes", x)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>{t("walk.field.prompts")}</span>
        <textarea rows={6} value={prompts} placeholder={t("walk.field.promptsHint")} onChange={(e) => setPrompts(e.target.value)} />
      </label>
      <div className="cx-savebar">
        <button
          type="button"
          className="btn btn-red"
          disabled={list.length === 0}
          title={list.length === 0 ? t("walk.field.needPrompt") : undefined}
          onClick={() => onMade({ v: 1, theme: "own", title: title.trim() || undefined, focalMm: focal, fNumber: f, zoneM, minutes, prompts: list })}
        >
          {t("walk.field.make")}
        </button>
        {list.length === 0 && <p className="cx-quiet">{t("walk.field.needPrompt")}</p>}
      </div>
    </section>
  );
}
