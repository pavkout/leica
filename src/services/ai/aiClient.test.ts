import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkListing, identifyPhoto, setTransport, valueItem } from "./aiClient";
import { fakeMessage, fakeTransport, reportBlock, textBlock } from "./fakeClient";
import { loadSpend } from "./spendLog";
import { newItem } from "../../state/collection";

const store = new Map<string, string>();
let restore: () => void = () => {};
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
afterEach(() => restore());

const KEY = "sk-ant-test";
const img = { base64: "AAAA", mediaType: "image/jpeg" as const, dataUrl: "data:image/jpeg;base64,AAAA" };
const reading = {
  kind: "body", maker: "Leitz", model: "M3", lensName: null, serial: "919251", serialLegible: "yes", engravings: [],
  finish: "chrome", visibleCondition: null, confidence: { model: "high", serial: "high" }, whatWouldHelp: null,
};
const comp = (price: number) => ({ url: `https://a.example/${price}`, title: "M3", price, currency: "EUR", kind: "sold", date: null, condition: null });

describe("AI client", () => {
  it("needs a key and never calls out without one", async () => {
    const t = fakeTransport([]);
    restore = setTransport(t);
    await expect(identifyPhoto(null, "claude-sonnet-5", [img])).rejects.toMatchObject({ kind: "no-key" });
    expect(t.sent).toHaveLength(0);
  });

  it("identifies a photo with a JSON schema, and records the cost", async () => {
    const t = fakeTransport([fakeMessage([textBlock(JSON.stringify(reading))])]);
    restore = setTransport(t);
    const { reading: r, cost } = await identifyPhoto(KEY, "claude-sonnet-5", [img]);
    expect(r.model).toBe("M3");
    expect(cost.usd).toBeCloseTo(0.004);
    expect(t.sent[0].output_config?.format?.type).toBe("json_schema");
    expect(t.sent[0].output_config?.effort).toBe("medium");
    expect(loadSpend()).toHaveLength(1);
  });

  it("does not send effort to Haiku", async () => {
    const t = fakeTransport([fakeMessage([textBlock(JSON.stringify(reading))])]);
    restore = setTransport(t);
    await identifyPhoto(KEY, "claude-haiku-4-5", [img]);
    expect(t.sent[0].output_config?.effort).toBeUndefined();
  });

  it("says unreadable for malformed output, and still records what was spent", async () => {
    restore = setTransport(fakeTransport([fakeMessage([textBlock("{not json")])]));
    await expect(identifyPhoto(KEY, "claude-sonnet-5", [img])).rejects.toMatchObject({ kind: "unreadable" });
    expect(loadSpend()).toHaveLength(1);
  });

  it("maps a refusal", async () => {
    restore = setTransport(fakeTransport([fakeMessage([], "refusal")]));
    await expect(identifyPhoto(KEY, "claude-sonnet-5", [img])).rejects.toMatchObject({ kind: "refused" });
  });

  it("maps API errors", async () => {
    restore = setTransport(fakeTransport([Object.assign(new Error("invalid x-api-key"), { status: 401 })]));
    await expect(identifyPhoto(KEY, "claude-sonnet-5", [img])).rejects.toMatchObject({ kind: "bad-key" });
  });

  it("continues a paused research turn until the report arrives, billing each round", async () => {
    const report = { comparables: [comp(1900), comp(2000), comp(2200)], note: "three sales" };
    const t = fakeTransport([
      fakeMessage([textBlock("searching")], "pause_turn", { server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 } }),
      fakeMessage([reportBlock(report)], "tool_use"),
    ]);
    restore = setTransport(t);
    const { price, cost } = await valueItem(KEY, "claude-sonnet-5", newItem("body", "Leica M3"));
    expect(price.range).toEqual({ low: 1900, high: 2200, currency: "EUR", count: 3 });
    expect(t.sent).toHaveLength(2);
    expect(t.sent[1].messages[t.sent[1].messages.length - 1].role).toBe("assistant");
    expect(cost.searches).toBe(2);
    expect(loadSpend()).toHaveLength(2);
    expect(t.sent[0].tools?.map((x) => ("type" in x && x.type) || x.name)).toEqual(["web_search_20260209", "web_fetch_20260209", "report"]);
  });

  it("nudges once when the model answers without the report tool", async () => {
    const t = fakeTransport([fakeMessage([textBlock("done")]), fakeMessage([textBlock("still no tool")])]);
    restore = setTransport(t);
    await expect(valueItem(KEY, "claude-haiku-4-5", newItem("lens", "Summicron"))).rejects.toMatchObject({ kind: "unreadable" });
    expect(t.sent).toHaveLength(2);
    expect(t.sent[0].tools?.[0]).toMatchObject({ type: "web_search_20250305" });
  });

  it("reports a listing it couldn't fetch as blocked unless text was pasted", async () => {
    const report = {
      fetched: false, title: null, kind: "unknown", maker: null, model: null, statedSerial: null, statedYear: null,
      askingPrice: null, askingCurrency: null, redFlags: [], comparables: [], note: "could not fetch",
    };
    restore = setTransport(fakeTransport([fakeMessage([reportBlock(report)], "tool_use")]));
    await expect(checkListing(KEY, "claude-sonnet-5", "https://www.example.com/itm/1")).rejects.toMatchObject({ kind: "blocked" });
    restore();
    restore = setTransport(fakeTransport([fakeMessage([reportBlock({ ...report, model: "M3" })], "tool_use")]));
    const { report: r } = await checkListing(KEY, "claude-sonnet-5", "https://www.example.com/itm/1", "Leica M3, serial 700123, €2,400");
    expect(r.model).toBe("M3");
  });
});

describe("the reader's language", () => {
  it("leaves English prompts alone and asks for other languages' words", async () => {
    const { inReadersLanguage } = await import("./aiClient");
    const { __setDictForTest } = await import("../../i18n");
    const en = (await import("../../i18n/locales/en")).default;
    expect(inReadersLanguage("SYS")).toBe("SYS");
    __setDictForTest("ja", {});
    expect(inReadersLanguage("SYS")).toMatch(/^SYS\n\nWrite every free-text field meant for the user in Japanese\./);
    __setDictForTest("en", en);
  });
});

describe("photo feedback", () => {
  it("returns the critique and refuses a malformed one", async () => {
    const { critiquePhoto, setTransport: set } = await import("./aiClient");
    const good = { summary: "A quiet street at dusk.", strengths: ["Warm light on the wall"], improvements: ["Level the horizon", "Wait for a figure"], exposure: null, focus: "Sharp on the door.", composition: null, tryNext: "Shoot five frames of one doorway." };
    let restore = set(async () => fakeMessage([textBlock(JSON.stringify(good))]));
    const out = await critiquePhoto("sk-ant-x", "claude-sonnet-5", { base64: "AA", mediaType: "image/jpeg", dataUrl: "" }, "f/2, 1/60, HP5");
    expect(out.critique).toEqual(good);
    restore();
    restore = set(async () => fakeMessage([textBlock(JSON.stringify({ summary: 3 }))]));
    await expect(critiquePhoto("sk-ant-x", "claude-sonnet-5", { base64: "AA", mediaType: "image/jpeg", dataUrl: "" }, "")).rejects.toMatchObject({ kind: "unreadable" });
    restore();
  });
});
