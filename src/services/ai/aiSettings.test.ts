import { beforeEach, describe, expect, it } from "vitest";
import { forgetKey, loadAiSettings, looksLikeKey, maskKey, modelFor, saveAiSettings } from "./aiSettings";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
});

describe("AI settings", () => {
  it("defaults to Sonnet 5, no key, no limit", () => {
    expect(loadAiSettings()).toEqual({ key: null, model: "claude-sonnet-5", perAction: {}, monthlyLimitUsd: null });
  });

  it("round-trips, and forgetting the key keeps the rest", () => {
    const key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz";
    saveAiSettings({ key, model: "claude-opus-5-5", perAction: { photo: "claude-haiku-4-5" }, monthlyLimitUsd: 10 });
    const s = loadAiSettings();
    expect(s).toEqual({ key, model: "claude-opus-5-5", perAction: { photo: "claude-haiku-4-5" }, monthlyLimitUsd: 10 });
    expect(modelFor(s, "photo")).toBe("claude-haiku-4-5");
    expect(modelFor(s, "listing")).toBe("claude-opus-5-5");
    forgetKey();
    expect(loadAiSettings().key).toBeNull();
    expect(loadAiSettings().model).toBe("claude-opus-5-5");
  });

  it("ignores unknown models and corrupt storage", () => {
    store.set("rangefinder-ai-settings", '{"model":"gpt-9","perAction":{"photo":"nope"}}');
    expect(loadAiSettings().model).toBe("claude-sonnet-5");
    store.set("rangefinder-ai-settings", "{not json");
    expect(loadAiSettings().perAction).toEqual({});
  });

  it("checks and masks keys", () => {
    expect(looksLikeKey("sk-ant-api03-abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(looksLikeKey("hello")).toBe(false);
    expect(maskKey("sk-ant-api03-abcdefghijklmnopqrstuvwxyz")).toBe("sk-ant-…wxyz");
  });
});
