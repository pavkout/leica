import { useEffect, useRef } from "react";

/** Input that counts as someone using the screen. */
export const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

/**
 * Calls `onIdle` once after `ms` without activity on `target`. Every activity
 * event restarts the wait. Returns a function that stops watching.
 */
export function watchIdle(target: EventTarget, ms: number, onIdle: () => void): () => void {
  let t = setTimeout(onIdle, ms);
  const poke = () => {
    clearTimeout(t);
    t = setTimeout(onIdle, ms);
  };
  ACTIVITY_EVENTS.forEach((e) => target.addEventListener(e, poke, { passive: true, capture: true }));
  return () => {
    clearTimeout(t);
    ACTIVITY_EVENTS.forEach((e) => target.removeEventListener(e, poke, { capture: true }));
  };
}

/** `watchIdle` on the window while `enabled`; the wait restarts whenever `ms` or `enabled` changes. */
export function useIdle(ms: number, onIdle: () => void, enabled = true) {
  const cb = useRef(onIdle);
  cb.current = onIdle;
  useEffect(() => {
    if (!enabled) return;
    return watchIdle(window, ms, () => cb.current());
  }, [ms, enabled]);
}
