// Photo walks (#44): a theme, one lens set up for zone focus, a list of
// pictures to find, and the best light for it today. A walk travels as a
// link (everything in the URL, nothing on a server), so a friend or a
// club opens the same walk, and a meeting place and time can go with it.
// The walk itself (time, distance, what you found) stays on this device.

import { depthOfField } from "../physics/optics";
import type { SunDay, Phase } from "../physics/sun";
import { distanceKm } from "../data/cities";

export type LightWish = "golden" | "day" | "night" | "any";

export interface WalkTheme {
  id: string;
  focalMm: number;
  fNumber: number;
  zoneM: number;
  light: LightWish;
  /** How many prompts it has in the dictionaries (walk.theme.<id>.p1 …). */
  prompts: number;
  minutes: number;
}

/** The app's own walk themes; their words live in the dictionaries. */
export const THEMES: WalkTheme[] = [
  { id: "decisive", focalMm: 50, fNumber: 8, zoneM: 3, light: "day", prompts: 6, minutes: 60 },
  { id: "shadows", focalMm: 35, fNumber: 11, zoneM: 3, light: "day", prompts: 6, minutes: 60 },
  { id: "close", focalMm: 28, fNumber: 8, zoneM: 1.5, light: "day", prompts: 6, minutes: 45 },
  { id: "golden", focalMm: 50, fNumber: 4, zoneM: 5, light: "golden", prompts: 6, minutes: 45 },
  { id: "reflections", focalMm: 35, fNumber: 5.6, zoneM: 3, light: "any", prompts: 6, minutes: 60 },
  { id: "night", focalMm: 35, fNumber: 2.8, zoneM: 3, light: "night", prompts: 6, minutes: 45 },
  { id: "geometry", focalMm: 28, fNumber: 11, zoneM: 2, light: "day", prompts: 6, minutes: 60 },
];

export interface Walk {
  v: 1;
  /** A theme id, or "own" for a walk someone wrote. */
  theme: string;
  title?: string;
  focalMm: number;
  fNumber: number;
  zoneM: number;
  /** Own walks: the prompts as written. Themed walks use the theme's. */
  prompts?: string[];
  /** Where to meet, as the organiser wrote it. */
  meet?: string;
  /** When to meet, "YYYY-MM-DDTHH:MM" local time. */
  when?: string;
  minutes: number;
}

export function walkFromTheme(theme: WalkTheme): Walk {
  return { v: 1, theme: theme.id, focalMm: theme.focalMm, fNumber: theme.fNumber, zoneM: theme.zoneM, minutes: theme.minutes };
}

export function themeOf(walk: Walk): WalkTheme | undefined {
  return THEMES.find((t) => t.id === walk.theme);
}

/** Prompt keys (themed) or texts (own). */
export function promptsOf(walk: Walk): { key?: string; text?: string }[] {
  const theme = themeOf(walk);
  if (theme && !walk.prompts) return Array.from({ length: theme.prompts }, (_, i) => ({ key: `walk.theme.${theme.id}.p${i + 1}` }));
  return (walk.prompts ?? []).map((text) => ({ text }));
}

/** The sharp zone of the walk's setting, in metres. */
export function walkZone(walk: Walk, cocMm = 0.03): { nearM: number; farM: number } {
  const d = depthOfField(walk.focalMm, walk.fNumber, cocMm, walk.zoneM * 1000);
  return { nearM: d.nearMm / 1000, farM: d.farMm / 1000 };
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : undefined);
const inRange = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;

/** Checks and tidies a walk from a link: bounded strings, sane numbers. */
export function cleanWalk(raw: unknown): Walk | null {
  const w = raw as Partial<Walk> | null;
  if (!w || w.v !== 1 || typeof w.theme !== "string") return null;
  if (!inRange(w.focalMm, 10, 400) || !inRange(w.fNumber, 0.9, 32) || !inRange(w.zoneM, 0.5, 100) || !inRange(w.minutes, 5, 600)) return null;
  const own = w.theme === "own";
  if (!own && !THEMES.some((t) => t.id === w.theme)) return null;
  const prompts = Array.isArray(w.prompts) ? w.prompts.map((p) => clip(p, 140)).filter((p): p is string => !!p && !!p.trim()).slice(0, 12) : undefined;
  if (own && !prompts?.length) return null;
  const when = typeof w.when === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(w.when) ? w.when : undefined;
  return {
    v: 1,
    theme: w.theme,
    title: clip(w.title, 80)?.trim() || undefined,
    focalMm: w.focalMm!,
    fNumber: w.fNumber!,
    zoneM: w.zoneM!,
    prompts,
    meet: clip(w.meet, 140)?.trim() || undefined,
    when,
    minutes: Math.round(w.minutes!),
  };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeWalk(walk: Walk): string {
  return toBase64Url(JSON.stringify(walk));
}

export function decodeWalk(code: string): Walk | null {
  try {
    return cleanWalk(JSON.parse(fromBase64Url(code)));
  } catch {
    return null;
  }
}

/** The link that opens this walk: the page's own address with `#/shoot/walks?w=…`. */
export function walkLink(walk: Walk, base: string): string {
  return `${base.split("#")[0]}#/shoot/walks?w=${encodeWalk(walk)}`;
}

const WANT: Record<LightWish, Phase[]> = { golden: ["golden"], day: ["day"], night: ["blue", "night"], any: ["golden", "day", "blue"] };

/** The next span of the light a walk wants, from `now`, in the day given. */
export function nextLight(day: SunDay, wish: LightWish, now: Date): { start: Date; end: Date; phase: Phase } | null {
  const minutes = 30 * 60_000;
  for (const s of day.spans) {
    if (!WANT[wish].includes(s.phase)) continue;
    const end = s.end.getTime();
    if (end - Math.max(now.getTime(), s.start.getTime()) < minutes) continue;
    return { start: new Date(Math.max(now.getTime(), s.start.getTime())), end: s.end, phase: s.phase };
  }
  return null;
}

/** Distance along a GPS track, ignoring jumps from poor fixes. */
export function trackMetres(points: { lat: number; lon: number; accuracy?: number }[]): number {
  let m = 0;
  let prev: (typeof points)[number] | null = null;
  for (const p of points) {
    if (p.accuracy !== undefined && p.accuracy > 50) continue;
    if (prev) {
      const d = distanceKm(prev.lat, prev.lon, p.lat, p.lon) * 1000;
      // Fewer than 3 m is GPS jitter; more than 500 m between fixes is a jump.
      if (d >= 3 && d < 500) m += d;
      if (d < 3) continue;
    }
    prev = p;
  }
  return m;
}

export interface WalkLog {
  id: string;
  walk: Walk;
  startedAt: string;
  endedAt?: string;
  /** Indexes of the prompts found. */
  found: number[];
  metres: number;
}
