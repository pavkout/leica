// The shapes Claude must answer in, as JSON Schema (sent with the request),
// and validators that check what actually came back. Anything that doesn't
// validate is treated as unreadable: nothing half-parsed reaches the UI.

import { citedOnly, settleRange, type Comparable, type PriceRange } from "../../state/market";
import type { Confidence } from "../../state/collection";

const str = { type: "string" } as const;
const nullable = (s: object) => ({ anyOf: [s, { type: "null" }] });
const obj = (properties: Record<string, object>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const conf = { type: "string", enum: ["high", "medium", "low"] } as const;
const itemKind = { type: "string", enum: ["body", "lens", "accessory", "unknown"] } as const;

export type ItemKindRead = "body" | "lens" | "accessory" | "unknown";

export interface PhotoReading {
  kind: ItemKindRead;
  maker: string | null;
  model: string | null;
  lensName: string | null;
  serial: string | null;
  serialLegible: "yes" | "partial" | "no";
  engravings: string[];
  finish: string | null;
  visibleCondition: string | null;
  confidence: { model: Confidence; serial: Confidence };
  whatWouldHelp: string | null;
}

export const PHOTO_SCHEMA = obj({
  kind: itemKind,
  maker: nullable(str),
  model: nullable(str),
  lensName: nullable(str),
  serial: nullable(str),
  serialLegible: { type: "string", enum: ["yes", "partial", "no"] },
  engravings: { type: "array", items: str },
  finish: nullable(str),
  visibleCondition: nullable(str),
  confidence: obj({ model: conf, serial: conf }),
  whatWouldHelp: nullable(str),
});

const COMPARABLE_SCHEMA = obj({
  url: str,
  title: str,
  price: { type: "number" },
  currency: { type: "string", description: "ISO 4217 code as shown by the source, e.g. EUR" },
  kind: { type: "string", enum: ["sold", "asking"] },
  date: nullable(str),
  condition: nullable(str),
});

export interface Critique {
  summary: string;
  strengths: string[];
  improvements: string[];
  exposure: string | null;
  focus: string | null;
  composition: string | null;
  tryNext: string;
}

export const CRITIQUE_SCHEMA = obj({
  summary: str,
  strengths: { type: "array", items: str },
  improvements: { type: "array", items: str },
  exposure: nullable(str),
  focus: nullable(str),
  composition: nullable(str),
  tryNext: str,
});

export const PRICE_SCHEMA = obj({
  comparables: { type: "array", items: COMPARABLE_SCHEMA },
  note: str,
});

export const LISTING_SCHEMA = obj({
  fetched: { type: "boolean" },
  title: nullable(str),
  kind: itemKind,
  maker: nullable(str),
  model: nullable(str),
  statedSerial: nullable(str),
  statedYear: nullable(str),
  askingPrice: nullable({ type: "number" }),
  askingCurrency: nullable(str),
  redFlags: { type: "array", items: obj({ flag: str, why: str }) },
  comparables: { type: "array", items: COMPARABLE_SCHEMA },
  note: str,
});

// ── validators ─────────────────────────────────────────────

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x);
const sOrNull = (x: unknown): x is string | null => x === null || typeof x === "string";
const oneOf = <T extends string>(x: unknown, list: readonly T[]): x is T => typeof x === "string" && (list as readonly string[]).includes(x);
const CONF = ["high", "medium", "low"] as const;
const KINDS = ["body", "lens", "accessory", "unknown"] as const;
const clean = (s: string | null) => (s && s.trim() ? s.trim() : null);

export function parsePhotoReading(x: unknown): PhotoReading | null {
  if (!isRec(x)) return null;
  const c = x.confidence;
  if (
    !oneOf(x.kind, KINDS) ||
    !sOrNull(x.maker) || !sOrNull(x.model) || !sOrNull(x.lensName) || !sOrNull(x.serial) ||
    !oneOf(x.serialLegible, ["yes", "partial", "no"] as const) ||
    !Array.isArray(x.engravings) || !x.engravings.every((e) => typeof e === "string") ||
    !sOrNull(x.finish) || !sOrNull(x.visibleCondition) || !sOrNull(x.whatWouldHelp) ||
    !isRec(c) || !oneOf(c.model, CONF) || !oneOf(c.serial, CONF)
  )
    return null;
  // A serial the model says it can't read is not kept, whatever it wrote.
  const serial = x.serialLegible === "no" ? null : clean(x.serial);
  return {
    kind: x.kind,
    maker: clean(x.maker),
    model: clean(x.model),
    lensName: clean(x.lensName),
    serial,
    serialLegible: x.serialLegible,
    engravings: (x.engravings as string[]).map((e) => e.trim()).filter(Boolean),
    finish: clean(x.finish),
    visibleCondition: clean(x.visibleCondition),
    confidence: { model: c.model, serial: c.serial },
    whatWouldHelp: clean(x.whatWouldHelp),
  };
}

function parseComparables(x: unknown): Comparable[] | null {
  if (!Array.isArray(x)) return null;
  const out: Comparable[] = [];
  for (const c of x) {
    if (!isRec(c)) return null;
    if (typeof c.url !== "string" || typeof c.title !== "string" || typeof c.price !== "number" || typeof c.currency !== "string") return null;
    if (!oneOf(c.kind, ["sold", "asking"] as const) || !sOrNull(c.date) || !sOrNull(c.condition)) return null;
    out.push({ url: c.url.trim(), title: c.title.trim(), price: c.price, currency: c.currency.trim().toUpperCase(), kind: c.kind, date: clean(c.date), condition: clean(c.condition) });
  }
  return citedOnly(out);
}

