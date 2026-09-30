// Large-text mode (#64): the whole app a size larger, for older eyes and for
// reading at arm's length in the field. Stored on this device only; applied
// as a class on <html> so every page scales together.

import { useSyncExternalStore } from "react";
import { getString, setString } from "../services/persistence";

const KEY = "rangefinder-big-text";
let on = getString(KEY) === "1";
const listeners = new Set<() => void>();

function apply() {
  if (typeof document !== "undefined") document.documentElement.classList.toggle("big-text", on);
}
apply();

export function setBigText(value: boolean) {
  on = value;
  setString(KEY, value ? "1" : "0");
  apply();
  listeners.forEach((l) => l());
}

export function useBigText(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
    () => false,
  );
}
