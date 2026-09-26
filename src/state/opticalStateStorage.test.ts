import { describe, expect, it, vi, afterEach } from "vitest";
import { decodeMaybeInfinite, encodeMaybeInfinite } from "./opticalStateStorage";

describe("encodeMaybeInfinite/decodeMaybeInfinite", () => {
  it("round-trips a finite number", () => {
    expect(encodeMaybeInfinite(2000)).toBe(2000);
    expect(decodeMaybeInfinite(2000, 0)).toBe(2000);
  });

  it("round-trips Infinity through the 'inf' sentinel instead of losing it to JSON", () => {
    // This is the bug this module exists to avoid: JSON.stringify(Infinity) is `null`,
    // so a naive round-trip would silently turn "focused at infinity" into 0/null.
    const encoded = encodeMaybeInfinite(Infinity);
    expect(encoded).toBe("inf");
    expect(JSON.parse(JSON.stringify({ v: encoded })).v).toBe("inf");
    expect(decodeMaybeInfinite(encoded, 999)).toBe(Infinity);
  });

  it("falls back for missing/corrupt values", () => {
    expect(decodeMaybeInfinite(undefined, 42)).toBe(42);
    // @ts-expect-error deliberately malformed input, as corrupt storage would produce
    expect(decodeMaybeInfinite("not-a-number", 42)).toBe(42);
    expect(decodeMaybeInfinite(NaN, 42)).toBe(42);
  });
});

describe("loadLastUsed/saveLastUsed", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips through the persistence service", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    });
    const { loadLastUsed, saveLastUsed } = await import("./opticalStateStorage");
    expect(loadLastUsed()).toEqual({});
    saveLastUsed({
      bodyId: "m11",
      lensId: "m-50-1.4",
      fNumber: 1.4,
      focusMm: "inf",
      backgroundOffsetMm: "inf",
      megapixels: 60,
      cropFocalMm: null,
      standard: "engraved",
      units: "metric",
      filmId: "portra400",
      isoDigital: 400,
      autoExposure: true,
      manualShutter: 1 / 60,
      tripod: false,
      filmEI: null,
      pushPullStops: 0,
    });
    expect(loadLastUsed()).toMatchObject({ bodyId: "m11", lensId: "m-50-1.4", focusMm: "inf" });
  });
});
