// Backup and restore (#56): everything the app keeps on this device, in one
// file: the saved settings and lists (local storage, "rangefinder-…") and the
// larger records (IndexedDB: film frames, passports, Lab work). The AI key is
// left out on purpose, so a backup kept in a cloud folder can't spend money;
// the owner pastes it again after a restore. Pure logic; services/backupIo.ts
// reads and writes the device.

export const PREFIX = "rangefinder-";
/** Never written into a backup. */
export const EXCLUDED = new Set(["rangefinder-ai-key", "rangefinder-dev-run", "rangefinder-walk-active", "rangefinder-kiosk", "rangefinder-backup-snooze"]);
export const LAST_BACKUP_KEY = "rangefinder-last-backup";
export const REMIND_AFTER_DAYS = 30;

export interface Backup {
  format: "leica.rt-backup";
  version: 1;
  createdAt: string;
  local: Record<string, string>;
  idb: Record<string, unknown[]>;
}

export function keepKey(key: string): boolean {
  return key.startsWith(PREFIX) && !EXCLUDED.has(key) && key !== LAST_BACKUP_KEY;
}

export function buildBackup(local: Record<string, string>, idb: Record<string, unknown[]>, now = new Date()): Backup {
  const kept: Record<string, string> = {};
  for (const [k, v] of Object.entries(local)) if (keepKey(k)) kept[k] = v;
  return { format: "leica.rt-backup", version: 1, createdAt: now.toISOString(), local: kept, idb };
}

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; reason: "notBackup" | "newer" | "damaged" };

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "notBackup" };
  }
  const b = raw as Partial<Backup>;
  if (!b || b.format !== "leica.rt-backup") return { ok: false, reason: "notBackup" };
  if (typeof b.version !== "number" || b.version > 1) return { ok: false, reason: "newer" };
  if (!b.local || typeof b.local !== "object" || !b.idb || typeof b.idb !== "object") return { ok: false, reason: "damaged" };
  for (const [k, v] of Object.entries(b.local)) if (!keepKey(k) || typeof v !== "string") return { ok: false, reason: "damaged" };
  for (const v of Object.values(b.idb)) if (!Array.isArray(v)) return { ok: false, reason: "damaged" };
  return { ok: true, backup: b as Backup };
}

const count = (json: string | undefined, path?: string): number => {
  if (!json) return 0;
  try {
    const x = JSON.parse(json) as unknown;
    const v = path ? (x as Record<string, unknown>)?.[path] : x;
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
};

export interface Summary {
  items: number;
  passports: number;
  shotLog: number;
  filmRolls: number;
  lab: number;
  frames: number;
  walks: number;
}

/** What a backup holds, in plain counts, before it's restored. */
export function summarize(b: Pick<Backup, "local" | "idb">): Summary {
  return {
    items: count(b.local["rangefinder-collection"]),
    passports: b.idb.passports?.length ?? 0,
    shotLog: count(b.local["rangefinder-shot-log"]),
    filmRolls: count(b.local["rangefinder-film-stock"], "rolls"),
    lab: b.idb.labWork?.length ?? 0,
    frames: (b.idb.filmFrames?.length ?? 0) + (b.idb.digitalFrames?.length ?? 0),
    walks: count(b.local["rangefinder-walk-log"]),
  };
}

/** "leica-rt-backup-2026-09-30.json". */
export function backupName(now = new Date()): string {
  return `leica-rt-backup-${now.toISOString().slice(0, 10)}.json`;
}

/** Days since the last backup; null if never. */
export function daysSinceBackup(last: string | null, now = new Date()): number | null {
  if (!last) return null;
  const t = Date.parse(last);
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 86_400_000);
}

/** Whether to remind: there's something worth keeping, and no backup in a month. */
export function shouldRemind(local: Record<string, string>, last: string | null, now = new Date()): boolean {
  const worth = count(local["rangefinder-collection"]) + count(local["rangefinder-shot-log"]) + count(local["rangefinder-film-stock"], "stock") > 0;
  const days = daysSinceBackup(last, now);
  return worth && (days === null || days >= REMIND_AFTER_DAYS);
}
