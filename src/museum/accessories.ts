// Accessories for the museum (#39). The app had no accessory data, and Leica
// specs are never invented, so every accessory lives in a cited dataset
// (content/accessories.json): each fact line and story paragraph names its
// source and the date it was read. `accessoryProblems` keeps it honest.

import content from "../content/accessories.json";
import type { Fact } from "./exhibits";

export interface AccessorySource {
  text: string;
  source: string;
  url: string;
  /** YYYY-MM-DD the source was read. */
  checked: string;
}

export type AccessoryKind = "finder" | "meter" | "motor" | "reflex" | "other";

export interface Accessory {
  id: string;
  name: string;
  kind: AccessoryKind;
  /** Year introduced, only when a source gives it. */
  year: number | null;
  /** One line, from the facts. */
  line: string;
  facts: Fact[];
  story: AccessorySource[];
}

interface AccessoryContent {
  version: number;
  updated: string;
  about: string;
  items: Accessory[];
}

export const ACCESSORY_CONTENT = content as AccessoryContent;
export const ACCESSORIES: Accessory[] = ACCESSORY_CONTENT.items;

/** Everything wrong with the dataset; empty means every item is complete and cited. */
export function accessoryProblems(items: Accessory[] = ACCESSORIES): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const a of items) {
    if (ids.has(a.id)) out.push(`${a.id}: duplicate id`);
    ids.add(a.id);
    if (!a.name.trim()) out.push(`${a.id}: no name`);
    if (!a.line.trim()) out.push(`${a.id}: no line`);
    if (!a.story.length) out.push(`${a.id}: no sourced story`);
    for (const s of a.story) {
      if (!/^https:\/\//.test(s.url)) out.push(`${a.id}: a story paragraph has no https source`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.checked)) out.push(`${a.id}: a source has no checked date`);
      if (!s.source.trim()) out.push(`${a.id}: a source has no name`);
    }
    if (a.year !== null && (a.year < 1913 || a.year > 2100)) out.push(`${a.id}: implausible year ${a.year}`);
  }
  return out;
}
