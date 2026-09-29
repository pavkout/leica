// Draft collection items built from an AI photo reading or a listing check.
// Pure logic. A draft opens in the editor and is saved only when the owner
// saves it; the serial facts come from the lists, never from the AI.

import type { ListingReport, PhotoReading } from "../services/ai/schemas";
import { newItem, type CollectionItem, type ItemKind } from "./collection";
import { formatMoney } from "./market";
import { lookupSerialFacts } from "./serialFacts";

/**
 * The name a collector would use: "Leica M3", never "Leitz M3" (Leitz made
 * them, but collectors call them Leicas). Other makers keep their name.
 * Empty when there's nothing to go on.
 */
export function itemName(maker: string | null, model: string | null, lensName: string | null = null): string {
  const parts = [model, lensName].filter(Boolean).join(" ").trim();
  if (!parts) return "";
  if (/\b(leica|leitz)\b/i.test(parts)) return parts.replace(/\bleitz\b/i, "Leica");
  const brand = maker && /\b(leica|leitz)\b/i.test(maker) ? "Leica" : maker;
  return brand ? `${brand} ${parts}` : parts;
}

export function draftFromReading(r: PhotoReading, photo: string | undefined, meta: { at: string; model: string; usd: number }): CollectionItem {
  const kind: ItemKind = r.kind === "lens" ? "lens" : r.kind === "body" ? "body" : "accessory";
  const name = itemName(r.maker, r.model, r.lensName) || "Unidentified item";
  const found = r.serial && kind !== "accessory" ? lookupSerialFacts(kind, r.serial) : null;
  return newItem(kind, name, {
    serial: r.serial ?? undefined,
    photo,
    serialFacts: found?.status === "found" ? found.facts : undefined,
    aiFindings: {
      maker: r.maker ?? undefined,
      model: [r.model, r.lensName].filter(Boolean).join(" ") || undefined,
      serial: r.serial ?? undefined,
      serialLegible: r.serialLegible,
      engravings: r.engravings,
      finish: r.finish ?? undefined,
      condition: r.visibleCondition ?? undefined,
      confidence: r.confidence,
      at: meta.at,
      modelUsed: meta.model,
      costUsd: meta.usd,
    },
  });
}

export function draftFromListing(r: ListingReport, url: string, meta: { at: string; model: string; usd: number }): CollectionItem {
  const kind: ItemKind = r.kind === "lens" ? "lens" : r.kind === "body" ? "body" : "accessory";
  const found = r.statedSerial && kind !== "accessory" ? lookupSerialFacts(kind, r.statedSerial) : null;
  return newItem(kind, itemName(r.maker, r.model) || r.title || "Item from a listing", {
    serial: r.statedSerial ?? undefined,
    price: r.asking ? formatMoney(r.asking.price, r.asking.currency) : undefined,
    notes: `From a listing: ${url}`,
    serialFacts: found?.status === "found" ? found.facts : undefined,
    valuations: [{ at: meta.at, modelUsed: meta.model, range: r.price.range, comparables: r.price.comparables, note: r.price.note, costUsd: meta.usd }],
  });
}
