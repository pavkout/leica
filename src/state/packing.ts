// Travel kit packing list (#49): the cameras and lenses chosen for the trip,
// the film to bring, and the everyday things that get forgotten. Pure logic.

import type { CollectionItem } from "./collection";

export interface PackItem {
  id: string;
  /** i18n key for the app's own items; plain text for the owner's gear and additions. */
  key?: string;
  text?: string;
  vars?: Record<string, string | number>;
  group: "gear" | "film" | "power" | "care" | "papers" | "own";
}

/** The app's standard list; digital-only and film-only lines depend on what's packed. */
export function packingList(gear: CollectionItem[], opts: { film: boolean; digital: boolean; filmRolls: number }): PackItem[] {
  const list: PackItem[] = gear.map((g) => ({ id: `gear-${g.id}`, text: g.serial ? `${g.name} (No. ${g.serial})` : g.name, group: "gear" }));
  const add = (id: string, group: PackItem["group"], vars?: PackItem["vars"]) => list.push({ id, key: `pack.${id}`, group, vars });
  add("caps", "gear");
  add("strap", "gear");
  if (opts.film) {
    add("film", "film", { n: opts.filmRolls });
    add("filmBag", "film");
    add("xrayCard", "film");
  }
  if (opts.digital) {
    add("batteries", "power");
    add("charger", "power");
    add("cards", "power");
  }
  if (opts.film) add("meterBattery", "power");
  add("cloth", "care");
  add("blower", "care");
  add("rainCover", "care");
  add("ownership", "papers");
  add("insurance", "papers");
  return list;
}

export function progress(list: PackItem[], done: ReadonlySet<string>): { done: number; total: number } {
  return { done: list.filter((i) => done.has(i.id)).length, total: list.length };
}
