import { useEffect } from "react";

type Lock = { release: () => Promise<void> };

/** Keeps the screen on while `on`, where the browser allows it; taken again when the page comes back. */
export function useWakeLock(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } };
    let lock: Lock | null = null;
    let alive = true;
    const request = () =>
      nav.wakeLock
        ?.request("screen")
        .then((l) => {
          if (!alive) void l.release();
          else lock = l;
        })
        .catch(() => undefined);
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [on]);
}
