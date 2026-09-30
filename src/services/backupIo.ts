// Reads and writes the device for backups (#56): local storage and every
// IndexedDB store. Restoring replaces the app's data; the page reloads after,
// so every page starts from the restored state.

import { ALL_STORES, dumpStore, replaceStore } from "./db";
import { LAST_BACKUP_KEY, buildBackup, keepKey, type Backup } from "../state/backup";

export function readLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) out[k] = localStorage.getItem(k) ?? "";
    }
  } catch {
    // Storage unavailable: nothing to read.
  }
  return out;
}

export async function makeBackup(now = new Date()): Promise<Backup> {
  const idb: Record<string, unknown[]> = {};
  for (const s of ALL_STORES) idb[s] = await dumpStore(s);
  return buildBackup(readLocal(), idb, now);
}

export function markBackedUp(now = new Date()): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, now.toISOString());
  } catch {
    // Not remembered; the reminder will simply come back.
  }
}

export function lastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

/** Replaces this device's app data with the backup's. The AI key, if any, is left as it is. */
export async function restoreBackup(b: Backup): Promise<boolean> {
  try {
    for (const k of Object.keys(readLocal())) if (keepKey(k)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(b.local)) localStorage.setItem(k, v);
  } catch {
    return false;
  }
  let ok = true;
  for (const s of ALL_STORES) ok = (await replaceStore(s, b.idb[s] ?? [])) && ok;
  return ok;
}
