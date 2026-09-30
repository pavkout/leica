// Photography Lab work (#43): the latest hand-in for each exercise, with a
// small copy of the photo, kept in IndexedDB on this device.

import { useSyncExternalStore } from "react";
import { loadRecords, saveRecord } from "../services/db";
import type { RealShot } from "../data/labCourse";

export interface LabWork {
  /** The exercise id. */
  id: string;
  passed: boolean;
  /** The photographer's own look: did the picture show what was predicted? */
  looksRight: boolean;
  shot: RealShot;
  /** Where the settings came from. */
  source: "exif" | "typed";
  /** Small JPEG. */
  photo?: string;
  camera?: string;
  lens?: string;
  /** ISO time handed in. */
  at: string;
}

let work: ReadonlyMap<string, LabWork> = new Map();
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function ensureLoaded() {
  loaded ??= loadRecords<LabWork>("labWork").then((list) => {
    work = new Map([...list.map((w) => [w.id, w] as const), ...work]);
    listeners.forEach((l) => l());
  });
}

export function useLabWork(): ReadonlyMap<string, LabWork> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      ensureLoaded();
      return () => listeners.delete(l);
    },
    () => work,
    () => work
  );
}

export async function handIn(w: LabWork): Promise<boolean> {
  // A pass stays a pass: a later, weaker attempt doesn't undo it.
  const prev = work.get(w.id);
  const next = prev?.passed && !w.passed ? { ...w, passed: true } : w;
  work = new Map(work).set(w.id, next);
  listeners.forEach((l) => l());
  return saveRecord("labWork", next);
}
