import { describe, expect, it } from "vitest";
import { draftFromListing, draftFromReading } from "./collectorDrafts";
import type { ListingReport, PhotoReading } from "../services/ai/schemas";

const meta = { at: "2026-09-29T12:00:00Z", model: "claude-sonnet-5", usd: 0.03 };
const reading: PhotoReading = {
  kind: "body", maker: "Leitz", model: "Leica M3", lensName: null, serial: "959450", serialLegible: "yes", engravings: ["Ernst Leitz Wetzlar"],
  finish: "black paint", visibleCondition: "brassing on the edges", confidence: { model: "high", serial: "medium" }, whatWouldHelp: null,
};

describe("collector drafts", () => {
  it("builds a body draft from a photo, with facts from the list kept apart from the AI reading", () => {
    const d = draftFromReading(reading, "data:image/jpeg;base64,x", meta);
    expect(d).toMatchObject({ kind: "body", name: "Leica M3", serial: "959450", photo: "data:image/jpeg;base64,x" });
    expect(d.serialFacts?.variant).toBe("black paint");
    expect(d.aiFindings).toMatchObject({ model: "Leica M3", finish: "black paint", modelUsed: "claude-sonnet-5", costUsd: 0.03 });
  });

  it("keeps no serial facts when the AI couldn't read the serial", () => {
    const d = draftFromReading({ ...reading, serial: null, serialLegible: "no" }, undefined, meta);
    expect(d.serial).toBeUndefined();
    expect(d.serialFacts).toBeUndefined();
  });

  it("files an unrecognised item as an accessory with a plain name", () => {
    const d = draftFromReading({ ...reading, kind: "unknown", maker: null, model: null }, undefined, meta);
    expect(d.kind).toBe("accessory");
    expect(d.name).toBe("Unidentified item");
  });

  it("builds a draft from a listing, carrying its cited valuation", () => {
    const r: ListingReport = {
      fetched: true, title: "Leica M3 DS", kind: "body", maker: "Leitz", model: "M3", statedSerial: "700123", statedYear: "1954",
      asking: { price: 2400, currency: "EUR" }, redFlags: [],
      price: { comparables: [], range: null, note: "few sales" },
    };
    const d = draftFromListing(r, "https://example.com/itm/1", meta);
    expect(d.name).toBe("Leitz M3");
    expect(d.serialFacts?.model).toBe("M3");
    expect(d.notes).toContain("https://example.com/itm/1");
    expect(d.price).toMatch(/2,400/);
    expect(d.valuations?.[0]).toMatchObject({ range: null, note: "few sales", costUsd: 0.03 });
  });
});
