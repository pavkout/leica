// My collection: the owner's own record of their cameras and lenses, the
// leather notebook a collector keeps. The owner's entries (serials, dates,
// prices, service) stay the owner's; beside them sit, kept apart and labelled,
// what the published serial lists say (serialFacts), what an AI read from a
// photo (aiFindings), and cited market valuations. Pure logic here; the
// component keeps it on this device.

import type { Comparable, PriceRange } from "./market";
import type { SerialFacts } from "./serialFacts";

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
  /** From the published serial lists; recomputed from the serial on save. */
  serialFacts?: SerialFacts;
  /** What an AI read from the owner's photo. Never merged into the fields above. */
  aiFindings?: AiFindings;
  /** Cited market valuations, newest first. */
  valuations?: Valuation[];
}

export type Confidence = "high" | "medium" | "low";

export interface AiFindings {
  maker?: string;
  model?: string;
  serial?: string;
  serialLegible?: "yes" | "partial" | "no";
  engravings?: string[];
  finish?: string;
  condition?: string;
  confidence: { model: Confidence; serial: Confidence };
  /** ISO timestamp. */
  at: string;
  modelUsed: string;
  costUsd: number;
}

export interface Valuation {
  /** ISO timestamp. */
  at: string;
  modelUsed: string;
  range: PriceRange | null;
  comparables: Comparable[];
  note: string;
  costUsd: number;
}

/** The newest valuation, and whether it is over a year old. */
export function latestValuation(item: CollectionItem, today: Date): { v: Valuation; stale: boolean } | null {
  const v = item.valuations?.[0];
  if (!v) return null;
  const age = today.getTime() - new Date(v.at).getTime();
  return { v, stale: age > 365 * 24 * 3600 * 1000 };
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
  const head = ["kind", "name", "serial", "acquired", "price", "filter", "serviced", "notes", "serial_model", "serial_year", "value_low", "value_high", "value_currency", "value_date", "value_sources"];
  const rows = sorted(list).map((i) => {
    const v = i.valuations?.[0];
    const r = v?.range;
    return [
      i.kind, i.name, i.serial ?? "", i.acquired ?? "", i.price ?? "", i.filter ?? "", i.serviced ?? "", i.notes ?? "",
      i.serialFacts?.model ?? "", i.serialFacts?.year ?? "",
      r ? String(r.low) : "", r ? String(r.high) : "", r?.currency ?? "", v ? v.at.slice(0, 10) : "", v ? String(v.comparables.length) : "",
    ];
  });
  return [head, ...rows].map((r) => r.map(csv).join(",")).join("\r\n");
}
