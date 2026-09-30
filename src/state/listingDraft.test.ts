import { describe, expect, it } from "vitest";
import { listingDraft } from "./listingDraft";
import { newItem } from "./collection";
import { lookupSerialFacts } from "./serialFacts";
import type { Passport } from "./passport";

const t = (k: string, v?: Record<string, string | number>) => `${k}${v ? JSON.stringify(v) : ""}`;
const date = (iso: string) => iso;

describe("listing draft", () => {
  const found = lookupSerialFacts("body", "700123");
  const facts = found.status === "found" ? found.facts : undefined;
  const item = { ...newItem("body", "Leica M3"), serial: "700123", serialFacts: facts, acquired: "2019-04-02" };
  const passport = {
    format: "leica.rt-passport",
    version: 1,
    itemId: item.id,
    subject: { kind: "body", name: "Leica M3" },
    entries: [
      { seal: "a", event: { id: "1", type: "service", date: "2021-06-10", title: "CLA", by: "A workshop", recordedAt: "2021-06-10T00:00:00Z" } },
      { seal: "b", event: { id: "2", type: "health", date: "2026-09-01", title: "Health", recordedAt: "2026-09-01T00:00:00Z", health: { speeds: [], checks: {}, verdict: "good" } } },
    ],
  } as unknown as Passport;

  it("puts the facts, history, condition and passport in order", () => {
    const d = listingDraft({ item, passport, fingerprint: "ABCD-1234", ownNotes: "Light brassing.", included: "Box and cap", condition: { summary: "Clean.", cosmetic: ["Top plate: light wear"], glass: null, mechanical: [], notVisible: ["shutter speeds"] } }, t, date);
    expect(d.title).toBe("Leica M3 · No. 700123 · 1954");
    const order = ["sell.d.about", "sell.d.serialBody", "sell.d.history", "2021-06-10: CLA (A workshop)", "sell.d.health", "sell.d.condition", "Light brassing.", "Top plate: light wear", "sell.d.notShown", "sell.d.included", "Box and cap", "sell.d.passport", "sell.d.questions"];
    let at = -1;
    for (const bit of order) {
      const i = d.body.indexOf(bit);
      expect(i, bit).toBeGreaterThan(at);
      at = i;
    }
    expect(d.body).toContain("ABCD-1234");
  });
  it("leaves out what it doesn't know", () => {
    const d = listingDraft({ item: newItem("lens", "Summicron 50") }, t, date);
    expect(d.title).toBe("Summicron 50");
    expect(d.body).not.toContain("sell.d.history");
    expect(d.body).not.toContain("sell.d.passport");
  });
});
