// My Leica Bag: which catalog items the user has pinned as "my gear", so
// pickers can surface them first instead of the full 24-body/48-lens/8-film
// catalog every time. Deliberately just a set of catalog ids per category —
// no owned-vs-wishlist distinction, no per-item notes — that can grow later
// without a schema migration headache, since it's additive.

import { useCallback, useMemo, useState } from "react";
import { getVersioned, setVersioned } from "../services/persistence";

export type BagCategory = "body" | "lens" | "film";

export interface BagState {
  bodyIds: string[];
  lensIds: string[];
  filmIds: string[];
}

const BAG_KEY = "rangefinder-bag";
const BAG_VERSION = 1;
const EMPTY_BAG: BagState = { bodyIds: [], lensIds: [], filmIds: [] };

function keyFor(category: BagCategory): keyof BagState {
  return category === "body" ? "bodyIds" : category === "lens" ? "lensIds" : "filmIds";
}

/** Adds `id` to `list` if absent, removes it if present. */
export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function loadBag(): BagState {
  return getVersioned<BagState>(BAG_KEY, BAG_VERSION, EMPTY_BAG);
}

export function saveBag(bag: BagState) {
  setVersioned(BAG_KEY, BAG_VERSION, bag);
}

export function useBag() {
  const [bag, setBag] = useState<BagState>(loadBag);

  const toggle = useCallback((category: BagCategory, id: string) => {
    setBag((prev) => {
      const key = keyFor(category);
      const next = { ...prev, [key]: toggleId(prev[key], id) };
      saveBag(next);
      return next;
    });
  }, []);

  const savedIds = useMemo(
    () => ({
      body: new Set(bag.bodyIds),
      lens: new Set(bag.lensIds),
      film: new Set(bag.filmIds),
    }),
    [bag]
  );

  return { bag, savedIds, toggle };
}
