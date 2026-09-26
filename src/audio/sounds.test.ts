import { describe, expect, it } from "vitest";
import { rateLimit } from "./sounds";

describe("rateLimit", () => {
  it("allows the first call for a key", () => {
    const state = new Map<string, number>();
    expect(rateLimit(state, "a", 30, 1000)).toBe(true);
  });

  it("blocks a call too soon after the previous one for the same key", () => {
    const state = new Map<string, number>();
    rateLimit(state, "a", 30, 1000);
    expect(rateLimit(state, "a", 30, 1010)).toBe(false);
  });

  it("allows a call once the interval has fully passed", () => {
    const state = new Map<string, number>();
    rateLimit(state, "a", 30, 1000);
    expect(rateLimit(state, "a", 30, 1031)).toBe(true);
  });

  it("tracks separate keys independently, so one kind of click never blocks another", () => {
    const state = new Map<string, number>();
    rateLimit(state, "aperture", 30, 1000);
    expect(rateLimit(state, "dial", 30, 1005)).toBe(true);
  });

  it("cleanly rate-limits a burst of rapid calls to one per interval", () => {
    const state = new Map<string, number>();
    const allowedAt = [0, 5, 10, 15, 31, 35, 62].filter((now) => rateLimit(state, "a", 30, now));
    expect(allowedAt).toEqual([0, 31, 62]);
  });
});
