// A place for the sun tools (#44, #50): a city from the app's list, or the
// phone's own position named by the nearest city. Kept on this device; the
// Light planner's saved position is used when there is one.

import { CITIES, nearestCity } from "../data/cities";
import { getString, setString } from "../services/persistence";

export interface Place {
  name: string;
  lat: number;
  lon: number;
  /** IANA time zone, so times read as local clock time there. */
  tz: string;
  cityId?: string;
}

const KEY = "rangefinder-sun-place";
const HERE_KEY = "rangefinder-light-here";

export function cityPlace(id: string): Place {
  const c = CITIES.find((x) => x.id === id) ?? CITIES.find((x) => x.id === "london") ?? CITIES[0];
  return { name: `${c.name}, ${c.country}`, lat: c.lat, lon: c.lon, tz: c.tz, cityId: c.id };
}

function read(key: string): Place | null {
  try {
    const p = JSON.parse(getString(key) ?? "null") as Place | null;
    return p && typeof p.lat === "number" && typeof p.lon === "number" ? p : null;
  } catch {
    return null;
  }
}

export function savedPlace(): Place {
  return read(KEY) ?? read(HERE_KEY) ?? cityPlace("london");
}

export function rememberPlace(p: Place): void {
  setString(KEY, JSON.stringify(p));
}

/** The phone's position, named after the nearest city. */
export function herePlace(lat: number, lon: number): Place {
  const n = nearestCity(lat, lon);
  return { name: n.km < 30 ? `${n.city.name}, ${n.city.country}` : `${n.city.name}, ${n.city.country} (${Math.round(n.km)} km)`, lat, lon, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

export const SORTED_CITIES = [...CITIES].sort((a, b) => a.name.localeCompare(b.name));
