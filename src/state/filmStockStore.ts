// Film stock on this device (#48), shared by the Film stock page, the
// developing timer (which can mark a roll developed) and the travel kit.

import { useSyncExternalStore } from "react";
import { getString, setString } from "../services/persistence";
import { EMPTY, type FilmState } from "./filmStock";

const KEY = "rangefinder-film-stock";

function read(): FilmState {
  try {
    const s = JSON.parse(getString(KEY) ?? "null") as FilmState | null;
    return s && Array.isArray(s.stock) && Array.isArray(s.rolls) ? s : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state: FilmState | null = null;
const listeners = new Set<() => void>();
const snapshot = () => (state ??= read());

export function useFilmStock(): FilmState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    snapshot
  );
}

/** Saves and shares. False when the device's storage refused it. */
export function saveFilmStock(next: FilmState): boolean {
  state = next;
  listeners.forEach((l) => l());
  return setString(KEY, JSON.stringify(next));
}

export function getFilmStock(): FilmState {
  return snapshot();
}
