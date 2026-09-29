import { describe, expect, it } from "vitest";
import { MODELS, actualCost, estimate, formatEstimate, formatUsd, friendlyEstimate, friendlyUsd } from "./pricing";

describe("AI pricing", () => {
  it("prices tokens and searches", () => {
    expect(actualCost({ input_tokens: 1e6, output_tokens: 1e6 }, "claude-sonnet-5")).toBeCloseTo(12);
    expect(actualCost({ input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } }, "claude-haiku-4-5")).toBeCloseTo(0.03);
    expect(actualCost({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1e6 }, "claude-opus-5-5")).toBeCloseTo(0.4);
  });

  it("estimates a range for every action and model", () => {
    for (const m of MODELS)
      for (const a of ["photo", "listing", "value"] as const) {
        const e = estimate(a, m.id);
        expect(e.low).toBeGreaterThan(0);
        expect(e.high).toBeGreaterThan(e.low);
      }
    expect(estimate("listing", "claude-opus-5-5").high).toBeGreaterThan(estimate("listing", "claude-haiku-4-5").high);
  });

  it("formats dollars", () => {
    expect(formatUsd(0.034)).toBe("$0.03");
    expect(formatUsd(0.004)).toBe("<$0.01");
    expect(formatEstimate({ low: 0.012, high: 0.035 })).toBe("$0.01–$0.04");
  });

  it("says costs in plain words", () => {
    expect(friendlyUsd(0.002)).toBe("less than 1 cent");
    expect(friendlyUsd(0.01)).toBe("1 cent");
    expect(friendlyUsd(0.034)).toBe("3 cents");
    expect(friendlyUsd(1.2)).toBe("$1.20");
    expect(friendlyEstimate({ low: 0.012, high: 0.035 })).toBe("1–4 cents");
    expect(friendlyEstimate({ low: 0.004, high: 0.02 })).toBe("up to 2 cents");
    expect(friendlyEstimate({ low: 0.8, high: 1.2 })).toBe("$0.80–$1.20");
  });
});
