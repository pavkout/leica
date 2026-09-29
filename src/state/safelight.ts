// Safelight mode: the whole screen in deep red, like a darkroom's safelight
// or a night-shooting red torch. Red light keeps dark-adapted eyes adapted;
// here it's a display preference, stored on this device only.

import { useSyncExternalStore } from "react";
import { getString, setString } from "../services/persistence";

const KEY = "rangefinder-safelight";
let on = getString(KEY) === "1";
const listeners = new Set<() => void>();

export function safelightOn() {
  return on;
}

export function setSafelight(value: boolean) {
  on = value;
  setString(KEY, value ? "1" : "0");
  listeners.forEach((l) => l());
}

export function useSafelight(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
    () => false,
  );
}
