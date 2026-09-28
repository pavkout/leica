import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { parseRoute, routeHash, type Route } from "../../app/tools";

export type CurtainPhase = "idle" | "closing" | "opening";

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Curtain timings, ms: the second curtain closes over the old tool, the first opens on the new one. */
export const CLOSE_MS = 150;
export const OPEN_MS = 190;

// The curtain phase lives outside React state of the app, so animating it re-renders only the curtain,
// never the whole simulator.
let phase: CurtainPhase = "idle";
const listeners = new Set<() => void>();
function setPhase(next: CurtainPhase) {
  if (phase === next) return;
  phase = next;
  listeners.forEach((l) => l());
}

export function useCurtainPhase(): CurtainPhase {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => phase,
    () => "idle",
  );
}

/**
 * Hash route (#/mode/tool) with the shutter-curtain transition: navigating
 * closes the curtain, swaps the tool, then opens it. Back/forward work, and
 * reduced motion swaps instantly.
 */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(typeof location === "undefined" ? "" : location.hash));
  const current = useRef(route);
  current.current = route;
  const timers = useRef<number[]>([]);

  const apply = useCallback((next: Route) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const same = (r: Route) => r.screen === next.screen && r.mode === next.mode && r.tool === next.tool;
    // The camera's own screens (camera, MENU) switch instantly, as buttons on a camera do;
    // the shutter curtain is for changing pages.
    const pageToPage = current.current.screen === "tool" && next.screen === "tool";
    if (reducedMotion() || !pageToPage) {
      setRoute((r) => (same(r) ? r : next));
      setPhase("idle");
      return;
    }
    setPhase("closing");
    timers.current.push(
      window.setTimeout(() => {
        setRoute((r) => (same(r) ? r : next));
        window.scrollTo({ top: 0 });
        setPhase("opening");
        timers.current.push(window.setTimeout(() => setPhase("idle"), OPEN_MS));
      }, CLOSE_MS),
    );
  }, []);

  useEffect(() => {
    const onHash = () => apply(parseRoute(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      timers.current.forEach(clearTimeout);
    };
  }, [apply]);

  const navigate = useCallback((next: Route) => {
    const hash = routeHash(next);
    if (location.hash === hash) return;
    // Setting the hash fires hashchange, which runs the transition.
    location.hash = hash;
  }, []);

  return { route, navigate };
}
