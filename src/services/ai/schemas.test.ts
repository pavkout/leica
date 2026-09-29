import { describe, expect, it } from "vitest";
import { parseListingReport, parsePhotoReading, parsePriceSuggestion } from "./schemas";

const reading = {
  kind: "body",
  maker: "Leitz",
  model: "M3",
  lensName: null,
  serial: "919 251",
  serialLegible: "yes",
  engravings: ["Ernst Leitz GmbH Wetzlar", " "],
  finish: "chrome",
  visibleCondition: "light brassing on the edges",
  confidence: { model: "high", serial: "medium" },
  whatWouldHelp: null,
};

const comp = (price: number, extra: object = {}) => ({ url: `https://shop.example/${price}`, title: "Leica M3", price, currency: "eur", kind: "sold", date: "2026-06", condition: null, ...extra });

describe("AI output validation", () => {
  it("accepts a valid photo reading and tidies it", () => {
    const r = parsePhotoReading(reading)!;
    expect(r.serial).toBe("919 251");
    expect(r.engravings).toEqual(["Ernst Leitz GmbH Wetzlar"]);
  });

  it("rejects readings with missing or wrongly typed fields", () => {
    const missing: Record<string, unknown> = { ...reading };
    delete missing.serialLegible;
    expect(parsePhotoReading(missing)).toBeNull();
    expect(parsePhotoReading({ ...reading, serial: 919251 })).toBeNull();
    expect(parsePhotoReading({ ...reading, confidence: { model: "sure" } })).toBeNull();
    expect(parsePhotoReading("M3")).toBeNull();
  });

  it("drops a serial the model says it can't read", () => {
    expect(parsePhotoReading({ ...reading, serialLegible: "no", serial: "91925?" })!.serial).toBeNull();
  });

  it("computes the range itself, from cited comparables only", () => {
    const p = parsePriceSuggestion({ comparables: [comp(1900), comp(2200), comp(2000, { url: "" })], note: "few sales" })!;
    expect(p.comparables).toHaveLength(2);
    expect(p.range).toBeNull();
    const q = parsePriceSuggestion({ comparables: [comp(1900), comp(2200), comp(2000)], note: "" })!;
    expect(q.range).toEqual({ low: 1900, high: 2200, currency: "EUR", count: 3 });
  });

  it("validates a listing report", () => {
    const base = {
      fetched: true, title: "Leica M3 DS", kind: "body", maker: "Leitz", model: "M3", statedSerial: "700123", statedYear: "1954",
      askingPrice: 2400, askingCurrency: "EUR", redFlags: [{ flag: "Payment off-platform", why: "Asks for bank transfer" }],
      comparables: [comp(1900), comp(2200), comp(2000)], note: "",
    };
    const r = parseListingReport(base)!;
    expect(r.asking).toEqual({ price: 2400, currency: "EUR" });
    expect(r.price.range?.high).toBe(2200);
    expect(parseListingReport({ ...base, askingPrice: "2400" })).toBeNull();
    expect(parseListingReport({ ...base, redFlags: ["bad"] })).toBeNull();
    expect(parseListingReport({ ...base, askingCurrency: null })!.asking).toBeNull();
  });
});
