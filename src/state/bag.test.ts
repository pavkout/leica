import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadBag, saveBag, toggleId } from "./bag";

describe("toggleId", () => {
  it("adds an absent id", () => {
    expect(toggleId(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("removes a present id", () => {
    expect(toggleId(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("doesn't mutate the input array", () => {
    const list = ["a"];
    toggleId(list, "b");
    expect(list).toEqual(["a"]);
  });
});

describe("loadBag/saveBag", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts empty", () => {
    expect(loadBag()).toEqual({ bodyIds: [], lensIds: [], filmIds: [] });
  });

  it("round-trips a saved bag", () => {
    saveBag({ bodyIds: ["m11"], lensIds: ["m-50-1.4", "m-35-2"], filmIds: [] });
    expect(loadBag()).toEqual({ bodyIds: ["m11"], lensIds: ["m-50-1.4", "m-35-2"], filmIds: [] });
  });
});
