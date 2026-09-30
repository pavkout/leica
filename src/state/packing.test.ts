import { describe, expect, it } from "vitest";
import { cardFor, XRAY_CARD } from "../data/xrayCard";
import { newItem } from "./collection";
import { packingList, progress } from "./packing";

describe("packing list", () => {
  it("lists the chosen gear with serials, and film things only for film", () => {
    const m6 = { ...newItem("body", "M6"), serial: "1712345" };
    const film = packingList([m6], { film: true, digital: false, filmRolls: 8 });
    expect(film[0]).toMatchObject({ text: "M6 (No. 1712345)", group: "gear" });
    expect(film.some((i) => i.id === "xrayCard")).toBe(true);
    expect(film.find((i) => i.id === "film")?.vars).toEqual({ n: 8 });
    expect(film.some((i) => i.id === "cards")).toBe(false);
    const digital = packingList([], { film: false, digital: true, filmRolls: 0 });
    expect(digital.some((i) => i.id === "cards")).toBe(true);
    expect(digital.some((i) => i.id === "filmBag")).toBe(false);
    expect(progress(digital, new Set(["cards", "nope"]))).toEqual({ done: 1, total: digital.length });
  });
});

describe("airport card", () => {
  it("has every phrase once, and picks the right one", () => {
    expect(new Set(XRAY_CARD.map((c) => c.tag)).size).toBe(XRAY_CARD.length);
    expect(cardFor("de-AT").tag).toBe("de");
    expect(cardFor("zh-TW").tag).toBe("zh-Hant");
    expect(cardFor("zh-CN").tag).toBe("zh-Hans");
    expect(cardFor("xx").tag).toBe("en");
    expect(XRAY_CARD.filter((c) => c.rtl).map((c) => c.tag).sort()).toEqual(["ar", "he"]);
  });
});
