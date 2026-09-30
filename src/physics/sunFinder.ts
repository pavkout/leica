// Sun finder (#50): the sun's path across a day, drawn over the live camera
// or on a compass, and a plain reading of the forecast clouds for the golden
// hours. Pure logic; the page supplies the phone's heading and tilt.

import { phaseAt, sunPosition, type Phase } from "./sun";

export interface PathPoint {
  time: Date;
  altitude: number;
  azimuth: number;
  phase: Phase;
}

/** The sun every `stepMin` minutes through the 24 hours from `from`, while it's no lower than the blue hour. */
export function dayPath(from: Date, lat: number, lon: number, stepMin = 10): PathPoint[] {
  const out: PathPoint[] = [];
  for (let m = 0; m <= 1440; m += stepMin) {
    const time = new Date(from.getTime() + m * 60_000);
    const { altitude, azimuth } = sunPosition(time, lat, lon);
    if (altitude >= -6) out.push({ time, altitude, azimuth, phase: phaseAt(altitude) });
  }
  return out;
}

/** Signed difference between two bearings, −180…180. */
export function bearingDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

/**
 * Where a point in the sky lands on the camera's screen: x and y from −1
 * (left, bottom) to 1 (right, top), or null when it's outside the view.
 * `heading` is where the camera points (compass degrees), `pitch` its tilt
 * above the horizon; the fields of view are the phone camera's.
 */
export function project(azimuth: number, altitude: number, heading: number, pitch: number, hfovDeg: number, vfovDeg: number): { x: number; y: number } | null {
  const dAz = bearingDiff(azimuth, heading);
  if (Math.abs(dAz) >= 89) return null;
  const x = Math.tan((dAz * Math.PI) / 180) / Math.tan((hfovDeg / 2) * (Math.PI / 180));
  const y = Math.tan(((altitude - pitch) * Math.PI) / 180) / Math.tan((vfovDeg / 2) * (Math.PI / 180));
  if (Math.abs(x) > 1.2 || Math.abs(y) > 1.2) return null;
  return { x, y };
}

/** A compass bearing as a point on a circle of radius 1 (north up). */
export function compassPoint(azimuth: number, altitude: number): { x: number; y: number } {
  // Higher sun sits nearer the centre, the horizon on the rim.
  const r = Math.max(0, Math.min(1, 1 - Math.max(0, altitude) / 90));
  const a = (azimuth * Math.PI) / 180;
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
}

export type Sky = "clear" | "someHigh" | "broken" | "overcast" | "lowCloud";

/**
 * A plain reading of the cloud forecast (percent cover) for a golden hour.
 * A rule of thumb, and the page says so: high thin cloud catches colour, a
 * low bank on the horizon hides the sun.
 */
export function skyFor(total: number, low: number, high: number): Sky {
  if (low >= 70) return "lowCloud";
  if (total >= 90) return "overcast";
  if (total <= 20) return "clear";
  if (high >= 25 && low < 40) return "someHigh";
  return "broken";
}

/** The Open-Meteo request for a place (coordinates rounded to about a kilometre). */
export function forecastUrl(lat: number, lon: number): string {
  const r = (x: number) => Math.round(x * 100) / 100;
  return `https://api.open-meteo.com/v1/forecast?latitude=${r(lat)}&longitude=${r(lon)}&hourly=cloud_cover,cloud_cover_low,cloud_cover_high&forecast_days=3&timezone=UTC`;
}

export interface HourCloud {
  time: Date;
  total: number;
  low: number;
  high: number;
}

/** Reads the forecast reply; empty if it isn't the expected shape. */
export function parseForecast(json: unknown): HourCloud[] {
  const h = (json as { hourly?: { time?: string[]; cloud_cover?: number[]; cloud_cover_low?: number[]; cloud_cover_high?: number[] } })?.hourly;
  if (!h?.time || !h.cloud_cover) return [];
  return h.time.map((t, i) => ({
    time: new Date(`${t}Z`),
    total: h.cloud_cover![i] ?? 0,
    low: h.cloud_cover_low?.[i] ?? 0,
    high: h.cloud_cover_high?.[i] ?? 0,
  }));
}

/** The forecast hour nearest to an instant. */
export function cloudAt(list: HourCloud[], at: Date): HourCloud | null {
  let best: HourCloud | null = null;
  for (const c of list) if (!best || Math.abs(c.time.getTime() - at.getTime()) < Math.abs(best.time.getTime() - at.getTime())) best = c;
  return best && Math.abs(best.time.getTime() - at.getTime()) <= 90 * 60_000 ? best : null;
}
