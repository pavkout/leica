import { describe, expect, it } from "vitest";
import { formatDistance, parseDistanceInput, scaleLabel } from "./format";

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
