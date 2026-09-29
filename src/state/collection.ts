// My collection: the owner's own record of their cameras and lenses, the
// leather notebook a collector keeps. Everything is the owner's own entry
// (serials, dates, prices, service); nothing is looked up or guessed. Pure
// logic here; the component keeps it on this device.

export type ItemKind = "body" | "lens" | "accessory";

export interface CollectionItem {
  id: string;
  kind: ItemKind;
  /** The catalogue body or lens it is, when it's one the app knows. */
  catalogueId?: string;
  name: string;
  serial?: string;
  /** "YYYY-MM-DD". */
  acquired?: string;
  price?: string;
  /** Filter thread, e.g. "E39". */
  filter?: string;
  /** Bodies: when the rangefinder was last adjusted or the camera serviced, "YYYY-MM-DD". */
  serviced?: string;
  notes?: string;
  /** A small JPEG of the owner's photo of it. */
  photo?: string;
}

export function newItem(kind: ItemKind, name: string, extra: Partial<CollectionItem> = {}, now = Date.now()): CollectionItem {
  return { id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, kind, name: name.trim(), ...extra };
}

export function upsert(list: CollectionItem[], item: CollectionItem): CollectionItem[] {
  return list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item];
}

const ORDER: Record<ItemKind, number> = { body: 0, lens: 1, accessory: 2 };

/** Bodies, then lenses, then accessories; oldest acquisition first within each. */
export function sorted(list: CollectionItem[]): CollectionItem[] {
  return [...list].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (a.acquired ?? "9999").localeCompare(b.acquired ?? "9999") || a.name.localeCompare(b.name));
}

/** Months since the last service, for a gentle reminder; null when never recorded. */
export function monthsSinceService(item: CollectionItem, today: Date): number | null {
  if (!item.serviced) return null;
  const [y, m] = item.serviced.split("-").map(Number);
  return (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
}

const csv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function collectionCsv(list: CollectionItem[]): string {
  const head = ["kind", "name", "serial", "acquired", "price", "filter", "serviced", "notes"];
  const rows = sorted(list).map((i) => [i.kind, i.name, i.serial ?? "", i.acquired ?? "", i.price ?? "", i.filter ?? "", i.serviced ?? "", i.notes ?? ""]);
  return [head, ...rows].map((r) => r.map(csv).join(",")).join("\r\n");
}
