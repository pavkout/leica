// Film stock (#48): the film in the fridge, the roll in each camera, and the
// rolls waiting to be developed. Pure logic; the page keeps it on this device.

export type Format = "135" | "120" | "other";

export interface StockItem {
  id: string;
  film: string;
  /** The app's film, when it's one of them. */
  filmId?: string;
  format: Format;
  /** Exposures per roll (135: 36 or 24; 120: 12 on 6×6). */
  exposures: number;
  iso: number;
  count: number;
  /** "YYYY-MM", as printed on the box. */
  expires?: string;
  note?: string;
}

export interface Roll {
  id: string;
  film: string;
  filmId?: string;
  iso: number;
  /** The speed it's being shot at (push or pull when it differs from `iso`). */
  ei: number;
  exposures: number;
  camera: string;
  loadedAt: string;
  frames: number;
  finishedAt?: string;
  developedAt?: string;
  note?: string;
}

export interface FilmState {
  stock: StockItem[];
  rolls: Roll[];
}

export const EMPTY: FilmState = { stock: [], rolls: [] };

const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Months from `today` to the end of the expiry month (negative once expired). */
export function monthsToExpiry(expires: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(expires);
  if (!m) return null;
  return (Number(m[1]) - today.getFullYear()) * 12 + (Number(m[2]) - (today.getMonth() + 1));
}

export type Expiry = "ok" | "soon" | "expired" | "unknown";

/** Expired after its month; "soon" within the next three. */
export function expiry(item: Pick<StockItem, "expires">, today: Date): Expiry {
  if (!item.expires) return "unknown";
  const n = monthsToExpiry(item.expires, today);
  if (n === null) return "unknown";
  return n < 0 ? "expired" : n <= 3 ? "soon" : "ok";
}

export function addStock(s: FilmState, item: Omit<StockItem, "id">): FilmState {
  // The same film, format and expiry adds to the pile rather than making a second line.
  const same = s.stock.find((x) => x.film === item.film && x.format === item.format && x.exposures === item.exposures && x.expires === item.expires);
  if (same) return { ...s, stock: s.stock.map((x) => (x === same ? { ...x, count: x.count + item.count } : x)) };
  return { ...s, stock: [...s.stock, { ...item, id: newId("s") }] };
}

export function setCount(s: FilmState, id: string, count: number): FilmState {
  return { ...s, stock: count <= 0 ? s.stock.filter((x) => x.id !== id) : s.stock.map((x) => (x.id === id ? { ...x, count } : x)) };
}

/** Loads a roll from the fridge (or from outside it) into a camera. A camera holds one roll at a time. */
export function loadRoll(s: FilmState, from: StockItem | Omit<StockItem, "id" | "count">, camera: string, ei: number, now = new Date()): FilmState {
  const roll: Roll = { id: newId("r"), film: from.film, filmId: from.filmId, iso: from.iso, ei, exposures: from.exposures, camera: camera.trim(), loadedAt: now.toISOString(), frames: 0 };
  const stock = "id" in from ? setCount(s, from.id, from.count - 1).stock : s.stock;
  return { stock, rolls: [...s.rolls, roll] };
}

export function inCamera(s: FilmState): Roll[] {
  return s.rolls.filter((r) => !r.finishedAt);
}

export function toDevelop(s: FilmState): Roll[] {
  return s.rolls.filter((r) => r.finishedAt && !r.developedAt);
}

export function developed(s: FilmState): Roll[] {
  return s.rolls.filter((r) => r.developedAt).sort((a, b) => b.developedAt!.localeCompare(a.developedAt!));
}

/** Cameras with a roll in them: loading another would be a mistake the page warns about. */
export function loadedCameras(s: FilmState): Set<string> {
  return new Set(inCamera(s).map((r) => r.camera.toLowerCase()));
}

export function countFrame(s: FilmState, id: string, by = 1): FilmState {
  return { ...s, rolls: s.rolls.map((r) => (r.id === id ? { ...r, frames: Math.max(0, Math.min(r.exposures + 2, r.frames + by)) } : r)) };
}

export function finishRoll(s: FilmState, id: string, now = new Date()): FilmState {
  return { ...s, rolls: s.rolls.map((r) => (r.id === id ? { ...r, finishedAt: now.toISOString() } : r)) };
}

export function markDeveloped(s: FilmState, id: string, now = new Date()): FilmState {
  return { ...s, rolls: s.rolls.map((r) => (r.id === id ? { ...r, developedAt: now.toISOString() } : r)) };
}

export function removeRoll(s: FilmState, id: string): FilmState {
  return { ...s, rolls: s.rolls.filter((r) => r.id !== id) };
}

/** Rolls in the fridge, by expiry: expired and soonest first. */
export function sortedStock(s: FilmState, today: Date): StockItem[] {
  const rank: Record<Expiry, number> = { expired: 0, soon: 1, ok: 2, unknown: 3 };
  return [...s.stock].sort((a, b) => rank[expiry(a, today)] - rank[expiry(b, today)] || (a.expires ?? "9999").localeCompare(b.expires ?? "9999") || a.film.localeCompare(b.film));
}

export function totalRolls(s: FilmState): number {
  return s.stock.reduce((n, x) => n + x.count, 0);
}

/** Pushed or pulled, in stops, from how it's rated against the box speed. */
export function pushStops(r: Pick<Roll, "iso" | "ei">): number {
  return Math.round(Math.log2(r.ei / r.iso) * 3) / 3;
}
