import { describe, expect, it } from "vitest";
import { askingNote, askingPosition, citedOnly, settleRange, type Comparable } from "./market";

const c = (price: number, extra: Partial<Comparable> = {}): Comparable => ({
  url: `https://example.com/item/${price}`,
  title: "Leica M3",
  price,
  currency: "EUR",
  kind: "sold",
  date: "2026-05",
  condition: null,
  ...extra,
});

describe("market", () => {
  it("gives a range from three cited comparables", () => {
    expect(settleRange([c(1900), c(2200), c(2050)])).toEqual({ low: 1900, high: 2200, currency: "EUR", count: 3 });
  });

  it("says not enough data with fewer than three", () => {
    expect(settleRange([c(1900), c(2200)])).toBeNull();
  });

  it("drops comparables without a link before counting", () => {
    expect(settleRange([c(1900), c(2200), c(2050, { url: "" })])).toBeNull();
    expect(citedOnly([c(1, { url: "not a url" }), c(2)])).toHaveLength(1);
  });

  it("uses one currency and never converts", () => {
    const r = settleRange([c(1900), c(2200), c(2050), c(1500, { currency: "USD" })]);
    expect(r?.currency).toBe("EUR");
    expect(r?.low).toBe(1900);
    expect(settleRange([c(1900), c(2200), c(1500, { currency: "USD" })])).toBeNull();
  });

  it("prefers sold prices when there are enough", () => {
    const r = settleRange([c(1900), c(2000), c(2100), c(3500, { kind: "asking" })]);
    expect(r?.high).toBe(2100);
    expect(settleRange([c(1900), c(2000, { kind: "asking" }), c(3500, { kind: "asking" })])?.high).toBe(3500);
  });

  it("places the asking price", () => {
    const r = settleRange([c(1900), c(2200), c(2050)]);
    expect(askingPosition({ price: 1500, currency: "EUR" }, r)).toBe("below");
    expect(askingPosition({ price: 2000, currency: "EUR" }, r)).toBe("within");
    expect(askingPosition({ price: 2640, currency: "EUR" }, r)).toBe("above");
    expect(askingPosition({ price: 2000, currency: "USD" }, r)).toBeNull();
    expect(askingNote({ price: 2640, currency: "EUR" }, r)).toMatch(/20% more/);
    expect(askingNote({ price: 2000, currency: "EUR" }, r)).toMatch(/In line/);
  });
});
