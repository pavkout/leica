import { useEffect, useMemo, useState } from "react";
import { formatShutter, type Lens } from "../data/gear";
import { handheldLimit, lightSetting } from "../physics/pocketCard";
import { sunDay, type Phase } from "../physics/sun";
import { getString, setString } from "../services/persistence";
import { formatFNumber } from "../utils/format";

interface Props {
  lens: Lens;
  stops: number[];
  speeds: number[];
  iso: number;
  filmLabel: string;
}

interface Place {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** IANA time zone, so times read as local clock time there. */
  tz: string;
}

/** A few photographers' cities; coordinates are the city centres. */
const PLACES: Place[] = [
  { id: "wetzlar", name: "Wetzlar", lat: 50.556, lon: 8.504, tz: "Europe/Berlin" },
  { id: "amsterdam", name: "Amsterdam", lat: 52.373, lon: 4.893, tz: "Europe/Amsterdam" },
  { id: "athens", name: "Athens", lat: 37.984, lon: 23.728, tz: "Europe/Athens" },
  { id: "london", name: "London", lat: 51.507, lon: -0.128, tz: "Europe/London" },
  { id: "paris", name: "Paris", lat: 48.857, lon: 2.352, tz: "Europe/Paris" },
  { id: "lisbon", name: "Lisbon", lat: 38.722, lon: -9.139, tz: "Europe/Lisbon" },
  { id: "new-york", name: "New York", lat: 40.713, lon: -74.006, tz: "America/New_York" },
  { id: "los-angeles", name: "Los Angeles", lat: 34.052, lon: -118.244, tz: "America/Los_Angeles" },
  { id: "tokyo", name: "Tokyo", lat: 35.676, lon: 139.65, tz: "Asia/Tokyo" },
];

const PLACE_KEY = "rangefinder-light-place";

/**
 * Typical scene brightness in each phase. Day and night are rows of the
 * standard EV guide; golden and blue hour sit between them and change by the
 * minute, so these are approximate starting points, and the page says so.
 */
const PHASE_LIGHT: Record<Phase, { ev: number; label: string; note: string }> = {
  day: { ev: 15, label: "Daylight", note: "Bright sun (EV 15); a stop or two more under cloud" },
  golden: { ev: 11, label: "Golden hour", note: "Low, warm sun: about EV 12 falling to 9 at sunset (approximate)" },
  blue: { ev: 5, label: "Blue hour", note: "Deep blue sky and first street lights: about EV 5 (approximate)" },
  night: { ev: 3, label: "Night", note: "Street lights only (EV 3)" },
};

const PHASE_ORDER: Phase[] = ["golden", "day", "blue", "night"];

/** Midnight at the start of `day` (offset from today) in a time zone, as an instant. */
function midnightIn(tz: string, dayOffset: number): Date {
  const now = new Date(Date.now() + dayOffset * 86_400_000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  // The zone's current offset: its wall clock minus UTC.
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const offset = wall - Math.floor(now.getTime() / 60_000) * 60_000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset);
}

/**
 * When the light is good today, drawn as a 24-hour dial: night, blue hour,
 * golden hour and day, with a hand at the current time and the settings for
 * each phase at the film's speed.
 */
