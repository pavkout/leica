import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getString, getVersioned, removeItem, setString, setVersioned } from "./persistence";

/** A minimal in-memory `Storage`, stubbed in as `window.localStorage`. */
function fakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: fakeStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getString/setString", () => {
  it("round-trips a value", () => {
    setString("k", "hello");
    expect(getString("k")).toBe("hello");
  });

  it("returns null for a missing key", () => {
    expect(getString("missing")).toBeNull();
  });

  it("removeItem clears a key", () => {
    setString("k", "hello");
    removeItem("k");
    expect(getString("k")).toBeNull();
  });

  it("read/write never throw when storage rejects the call", () => {
    const storage = window.localStorage;
    const setSpy = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => setString("k", "v")).not.toThrow();
    expect(setString("k", "v")).toBe(false);
    setSpy.mockRestore();

    const getSpy = vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => getString("k")).not.toThrow();
    expect(getString("k")).toBeNull();
    getSpy.mockRestore();
  });

  it("returns null when there is no window (e.g. SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(getString("k")).toBeNull();
    expect(setString("k", "v")).toBe(false);
  });
});

describe("getVersioned/setVersioned", () => {
  it("round-trips a value at the current version", () => {
    setVersioned("bag", 1, { bodyId: "m11" });
    expect(getVersioned("bag", 1, null)).toEqual({ bodyId: "m11" });
  });

  it("returns the fallback when nothing is stored", () => {
    expect(getVersioned("bag", 1, "default")).toBe("default");
  });

  it("returns the fallback for corrupt JSON", () => {
    setString("bag", "{not json");
    expect(getVersioned("bag", 1, "default")).toBe("default");
  });

  it("returns the fallback for a malformed envelope", () => {
    setString("bag", JSON.stringify({ notAnEnvelope: true }));
    expect(getVersioned("bag", 1, "default")).toBe("default");
  });

  it("migrates a value forward one step at a time", () => {
    setVersioned("bag", 1, { bodyId: "m11" });
    const migrate = vi.fn((value: unknown, fromVersion: number) => {
      expect(fromVersion).toBe(1);
      return { ...(value as object), lensId: "m-50-1.4" };
    });
    const result = getVersioned("bag", 2, null, migrate);
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ bodyId: "m11", lensId: "m-50-1.4" });
  });

  it("falls back when the stored version is older and no migrate is given", () => {
    setVersioned("bag", 1, { bodyId: "m11" });
    expect(getVersioned("bag", 2, "default")).toBe("default");
  });

  it("leaves a value alone when its stored version is already current or newer", () => {
    setVersioned("bag", 5, { bodyId: "m11" });
    const migrate = vi.fn((v: unknown) => v);
    expect(getVersioned("bag", 2, "default", migrate)).toEqual({ bodyId: "m11" });
    expect(migrate).not.toHaveBeenCalled();
  });
});
