// The shot log, shared by the Shot log page and the Light meter's "Log this
// frame". Kept on this device only (local storage); scans are stored as small
// JPEGs so a roll's worth fits.

import { useSyncExternalStore } from "react";
import { getString, setString } from "../services/persistence";
import { addEntry, attachScans, type LogEntry, type NewEntry } from "./shotLog";

const KEY = "rangefinder-shot-log";
const ROLL_KEY = "rangefinder-shot-log-roll";

function read(): LogEntry[] {
  try {
    const list = JSON.parse(getString(KEY) ?? "[]") as LogEntry[];
    // Infinity doesn't survive JSON; it's stored as null.
    return Array.isArray(list) ? list.map((e) => (e.focusMm === null ? { ...e, focusMm: Infinity } : e)) : [];
  } catch {
    return [];
  }
}

let log = read();
let roll = getString(ROLL_KEY) || "Roll 1";
let snapshot = { log, roll };
const listeners = new Set<() => void>();

/** Saves; false when the device's storage is full (the change stays for this visit). */
function commit(nextLog: LogEntry[], nextRoll = roll): boolean {
  log = nextLog;
  roll = nextRoll;
  snapshot = { log, roll };
  listeners.forEach((l) => l());
  setString(ROLL_KEY, roll);
  return setString(KEY, JSON.stringify(log));
}

export function useShotLog() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
}

/** Logs a frame on the current roll. */
export function logFrame(entry: Omit<NewEntry, "roll">): boolean {
  return commit(addEntry(log, { ...entry, roll }));
}

export function setCurrentRoll(name: string) {
  commit(log, name.trim() || roll);
}

export function updateEntry(id: string, patch: Partial<LogEntry>): boolean {
  return commit(log.map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export function removeEntry(id: string): boolean {
  return commit(log.filter((e) => e.id !== id));
}

export function attachRollScans(rollName: string, scans: string[]): { saved: boolean; unmatched: number } {
  const r = attachScans(log, rollName, scans);
  return { saved: commit(r.log), unmatched: r.unmatched };
}

/** A scan file as a small JPEG, for storing beside its log entry. */
export function scanThumbnail(file: File, width = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const scale = Math.min(1, width / img.naturalWidth);
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't an image this browser can read."));
    };
    img.src = url;
  });
}