export default function LightPlanner({ lens, stops, speeds, iso, filmLabel }: Props) {
  const [placeId, setPlaceId] = useState(() => getString(PLACE_KEY) ?? "amsterdam");
  const [here, setHere] = useState<Place | null>(null);
  const [locating, setLocating] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const place = placeId === "here" && here ? here : PLACES.find((p) => p.id === placeId) ?? PLACES[1];
  const from = useMemo(() => midnightIn(place.tz, dayOffset), [place.tz, dayOffset]);
  const day = useMemo(() => sunDay(from, place.lat, place.lon), [from, place.lat, place.lon]);
  const time = (d: Date | null) => (d ? new Intl.DateTimeFormat(undefined, { timeZone: place.tz, hour: "2-digit", minute: "2-digit" }).format(d) : "none");
  const limit = handheldLimit(lens.focalMm, speeds);

  function locate() {
    if (!("geolocation" in navigator)) return setLocating("This browser can't share your location. Pick the nearest city instead.");
    setLocating("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ id: "here", name: "Where you are", lat: pos.coords.latitude, lon: pos.coords.longitude, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
        setPlaceId("here");
        setLocating(null);
      },
      () => setLocating("Location wasn't shared. Pick the nearest city instead."),
      { maximumAge: 600_000, timeout: 10_000 },
    );
  }

  // The dial: 24 hours round the circle, midnight at the bottom, noon at the top.
  const R = 120;
  const C = 150;
  const angle = (d: Date) => ((d.getTime() - from.getTime()) / 86_400_000) * 2 * Math.PI + Math.PI / 2;
  const pt = (a: number, r: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
  const arc = (a0: number, a1: number, r: number) => {
    const [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r);
    return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
  };
  const nowDate = new Date(now);
  const showNow = dayOffset === 0 && nowDate >= from && nowDate.getTime() < from.getTime() + 86_400_000;
  const nextGolden = day.spans.find((s) => s.phase === "golden" && s.end.getTime() > now);

  return (
    <section className="panel stage-light" aria-label="Light planner">
      <div className="lp-places">
        <div className="field">
          <span>Where</span>
          <select
            value={placeId}
            onChange={(e) => {
              setPlaceId(e.target.value);
              if (e.target.value !== "here") setString(PLACE_KEY, e.target.value);
            }}
          >
            {here && <option value="here">Where you are</option>}
            {PLACES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn" onClick={locate}>
          Use my location
        </button>
      </div>
      {locating && <p className="muted small">{locating}</p>}

      <div className="lp-main">
        <figure className="lp-dial">
          <svg viewBox="0 0 300 300" role="img" aria-label={`Sunrise ${time(day.sunrise)}, sunset ${time(day.sunset)}`}>
            <circle cx={C} cy={C} r={R + 18} className="lp-bezel" />
            {day.spans.map((s, i) => (
              <path key={i} d={arc(angle(s.start), angle(s.end), R)} className={`lp-arc lp-arc-${s.phase}`} />
            ))}
            {Array.from({ length: 24 }, (_, h) => {
              const a = (h / 24) * 2 * Math.PI + Math.PI / 2;
              const [x0, y0] = pt(a, R + 12);
              const [x1, y1] = pt(a, R + (h % 6 === 0 ? 20 : 16));
              return <line key={h} x1={x0} y1={y0} x2={x1} y2={y1} className="lp-tick" />;
            })}
            {[0, 6, 12, 18].map((h) => {
              const [x, y] = pt((h / 24) * 2 * Math.PI + Math.PI / 2, R - 22);
              return (
                <text key={h} x={x} y={y + 4} className="lp-hour" textAnchor="middle">
                  {String(h).padStart(2, "0")}
                </text>
              );
            })}
            {showNow &&
              (() => {
                const [x, y] = pt(angle(nowDate), R + 8);
                return <line x1={C} y1={C} x2={x} y2={y} className="lp-hand" />;
              })()}
            <circle cx={C} cy={C} r={4} className="lp-pin" />
          </svg>
          <figcaption className="lp-times">
            <span>
              <b>{time(day.sunrise)}</b> sunrise
            </span>
            <span>
              <b>{time(day.sunset)}</b> sunset
            </span>
          </figcaption>
        </figure>

        <div className="lp-side">
          <div className="lp-day">
            <button type="button" className="btn btn-small" onClick={() => setDayOffset((d) => d - 1)} aria-label="Previous day">
              ‹
            </button>
            <p>{new Intl.DateTimeFormat(undefined, { timeZone: place.tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(from.getTime() + 12 * 3_600_000))}</p>
            <button type="button" className="btn btn-small" onClick={() => setDayOffset((d) => d + 1)} aria-label="Next day">
              ›
            </button>
          </div>
          {nextGolden && dayOffset === 0 && (
            <p className="lp-next">
              {nextGolden.start.getTime() <= now ? "Golden hour now, until " : "Next golden hour at "}
              <b>{time(nextGolden.start.getTime() <= now ? nextGolden.end : nextGolden.start)}</b>
            </p>
          )}
          <ul className="lp-phases">
            {PHASE_ORDER.map((ph) => {
              const spans = day.spans.filter((s) => s.phase === ph);
              if (!spans.length) return null;
              const set = lightSetting(PHASE_LIGHT[ph].ev, { stops, speeds, iso, slowestHandheldSec: limit });
              return (
                <li key={ph} className={`lp-phase lp-phase-${ph}`}>
                  <p className="lp-phase-name">
                    <i aria-hidden="true" /> {PHASE_LIGHT[ph].label}
                  </p>
                  <p className="lp-phase-when">{spans.map((s) => `${time(s.start)}–${time(s.end)}`).join(", ")}</p>
                  <p className="lp-phase-set">
                    {formatFNumber(set.fNumber)} · {formatShutter(set.shutterSec)}
                    {set.needsSupport && <span className="pc-support"> brace</span>}
                  </p>
                  <p className="muted small">{PHASE_LIGHT[ph].note}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <p className="hint">
        Sun positions calculated for {place.name} (NOAA solar equations), times in {place.id === "here" ? "your time zone" : `${place.name} time`}. Settings for{" "}
        {filmLabel} at ISO {iso} with the {lens.focalMm} mm, kept hand-holdable where the light allows. Golden and blue hour light changes by
        the minute: meter when you can.
      </p>
    </section>
  );
}
