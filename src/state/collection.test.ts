import { describe, expect, it } from "vitest";
import { collectionCsv, monthsSinceService, newItem, sorted, upsert } from "./collection";

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
    expect(csv.split("\r\n")[0]).toBe("kind,name,serial,acquired,price,filter,serviced,notes");
  });
});
