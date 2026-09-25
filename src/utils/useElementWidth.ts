import { useLayoutEffect, useRef, useState } from "react";

/** Tracks an element's content width so SVGs can draw in real pixels. */
export function useElementWidth<T extends HTMLElement>(fallback = 360) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
