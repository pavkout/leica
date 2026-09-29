import { describe, expect, it } from "vitest";
import { LENS_SERIALS, lensYear, parseSerial } from "./lensSerials";

describe("lens serials", () => {
  it("reads serials as people type them", () => {
    expect(parseSerial("2,254,401")).toBe(2254401);
    expect(parseSerial("No. 3 882 996")).toBe(3882996);
    expect(parseSerial("12ab")).toBeNull();
  });

  it("finds the year, matching the published table", () => {
    expect(lensYear(2254401)).toEqual({ kind: "years", ranges: [{ from: 2254401, to: 2312750, year: 1968 }] });
    expect(lensYear(4020000)).toMatchObject({ kind: "years", ranges: [{ year: 2005 }] });
  });

  it("gives both years where published ranges overlap", () => {
    const a = lensYear(3610500);
    expect(a.kind).toBe("years");
    if (a.kind === "years") expect(a.ranges.map((r) => r.year)).toEqual([1992, 1993]);
  });

  it("says so when a serial falls in a published gap, or outside the table", () => {
    expect(lensYear(3584500).kind).toBe("gap");
    expect(lensYear(100000).kind).toBe("before");
    expect(lensYear(4200000).kind).toBe("after");
  });

  it("the table runs in order", () => {
    for (let i = 1; i < LENS_SERIALS.length; i++) expect(LENS_SERIALS[i].year).toBe(LENS_SERIALS[i - 1].year + 1);
  });
});
