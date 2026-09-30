// Where My collection is kept on this device, shared by the collection page,
// the Passport (#41), the health check (#42) and the museum's "Your
// collection" room. One in-memory copy with subscribers, so a camera added on
// one page shows on the others without a reload.

import { useSyncExternalStore } from "react";
import { getString, setString } from "../services/persistence";
import type { CollectionItem } from "./collection";

export const COLLECTION_KEY = "rangefinder-collection";

export function loadCollection(): CollectionItem[] {
  try {
    const list = JSON.parse(getString(COLLECTION_KEY) ?? "[]") as CollectionItem[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

let current: CollectionItem[] | null = null;
const listeners = new Set<() => void>();

function snapshot(): CollectionItem[] {
  current ??= loadCollection();
  return current;
}

/** Saves and shares the new list. False when storage refused it (it still applies until the page closes). */
export function saveCollection(next: CollectionItem[]): boolean {
  current = next;
  const ok = setString(COLLECTION_KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
  return ok;
}

export function getCollection(): CollectionItem[] {
  return snapshot();
}

export function useCollection(): CollectionItem[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    snapshot
  );
}

/** Test helper: forget the in-memory copy so the next read comes from storage. */
export function __resetCollectionForTest() {
  current = null;
}
