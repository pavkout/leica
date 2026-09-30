import { useEffect, useMemo, useRef, useState } from "react";
import { langTag, t, useLang } from "../i18n";
import { ASSUMED_PHONE_FOV_DEG } from "../physics/liveView";
import { sunDay, sunPosition } from "../physics/sun";
import { cloudAt, compassPoint, dayPath, forecastUrl, parseForecast, project, skyFor, type HourCloud, type PathPoint } from "../physics/sunFinder";
import { listenCompass, type Orientation } from "../services/compass";
import { SORTED_CITIES, cityPlace, herePlace, rememberPlace, savedPlace, type Place } from "../state/place";
import { useCameraStream } from "../state/useCameraStream";

const DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const dirWord = (az: number) => DIRS[Math.round(az / 45) % 8];
const PHASE_COLOUR: Record<string, string> = { golden: "#e0a040", blue: "#5b7fd6", day: "#ece9e2", night: "#555" };

/** Local midnight at the place, as an instant. */
function midnightAt(day: Date, tz: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(day);
  const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = local - Math.floor(day.getTime() / 60000) * 60000;
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")) - offset);
}

/**
 * Sun finder (#50): where the sun will be, at any time today or on another
 * day, on a compass or drawn over the live camera; and what the forecast
 * clouds mean for the golden hours.
 */
