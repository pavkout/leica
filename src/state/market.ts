import { langTag, t } from "../i18n";
// Market context for collectors: cited comparable sales and listings, and the
// range the app is willing to state from them. Pure logic. The rules are the
// honesty rules of #38: every price has a source URL, sold and asking are kept
// apart, no currency conversion, and fewer than three comparables means "not
// enough data" rather than a range.

export interface Comparable {
  url: string;
  title: string;
  price: number;
  currency: string;
  kind: "sold" | "asking";
  /** "YYYY-MM-DD" or "YYYY-MM" when the source shows it. */
  date: string | null;
  condition: string | null;
}

export interface PriceRange {
  low: number;
  high: number;
  currency: string;
  /** How many comparables the range is drawn from. */
  count: number;
}

export const MIN_COMPARABLES = 3;

const isUrl = (u: unknown) => typeof u === "string" && /^https?:\/\/[^\s]+\.[^\s]+/i.test(u);

/** Keeps comparables that have a real link and a positive price. */
export function citedOnly(list: Comparable[]): Comparable[] {
  return list.filter((c) => isUrl(c.url) && Number.isFinite(c.price) && c.price > 0 && /^[A-Z]{3}$/.test(c.currency));
}

/**
 * The range from cited comparables in one currency (the most common one; the
 * others are not converted). Sold prices are preferred when there are enough
 * of them, because asking prices are only what sellers hope for.
 */
export function settleRange(list: Comparable[]): PriceRange | null {
  const cited = citedOnly(list);
  if (cited.length < MIN_COMPARABLES) return null;
  const byCur = new Map<string, Comparable[]>();
  for (const c of cited) byCur.set(c.currency, [...(byCur.get(c.currency) ?? []), c]);
  const [currency, inCur] = [...byCur.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (inCur.length < MIN_COMPARABLES) return null;
  const sold = inCur.filter((c) => c.kind === "sold");
  const basis = sold.length >= MIN_COMPARABLES ? sold : inCur;
  const prices = basis.map((c) => c.price);
  return { low: Math.min(...prices), high: Math.max(...prices), currency, count: basis.length };
}

export type AskingPosition = "below" | "within" | "above";

export function askingPosition(asking: { price: number; currency: string } | null, range: PriceRange | null): AskingPosition | null {
  if (!asking || !range || asking.currency !== range.currency) return null;
  if (asking.price < range.low) return "below";
  if (asking.price > range.high) return "above";
  return "within";
}

/** "about 18% above the highest comparable" style wording, or null. */
export function askingNote(asking: { price: number; currency: string } | null, range: PriceRange | null): string | null {
  const pos = askingPosition(asking, range);
  if (!pos || !asking || !range) return null;
  if (pos === "within") return t("col.asking.within");
  const edge = pos === "above" ? range.high : range.low;
  const pct = Math.round((Math.abs(asking.price - edge) / edge) * 100);
  return pos === "above" ? t("col.asking.above", { pct }) : t("col.asking.below", { pct });
}

export function formatMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(langTag() === "en" ? "en-GB" : langTag(), { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
}
