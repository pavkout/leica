import { describe, expect, it } from "vitest";
import type { CollectionItem } from "./collection";
import { birthdays, isMilestone, madeYear } from "./birthdays";

const item = (id: string, extra: Partial<CollectionItem>): CollectionItem => ({ id, kind: "body", name: id, ...extra }) as CollectionItem;
const facts = (year: string) => ({ kind: "body" as const, year, source: "x", notes: [] });

describe("camera birthdays", () => {
  it("reads the serial list's year, ranges as about", () => {
    expect(madeYear("1954")).toEqual({ year: 1954, approx: false });
    expect(madeYear("1957/58")).toEqual({ year: 1957, approx: true });
    expect(madeYear(undefined)).toBeNull();
  });
  it("marks milestone ages only", () => {
    expect([1, 5, 10, 25, 50, 70, 75].every(isMilestone)).toBe(true);
    expect([2, 3, 12, 33, 51].some(isMilestone)).toBe(false);
  });
  it("finds this year's milestones and this week's anniversaries", () => {
    const today = new Date(2026, 8, 30);
    const list = birthdays(
      [
        item("m3", { serialFacts: facts("1956") }),
        item("m6", { serialFacts: facts("1983"), acquired: "2021-10-03" }),
        item("lens", { acquired: "2019-09-29" }),
        item("new", { acquired: "2026-09-30" }),
        item("far", { acquired: "2020-12-01" }),
      ],
      today,
    );
    expect(list.map((b) => `${b.item.id}:${b.kind}:${b.years}`)).toEqual(["lens:owned:7", "m6:owned:5", "m3:made:70"]);
    expect(list[0]).toMatchObject({ inDays: -1 });
  });
  it("marks 29 February on the 28th in other years", () => {
    const [b] = birthdays([item("leap", { acquired: "2024-02-29" })], new Date(2026, 1, 28));
    expect(b).toMatchObject({ kind: "owned", years: 2, inDays: 0 });
  });
});
