import { useCallback, useEffect, useRef, useState } from "react";
import { parseRoute, routeHash, type Route } from "../../app/tools";
import { irisActive, irisCycle } from "./iris";
import { playApertureClick } from "../../audio/sounds";

/**
 * Hash route (#/mode/tool) with the iris transition: navigating closes the
 * lens's iris, swaps the screen while it's shut, then opens it. Every screen
 * change runs it (camera, MENU, pages). Back/forward work, and reduced motion
 * swaps instantly.
 */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseRoute(typeof location === "undefined" ? "" : location.hash));
  const current = useRef(route);
  current.current = route;

  const apply = useCallback((next: Route) => {
    const same = (r: Route) => r.screen === next.screen && r.mode === next.mode && r.tool === next.tool;
    // Back to where it is: nothing to do, unless a transition away is under way (it then returns here).
    if (same(current.current) && !irisActive()) return;
    if (!irisActive()) playApertureClick();
    irisCycle(() => {
      setRoute((r) => (same(r) ? r : next));
      window.scrollTo({ top: 0 });
    });
  }, []);

  useEffect(() => {
    const onHash = () => apply(parseRoute(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [apply]);

  const navigate = useCallback((next: Route) => {
    const hash = routeHash(next);
    if (location.hash === hash) return;
    // Setting the hash fires hashchange, which runs the transition.
    location.hash = hash;
  }, []);

  return { route, navigate };
}
