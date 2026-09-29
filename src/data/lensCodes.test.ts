import { describe, expect, it } from "vitest";
import { LENSES } from "./gear";
import { LENS_CODES, codeForLensName, codeNumber, decode, retrofittable } from "./lensCodes";

describe("6-bit lens codes", () => {
  it("every code is six bits and unique", () => {
    const seen = new Set<string>();
    for (const c of LENS_CODES) {
      expect(c.bits).toMatch(/^[01]{6}$/);
      expect(seen.has(c.bits)).toBe(false);
      seen.add(c.bits);
    }
  });

  it("reads bits as the tables print the number", () => {
    expect(codeNumber("110100")).toBe(52);
    expect(codeNumber("000001")).toBe(1);
  });

  it("decodes a pattern back to its lens", () => {
    expect(decode("100100").map((c) => c.name)).toEqual(["APO-Summicron-M 75 f/2 ASPH."]);
    expect(decode("111111")).toEqual([]);
  });

  it("knows which lenses Leica lists for retrofitting", () => {
    expect(retrofittable(LENS_CODES.find((c) => c.orders.includes("11879"))!)).toBe(true);
    // Lenses made coded from the start aren't on the retrofit list.
    expect(retrofittable(LENS_CODES.find((c) => c.orders.includes("11647"))!)).toBe(false);
  });

  it("finds the code for catalogue lenses by name", () => {
    const summilux21 = LENSES.find((l) => l.name === "Summilux-M 21 f/1.4 ASPH.");
    if (summilux21) expect(codeForLensName(summilux21.name)?.bits).toBe("101111");
    expect(codeForLensName("Some Other Lens 50 f/2")).toBeUndefined();
    // Versions share a family name with different codes: never guess between them.
    expect(codeForLensName("Summicron-M 50 f/2")).toBeUndefined();
    expect(codeForLensName("Summilux-M 35 f/1.4 ASPH.")).toBeUndefined();
  });
});
