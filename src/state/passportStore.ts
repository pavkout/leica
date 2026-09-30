// Passports on this device (#41), kept in IndexedDB (they carry photos) and
// shared between the Passport page, the health check and My collection.

import { useSyncExternalStore } from "react";
import { deleteRecord, loadRecords, saveRecord } from "../services/db";
import type { Passport } from "./passport";

let byItem: ReadonlyMap<string, Passport> = new Map();
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function ensureLoaded() {
  loaded ??= loadRecords<Passport>("passports").then((list) => {
    // Anything written before the load finished wins over what was stored.
    byItem = new Map([...list.map((p) => [p.itemId, p] as const), ...byItem]);
    emit();
  });
  return loaded;
}

export function usePassports(): ReadonlyMap<string, Passport> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void ensureLoaded();
      return () => listeners.delete(l);
    },
    () => byItem,
    () => byItem
  );
}

export async function getPassport(itemId: string): Promise<Passport | undefined> {
  await ensureLoaded();
  return byItem.get(itemId);
}

/** Saves and shares. False when the device refused it (it still applies until the page closes). */
export async function putPassport(p: Passport): Promise<boolean> {
  byItem = new Map(byItem).set(p.itemId, p);
  emit();
  return saveRecord("passports", p);
}

export async function removePassport(itemId: string): Promise<boolean> {
  const next = new Map(byItem);
  next.delete(itemId);
  byItem = next;
  emit();
  return deleteRecord("passports", itemId);
}