export default function SunFinder() {
  useLang();
  const [place, setPlace] = useState<Place>(savedPlace);
  const [dayOffset, setDayOffset] = useState(0);
  const now = useMemo(() => new Date(), []);
  const day = new Date(now.getTime() + dayOffset * 86_400_000);
  const start = midnightAt(day, place.tz);
  const path = useMemo(() => dayPath(start, place.lat, place.lon, 10), [start.getTime(), place.lat, place.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  const spans = useMemo(() => sunDay(start, place.lat, place.lon), [start.getTime(), place.lat, place.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  const [minute, setMinute] = useState(() => (dayOffset === 0 ? Math.round((now.getTime() - start.getTime()) / 60000) : 12 * 60));
  const at = new Date(start.getTime() + minute * 60000);
  const sun = sunPosition(at, place.lat, place.lon);
  const [orient, setOrient] = useState<Orientation | null>(null);
  const [compassState, setCompassState] = useState<"off" | "on" | "none">("off");
  const stopCompass = useRef<(() => void) | null>(null);
  const [ar, setAr] = useState(false);
  const [clouds, setClouds] = useState<HourCloud[] | null>(null);
  const [cloudState, setCloudState] = useState<"idle" | "loading" | "error">("idle");
  const [locating, setLocating] = useState(false);

  useEffect(() => () => stopCompass.current?.(), []);

  const time = (d: Date) => new Intl.DateTimeFormat(langTag(), { hour: "2-digit", minute: "2-digit", timeZone: place.tz }).format(d);
  const dateLabel = new Intl.DateTimeFormat(langTag(), { weekday: "long", day: "numeric", month: "long", timeZone: place.tz }).format(at);

  const moments = [
    spans.sunrise && { key: "sunrise", at: spans.sunrise },
    ...spans.spans.filter((s) => s.phase === "golden").map((s, i) => ({ key: i === 0 ? "goldenAm" : "goldenPm", at: s.start, end: s.end })),
    spans.sunset && { key: "sunset", at: spans.sunset },
  ].filter(Boolean) as { key: string; at: Date; end?: Date }[];

  async function startCompass() {
    const stop = await listenCompass((o) => setOrient(o));
    if (!stop) return setCompassState("none");
    stopCompass.current = stop;
    setCompassState("on");
  }

  function useHere() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = herePlace(p.coords.latitude, p.coords.longitude);
        setPlace(here);
        rememberPlace(here);
        setLocating(false);
      },
      () => setLocating(false),
      { maximumAge: 600_000, timeout: 15_000 }
    );
  }

  async function checkClouds() {
    setCloudState("loading");
    try {
      const res = await fetch(forecastUrl(place.lat, place.lon));
      if (!res.ok) throw new Error(String(res.status));
      setClouds(parseForecast(await res.json()));
      setCloudState("idle");
    } catch {
      setCloudState("error");
    }
  }

  return (
    <section className="panel stage-sun cx" aria-label={t("tool.sun")}>
      <div className="cx-grid">
        <label className="field">
          <span>{t("walk.place")}</span>
          <select
            value={place.cityId ?? ""}
            onChange={(e) => {
              const p = cityPlace(e.target.value);
              setPlace(p);
              rememberPlace(p);
            }}
          >
            {!place.cityId && <option value="">{place.name}</option>}
            {SORTED_CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.country}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t("sun.day")}</span>
          <select value={dayOffset} onChange={(e) => setDayOffset(Number(e.target.value))}>
            {Array.from({ length: 14 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? t("common.today") : new Intl.DateTimeFormat(langTag(), { weekday: "short", day: "numeric", month: "short" }).format(new Date(now.getTime() + i * 86_400_000))}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" className="cx-link" onClick={useHere} disabled={locating}>
        {locating ? t("sun.locating") : t("sun.useHere")}
      </button>

      <div className="cx-plate sun-read">
        <p className="pp-cert-label">{dateLabel}</p>
        <p className="cx-plate-no">{time(at)}</p>
        <p className="cx-plate-what">
          {sun.altitude > -0.833
            ? t("sun.position", { dir: t(`sun.dir.${dirWord(sun.azimuth)}`), az: Math.round(sun.azimuth), alt: Math.round(sun.altitude) })
            : t("sun.below", { dir: t(`sun.dir.${dirWord(sun.azimuth)}`), az: Math.round(sun.azimuth) })}
        </p>
        <label className="field">
          <span className="sr-only">{t("sun.time")}</span>
          <input type="range" min={0} max={1439} step={5} value={minute} onChange={(e) => setMinute(Number(e.target.value))} aria-label={t("sun.time")} className="sun-slider" />
        </label>
      </div>

      <Compass path={path} at={sun} heading={compassState === "on" ? orient?.heading : undefined} />
      <div className="cx-actions">
        {compassState !== "on" && (
          <button type="button" className="btn" onClick={startCompass}>
            {t("sun.useCompass")}
          </button>
        )}
        <button type="button" className="btn btn-red" onClick={() => (setAr(true), compassState !== "on" && void startCompass())}>
          {t("sun.overCamera")}
        </button>
      </div>
      {compassState === "none" && <p className="cx-quiet">{t("sun.noCompass")}</p>}

      <h2 className="cx-h">{t("sun.moments")}</h2>
      <ul className="fs-list">
        {moments.map((m) => {
          const p = sunPosition(m.at, place.lat, place.lon);
          const c = clouds ? cloudAt(clouds, m.at) : null;
          return (
            <li key={m.key}>
              <span className="fs-name">
                {t(`sun.m.${m.key}`)} · {time(m.at)}
                {m.end ? `–${time(m.end)}` : ""}
              </span>
              <span className="cx-quiet">{t("sun.facing", { dir: t(`sun.dir.${dirWord(p.azimuth)}`), az: Math.round(p.azimuth) })}</span>
              {c && <span className={skyFor(c.total, c.low, c.high) === "lowCloud" ? "fs-exp-warn" : "cx-ok-inline"}>{t(`sun.sky.${skyFor(c.total, c.low, c.high)}`, { n: c.total })}</span>}
              <button type="button" className="cx-link" onClick={() => setMinute(Math.round((m.at.getTime() - start.getTime()) / 60000))}>
                {t("sun.show")}
              </button>
            </li>
          );
        })}
      </ul>
      {moments.length === 0 && <p className="cx-quiet">{t("walk.light.none")}</p>}

      <div className="cx-block">
        <h2 className="pp-h3">{t("sun.clouds")}</h2>
        <p className="cx-quiet">{t("sun.cloudsNote")}</p>
        <div className="cx-actions">
          <button type="button" className="btn" onClick={checkClouds} disabled={cloudState === "loading"}>
            {cloudState === "loading" ? t("sun.loading") : clouds ? t("sun.recheck") : t("sun.check")}
          </button>
        </div>
        {cloudState === "error" && <p className="cx-problem">{t("sun.cloudError")}</p>}
        {clouds && clouds.length > 0 && <p className="cx-quiet">{t("sun.cloudsSource")}</p>}
      </div>

      {ar && <SunOverCamera path={path} at={at} place={place} orient={orient} onClose={() => setAr(false)} time={time} />}
    </section>
  );
}

function Compass({ path, at, heading }: { path: PathPoint[]; at: { azimuth: number; altitude: number }; heading?: number }) {
  const R = 120;
  const pt = (az: number, alt: number) => {
    const c = compassPoint(az, alt);
    return { x: 150 + c.x * R, y: 150 + c.y * R };
  };
  const sunPt = pt(at.azimuth, at.altitude);
  return (
    <div className="sun-compass-wrap">
      <svg viewBox="0 0 300 300" className="sun-compass" role="img" aria-label={t("sun.compassAria")} style={{ transform: heading !== undefined ? `rotate(${-heading}deg)` : undefined }}>
        <circle cx="150" cy="150" r={R} fill="none" stroke="var(--line-strong)" />
        <circle cx="150" cy="150" r={R * (2 / 3)} fill="none" stroke="var(--line)" strokeDasharray="2 4" />
        <circle cx="150" cy="150" r={R / 3} fill="none" stroke="var(--line)" strokeDasharray="2 4" />
        {DIRS.map((d, i) => {
          const p = pt(i * 45, -1);
          const q = { x: 150 + (p.x - 150) * 1.13, y: 150 + (p.y - 150) * 1.13 };
          return (
            <text key={d} x={q.x} y={q.y} textAnchor="middle" dominantBaseline="middle" className={`sun-dir${d === "N" ? " sun-dir-n" : ""}`}>
              {t(`sun.dir.${d}`)}
            </text>
          );
        })}
        {path.slice(1).map((p, i) => {
          const a = pt(path[i].azimuth, path[i].altitude);
          const b = pt(p.azimuth, p.altitude);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={PHASE_COLOUR[p.phase]} strokeWidth={p.phase === "day" ? 2 : 4} strokeLinecap="round" />;
        })}
        <line x1="150" y1="150" x2={sunPt.x} y2={sunPt.y} stroke="var(--red)" strokeWidth="1.5" />
        <circle cx={sunPt.x} cy={sunPt.y} r="9" fill={at.altitude > 0 ? "#f5c542" : "#666"} stroke="#121211" strokeWidth="2" />
      </svg>
      {heading !== undefined && <span className="sun-facing" aria-hidden="true" />}
      <p className="cx-quiet sun-legend">
        <span style={{ color: PHASE_COLOUR.golden }}>●</span> {t("sun.legend.golden")} <span style={{ color: PHASE_COLOUR.blue }}>●</span> {t("sun.legend.blue")}
        {heading !== undefined ? ` · ${t("sun.compassOn")}` : ""}
      </p>
    </div>
  );
}

function SunOverCamera({ path, at, place, orient, onClose, time }: { path: PathPoint[]; at: Date; place: Place; orient: Orientation | null; onClose: () => void; time: (d: Date) => string }) {
  const cam = useCameraStream();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState({ w: 390, h: 700 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void cam.start().then((s) => {
      if (s && videoRef.current) {
        videoRef.current.srcObject = s;
        void videoRef.current.play().catch(() => undefined);
      }
    });
    const onResize = () => wrapRef.current && setSize({ w: wrapRef.current.clientWidth, h: wrapRef.current.clientHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The phone's camera: the assumed horizontal view across the long side, portrait held.
  const portrait = size.h >= size.w;
  const hfov = portrait ? 2 * (Math.atan(Math.tan((ASSUMED_PHONE_FOV_DEG * Math.PI) / 360) * (size.w / size.h)) * 180) / Math.PI : ASSUMED_PHONE_FOV_DEG;
  const vfov = (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) * (size.h / size.w)) * 180) / Math.PI;
  const screen = (az: number, alt: number) => {
    if (!orient) return null;
    const p = project(az, alt, orient.heading, orient.pitch, hfov, vfov);
    return p ? { x: size.w / 2 + (p.x * size.w) / 2, y: size.h / 2 - (p.y * size.h) / 2 } : null;
  };
  const now = sunPosition(at, place.lat, place.lon);
  const nowPt = screen(now.azimuth, now.altitude);
  const hourly = path.filter((p) => p.time.getUTCMinutes() === 0);

  return (
    <div className="sun-ar" role="dialog" aria-modal="true" aria-label={t("sun.overCamera")} ref={wrapRef}>
      <video ref={videoRef} playsInline muted className="sun-ar-video" />
      <svg className="sun-ar-svg" width={size.w} height={size.h} aria-hidden="true">
        {orient &&
          path.slice(1).map((p, i) => {
            const a = screen(path[i].azimuth, path[i].altitude);
            const b = screen(p.azimuth, p.altitude);
            return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={PHASE_COLOUR[p.phase]} strokeWidth={3} strokeLinecap="round" /> : null;
          })}
        {orient &&
          hourly.map((p) => {
            const s = screen(p.azimuth, p.altitude);
            return s ? (
              <g key={p.time.getTime()}>
                <circle cx={s.x} cy={s.y} r="4" fill="#fff" />
                <text x={s.x + 8} y={s.y - 6} className="sun-ar-label">
                  {time(p.time)}
                </text>
              </g>
            ) : null;
          })}
        {nowPt && <circle cx={nowPt.x} cy={nowPt.y} r="16" fill="none" stroke="#f5c542" strokeWidth="3" />}
      </svg>
      <div className="sun-ar-bar">
        <p>
          {!orient ? t("sun.ar.waiting") : t("sun.ar.hint", { time: time(at) })}
          {cam.message ? ` ${cam.message}` : ""}
        </p>
        <button type="button" className="btn" onClick={() => (cam.stop(), onClose())}>
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