export interface PriceSuggestion {
  comparables: Comparable[];
  /** Computed here from the cited comparables; the model's own opinion of a range is never used. */
  range: PriceRange | null;
  note: string;
}

export function parsePriceSuggestion(x: unknown): PriceSuggestion | null {
  if (!isRec(x) || typeof x.note !== "string") return null;
  const comparables = parseComparables(x.comparables);
  if (!comparables) return null;
  return { comparables, range: settleRange(comparables), note: x.note.trim() };
}

export interface ListingReport {
  fetched: boolean;
  title: string | null;
  kind: ItemKindRead;
  maker: string | null;
  model: string | null;
  statedSerial: string | null;
  statedYear: string | null;
  asking: { price: number; currency: string } | null;
  redFlags: { flag: string; why: string }[];
  price: PriceSuggestion;
}

export function parseListingReport(x: unknown): ListingReport | null {
  if (!isRec(x) || typeof x.fetched !== "boolean" || !oneOf(x.kind, KINDS)) return null;
  if (![x.title, x.maker, x.model, x.statedSerial, x.statedYear, x.askingCurrency].every(sOrNull)) return null;
  if (!(x.askingPrice === null || typeof x.askingPrice === "number")) return null;
  if (!Array.isArray(x.redFlags) || !x.redFlags.every((f) => isRec(f) && typeof f.flag === "string" && typeof f.why === "string")) return null;
  const price = parsePriceSuggestion({ comparables: x.comparables, note: x.note });
  if (!price) return null;
  const cur = clean(x.askingCurrency as string | null)?.toUpperCase();
  return {
    fetched: x.fetched,
    title: clean(x.title as string | null),
    kind: x.kind,
    maker: clean(x.maker as string | null),
    model: clean(x.model as string | null),
    statedSerial: clean(x.statedSerial as string | null),
    statedYear: clean(x.statedYear as string | null),
    asking: typeof x.askingPrice === "number" && x.askingPrice > 0 && cur && /^[A-Z]{3}$/.test(cur) ? { price: x.askingPrice, currency: cur } : null,
    redFlags: (x.redFlags as { flag: string; why: string }[]).map((f) => ({ flag: f.flag.trim(), why: f.why.trim() })).filter((f) => f.flag),
    price,
  };
}

/** A photo critique; lists are trimmed and capped so a runaway answer stays readable. */
export function parseCritique(x: unknown): Critique | null {
  if (!isRec(x)) return null;
  const list = (v: unknown) => (Array.isArray(v) && v.every((e) => typeof e === "string") ? (v as string[]).map((e) => e.trim()).filter(Boolean).slice(0, 5) : null);
  const strengths = list(x.strengths);
  const improvements = list(x.improvements);
  if (typeof x.summary !== "string" || typeof x.tryNext !== "string" || !strengths || !improvements || !sOrNull(x.exposure) || !sOrNull(x.focus) || !sOrNull(x.composition)) return null;
  return { summary: x.summary.trim(), strengths, improvements, exposure: clean(x.exposure), focus: clean(x.focus), composition: clean(x.composition), tryNext: x.tryNext.trim() };
}

export interface RollSuggestion {
  overall: string;
  picks: number[];
  notes: { frame: number; note: string }[];
}

export const ROLL_SCHEMA = obj({
  overall: str,
  picks: { type: "array", items: { type: "integer" } },
  notes: { type: "array", items: obj({ frame: { type: "integer" }, note: str }) },
});

/** Picks and notes only for frames that were sent. */
export function parseRollSuggestion(x: unknown, frames: number[]): RollSuggestion | null {
  if (!isRec(x) || typeof x.overall !== "string" || !Array.isArray(x.picks) || !Array.isArray(x.notes)) return null;
  const known = new Set(frames);
  const picks = [...new Set((x.picks as unknown[]).filter((p): p is number => typeof p === "number" && known.has(p)))];
  const notes: { frame: number; note: string }[] = [];
  for (const n of x.notes as unknown[]) {
    if (!isRec(n) || typeof n.frame !== "number" || typeof n.note !== "string") return null;
    if (known.has(n.frame) && n.note.trim()) notes.push({ frame: n.frame, note: n.note.trim() });
  }
  return { overall: x.overall.trim(), picks, notes };
}

export interface ConditionReport {
  summary: string;
  cosmetic: string[];
  glass: string | null;
  mechanical: string[];
  notVisible: string[];
}

export const CONDITION_SCHEMA = obj({
  summary: str,
  cosmetic: { type: "array", items: str },
  glass: nullable(str),
  mechanical: { type: "array", items: str },
  notVisible: { type: "array", items: str },
});

export function parseCondition(x: unknown): ConditionReport | null {
  if (!isRec(x)) return null;
  const list = (v: unknown) => (Array.isArray(v) && v.every((e) => typeof e === "string") ? (v as string[]).map((e) => e.trim()).filter(Boolean).slice(0, 8) : null);
  const cosmetic = list(x.cosmetic);
  const mechanical = list(x.mechanical);
  const notVisible = list(x.notVisible);
  if (typeof x.summary !== "string" || !cosmetic || !mechanical || !notVisible || !sOrNull(x.glass)) return null;
  return { summary: x.summary.trim(), cosmetic, glass: clean(x.glass), mechanical, notVisible };
}
