// IndexedDB-backed storage for roll/memory-card frames. Frames carry a
// captured JPEG as a `data:` URL — potentially dozens of them per session —
// which is too large and too numerous for localStorage's ~5-10MB quota.
// IndexedDB's browser-managed quota is far larger and it's built to hold
// exactly this kind of data, so it gets its own small service rather than
// going through services/persistence.ts.
//
// Every call degrades to a no-op/empty result instead of throwing: IndexedDB
// can be unavailable (very old browsers, some private-browsing modes) or a
// write can fail (quota), and neither should block shooting — it should just
// mean this session's frames don't survive a reload, same as any other
// persistence failure in this app.

import type { Frame } from "../state/rollExport";

export type FrameMedium = "film" | "digital";

const DB_NAME = "rangefinder";
// v2 adds the Passport (#41) and Photography Lab (#43) stores.
const DB_VERSION = 2;
const STORE_NAMES: Record<FrameMedium, string> = { film: "filmFrames", digital: "digitalFrames" };
/** Record stores beside the frames: name → key path. */
const RECORD_STORES = { passports: "itemId", labWork: "id" } as const;
export type RecordStore = keyof typeof RECORD_STORES;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available"));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of Object.values(STORE_NAMES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      }
      for (const [name, keyPath] of Object.entries(RECORD_STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open the database"));
  });
  return dbPromise;
}

function withStore<T>(medium: FrameMedium, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return withNamedStore(STORE_NAMES[medium], mode, run);
}

function withNamedStore<T>(name: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(name, mode).objectStore(name);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
      })
  );
}

/** All frames for a medium, oldest (lowest frame number) first. */
export async function loadFrames(medium: FrameMedium): Promise<Frame[]> {
  try {
    const frames = await withStore<Frame[]>(medium, "readonly", (store) => store.getAll() as IDBRequest<Frame[]>);
    return frames.sort((a, b) => a.number - b.number);
  } catch {
    return [];
  }
}

export async function saveFrame(medium: FrameMedium, frame: Frame): Promise<boolean> {
  try {
    await withStore(medium, "readwrite", (store) => store.put(frame));
    return true;
  } catch {
    return false;
  }
}

/** Updates just the note on an already-saved frame; false if that frame isn't stored. */
export async function updateFrameNote(medium: FrameMedium, id: number, note: string): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise<boolean>((resolve, reject) => {
      const store = db.transaction(STORE_NAMES[medium], "readwrite").objectStore(STORE_NAMES[medium]);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as Frame | undefined;
        if (!existing) {
          resolve(false);
          return;
        }
        const putReq = store.put({ ...existing, note });
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error ?? new Error("IndexedDB request failed"));
      };
      getReq.onerror = () => reject(getReq.error ?? new Error("IndexedDB request failed"));
    });
  } catch {
    return false;
  }
}

export async function clearFrames(medium: FrameMedium): Promise<boolean> {
  try {
    await withStore(medium, "readwrite", (store) => store.clear());
    return true;
  } catch {
    return false;
  }
}

/** Every record in a store (passports, lab work); empty when storage is unavailable. */
export async function loadRecords<T>(store: RecordStore): Promise<T[]> {
  try {
    return await withNamedStore<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
  } catch {
    return [];
  }
}

export async function saveRecord<T>(store: RecordStore, record: T): Promise<boolean> {
  try {
    await withNamedStore(store, "readwrite", (s) => s.put(record));
    return true;
  } catch {
    return false;
  }
}

export async function deleteRecord(store: RecordStore, key: string): Promise<boolean> {
  try {
    await withNamedStore(store, "readwrite", (s) => s.delete(key));
    return true;
  } catch {
    return false;
  }
}

/** Every store the app keeps, for backups (#56). */
export const ALL_STORES = [...Object.values(STORE_NAMES), ...Object.keys(RECORD_STORES)];

/** All records of one store (any kind); empty when storage is unavailable. */
export async function dumpStore(name: string): Promise<unknown[]> {
  try {
    return await withNamedStore<unknown[]>(name, "readonly", (s) => s.getAll() as IDBRequest<unknown[]>);
  } catch {
    return [];
  }
}

/** Replaces a store's records with these (restoring a backup). */
export async function replaceStore(name: string, records: unknown[]): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(name, "readwrite");
      const store = tx.objectStore(name);
      store.clear();
      for (const r of records) store.put(r);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    });
  } catch {
    return false;
  }
}
