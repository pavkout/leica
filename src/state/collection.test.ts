import { describe, expect, it } from "vitest";
import { collectionCsv, latestValuation, monthsSinceService, newItem, sorted, upsert } from "./collection";

describe("collection", () => {
  it("adds and updates by id", () => {
    const a = newItem("body", " M6 ", { serial: "1234567" });
    expect(a.name).toBe("M6");
    let list = upsert([], a);
    list = upsert(list, { ...a, serial: "7654321" });
    expect(list).toHaveLength(1);
    expect(list[0].serial).toBe("7654321");
  });

  it("sorts bodies before lenses, oldest first", () => {
    const list = [newItem("lens", "Summicron", { acquired: "2020-01-01" }), newItem("body", "M11", { acquired: "2023-05-01" }), newItem("body", "M3", { acquired: "2001-03-01" })];
    expect(sorted(list).map((i) => i.name)).toEqual(["M3", "M11", "Summicron"]);
  });

  it("counts months since the last service", () => {
    const item = newItem("body", "M6", { serviced: "2025-09-15" });
    expect(monthsSinceService(item, new Date(2026, 8, 29))).toBe(12);
    expect(monthsSinceService(newItem("body", "M3"), new Date())).toBeNull();
  });

  it("exports CSV with quoting", () => {
    const csv = collectionCsv([newItem("lens", "Summilux-M 35 f/1.4", { notes: "Bought in Wetzlar, 2019" })]);
    expect(csv).toContain('"Bought in Wetzlar, 2019"');
    expect(csv.split("\r\n")[0]).toBe("kind,name,serial,acquired,price,filter,serviced,notes,serial_model,serial_year,value_low,value_high,value_currency,value_date,value_sources");
  });

  it("exports serial facts and the latest valuation", () => {
    const item = newItem("body", "M3", {
      serial: "700001",
      serialFacts: { kind: "body", model: "M3", year: "1954", source: "Leitz", notes: [] },
      valuations: [{ at: "2026-09-01T10:00:00Z", modelUsed: "claude-sonnet-5", range: { low: 1900, high: 2200, currency: "EUR", count: 3 }, comparables: [], note: "", costUsd: 0.1 }],
    });
    expect(collectionCsv([item]).split("\r\n")[1]).toMatch(/,M3,1954,1900,2200,EUR,2026-09-01,0$/);
  });

  it("marks a valuation over a year old as stale", () => {
    const v = { at: "2025-01-01T00:00:00Z", modelUsed: "x", range: null, comparables: [], note: "", costUsd: 0 };
    expect(latestValuation(newItem("lens", "Summicron", { valuations: [v] }), new Date("2026-09-29"))?.stale).toBe(true);
    expect(latestValuation(newItem("lens", "Summicron"), new Date())).toBeNull();
  });

  it("loads an old saved item without the new fields", () => {
    const old = JSON.parse('{"id":"a","kind":"body","name":"M6","serial":"1234567"}');
    expect(collectionCsv([old])).toContain("M6,1234567");
  });
});
