// Shared "a control is being turned" signal. While any control is held, the
// image renders at interactive quality (fewer pixels, same optics) so each
// change lands in the next frame; full quality returns shortly after release.

import { useSyncExternalStore } from "react";

let active = 0;
let settling: number | undefined;
let interacting = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (interacting === next) return;
  interacting = next;
  listeners.forEach((l) => l());
}

/** Call when a control is grabbed; returns the matching release. */
export function beginInteraction(): () => void {
  active++;
  window.clearTimeout(settling);
  set(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active = Math.max(0, active - 1);
    if (active === 0) settling = window.setTimeout(() => set(false), 140);
  };
}

export function useInteracting(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => interacting,
    () => false,
  );
}

/** A short tick under the finger where the browser allows vibration (Android); a no-op elsewhere. */
export function haptic(ms = 6) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Vibration blocked or unsupported: sound and motion carry the feedback.
  }
}
