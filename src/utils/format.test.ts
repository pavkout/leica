import { describe, expect, it } from "vitest";
import { formatDistance, lensEngraving, parseDistanceInput, scaleLabel, sentenceEnd } from "./format";

describe("parseDistanceInput", () => {
  it("parses a metric value as metres", () => {
    expect(parseDistanceInput("2.5", "metric")).toBeCloseTo(2500, 6);
  });

  it("parses an imperial value as feet", () => {
    expect(parseDistanceInput("6", "imperial")).toBeCloseTo(1828.8, 3);
  });

  it("trims surrounding whitespace", () => {
    expect(parseDistanceInput("  3  ", "metric")).toBeCloseTo(3000, 6);
  });

  it("rejects empty, non-numeric, zero and negative input", () => {
    for (const text of ["", "   ", "abc", "0", "-2", "NaN", "Infinity"]) {
      expect(parseDistanceInput(text, "metric")).toBeNull();
    }
  });

  it("round-trips with scaleLabel for a representative value", () => {
    const mm = 2350;
    const label = scaleLabel(mm, "metric");
    expect(parseDistanceInput(label, "metric")).toBeCloseTo(mm, -1);
  });
});

describe("formatDistance / parseDistanceInput agree on units", () => {
  it("a value that formats as '2.00 m' parses back to 2000mm", () => {
    expect(formatDistance(2000, "metric")).toBe("2.00 m");
    expect(parseDistanceInput("2.00", "metric")).toBeCloseTo(2000, 6);
  });
});

describe("lensEngraving", () => {
  it("sets the aperture and focal length as the front ring does", () => {
    expect(lensEngraving("Summilux-M 35 f/1.4 ASPH.")).toBe("Summilux-M 1:1.4/35 ASPH.");
    expect(lensEngraving("Noctilux-M 50 f/0.95 ASPH.")).toBe("Noctilux-M 1:0.95/50 ASPH.");
    expect(lensEngraving("APO-Telyt-M 135 f/3.4")).toBe("APO-Telyt-M 1:3.4/135");
  });

  it("drops the catalogue's bracketed notes", () => {
    expect(lensEngraving("Summilux 35 f/1.4 (pre-ASPH)")).toBe("Summilux 1:1.4/35");
    expect(lensEngraving("Elmar-M 50 f/2.8 (collapsible)")).toBe("Elmar-M 1:2.8/50");
  });

  it("leaves names outside the pattern alone", () => {
    expect(lensEngraving("Q3 43")).toBe("Q3 43");
  });
});

describe("sentenceEnd", () => {
  it("doesn't double the full stop after ASPH.", () => {
    expect(sentenceEnd("Summilux-M 35 f/1.4 ASPH.")).toBe("Summilux-M 35 f/1.4 ASPH.");
    expect(sentenceEnd("Summicron-M 50 f/2")).toBe("Summicron-M 50 f/2.");
  });
});
