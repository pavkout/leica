import { describe, expect, it } from "vitest";
import { listingGlance } from "./listingGlance";
import type { ListingReport } from "../services/ai/schemas";

const base: ListingReport = {
  fetched: true,
  title: "Leica M3",
  kind: "body",
  maker: "Leitz",
  model: "M3",
  statedSerial: "700123",
  statedYear: "1954",
  asking: { price: 2000, currency: "EUR" },
  redFlags: [],
  price: { comparables: [], range: { low: 1900, high: 2200, currency: "EUR", count: 3 }, note: "" },
};

const marks = (r: ListingReport) => listingGlance(r).map((g) => g.mark);

describe("listing at a glance", () => {
  it("is all good when the serial fits, nothing is flagged and the price is in range", () => {
    expect(marks(base)).toEqual(["good", "good", "good"]);
    expect(listingGlance(base)[0].text).toMatch(/Leica M3 made in 1954/);
  });

  it("warns on a serial that doesn't fit the claim, on red flags, and on an out-of-range price", () => {
    const r = { ...base, model: "M2", redFlags: [{ flag: "Off-platform payment", why: "Bank transfer only" }], asking: { price: 3000, currency: "EUR" } };
    expect(marks(r)).toEqual(["warn", "warn", "warn"]);
    expect(listingGlance(r)[1].text).toMatch(/1 found/);
  });

  it("says plainly when something can't be checked", () => {
    const r = { ...base, statedSerial: null, asking: null, price: { comparables: [], range: null, note: "" } };
    expect(marks(r)).toEqual(["none", "good", "none"]);
    expect(listingGlance(r)[2].text).toMatch(/Not enough similar sales/);
  });
});
