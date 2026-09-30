import { afterEach, describe, expect, it } from "vitest";
import { __setDictForTest, detectLang, t, tn, translated, getLang } from "./index";
import en from "./locales/en";
import de from "./locales/de";
import fr from "./locales/fr";
import ja from "./locales/ja";
import zh from "./locales/zh";
import ko from "./locales/ko";
import { TOOLS } from "../app/tools";

const all = { de, fr, ja, zh, ko };
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => __setDictForTest("en", en));

describe("language detection", () => {
  it("takes the first supported primary subtag", () => {
    expect(detectLang(["de-AT", "en"])).toBe("de");
    expect(detectLang(["pt-BR", "fr-CA"])).toBe("fr");
    expect(detectLang(["ko-KR"])).toBe("ko");
    expect(detectLang(["zh-CN"])).toBe("zh");
    expect(detectLang(["zh-Hans-SG"])).toBe("zh");
  });
  it("doesn't show Simplified Chinese to Traditional readers", () => {
    expect(detectLang(["zh-TW", "ja"])).toBe("ja");
    expect(detectLang(["zh-Hant-HK"])).toBe("en");
  });
  it("defaults to English", () => {
    expect(detectLang([])).toBe("en");
    expect(detectLang(undefined)).toBe("en");
    expect(detectLang(["pt"])).toBe("en");
  });
});

describe("lookup", () => {
  it("falls back to English, then the key", () => {
    __setDictForTest("de", { "common.close": "Schließen" });
    expect(getLang()).toBe("de");
    expect(t("common.close")).toBe("Schließen");
    expect(t("common.save")).toBe("Save");
    expect(t("no.such.key")).toBe("no.such.key");
    expect(translated("common.close")).toBe(true);
    expect(translated("common.save")).toBe(false);
  });
  it("fills variables", () => {
    expect(t("picker.lenses", { body: "M6" })).toBe("Lenses for the M6");
  });
  it("counts with the language's plural rules", () => {
    const d = { ...en, "x_one": "{n} frame", "x_other": "{n} frames" };
    __setDictForTest("en", d);
    expect(tn("x", 1)).toBe("1 frame");
    expect(tn("x", 3)).toBe("3 frames");
    __setDictForTest("ja", { "x_other": "{n}コマ" });
    expect(tn("x", 1)).toBe("1コマ");
  });
  it("names every tool in English from the tool list", () => {
    for (const tool of TOOLS) {
      expect(en[`tool.${tool.id}`]).toBe(tool.label);
      expect(en[`tool.${tool.id}.blurb`]).toBe(tool.blurb);
    }
  });
});

describe.each(Object.entries(all))("%s dictionary", (_lang, dict) => {
  it("only has keys English has", () => {
    const extra = Object.keys(dict).filter((k) => !(k in en) && !/_(zero|one|two|few|many|other)$/.test(k));
    expect(extra).toEqual([]);
  });
  it("keeps every placeholder", () => {
    const wrong = Object.entries(dict).filter(([k, v]) => k in en && placeholders(v).join() !== placeholders(en[k]).join());
    expect(wrong).toEqual([]);
  });
  it("translates every tool and mode name", () => {
    const missing = Object.keys(en).filter((k) => /^(tool|mode)\./.test(k) && !(k in dict));
    expect(missing).toEqual([]);
  });
  it("translates every new feature's page completely", () => {
    // Camera passport, health check, Photography Lab, Photo walks, Which Leica (#41–#45), and the Collectors pages.
    const feature = /^(passport|health|lab|walk|match|col|ai|serial|sn|mu|dev|fs|neg|pr|tag|calc|sun|travel|pack|fb|care)\./;
    const plural = /_(zero|one|two|few|many|other)$/;
    const missing = Object.keys(en).filter((k) => feature.test(k) && en[k].trim() && !(k in dict) && !(plural.test(k) && k.replace(plural, "_other") in dict));
    expect(missing).toEqual([]);
  });
  it("has no empty entries", () => {
    expect(Object.entries(dict).filter(([, v]) => !v.trim())).toEqual([]);
  });
});

describe("the serial page's model notes", () => {
  it("say what the data file says", async () => {
    const { MODEL_NOTES } = await import("../data/bodySerials");
    for (const [model, note] of Object.entries(MODEL_NOTES)) expect(en[`sn.model.${model}`]).toBe(note);
  });
});

describe("keys used in the code", () => {
  it("all exist in English", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f.name) && !/\.test\./.test(f.name) && !p.includes(`${path.sep}locales${path.sep}`) && !p.endsWith(`i18n${path.sep}index.ts`)) files.push(p);
      }
    };
    walk(path.resolve(__dirname, ".."));
    const missing = new Set<string>();
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bt[n]?\(\s*"([a-zA-Z0-9_.]+)"/g)) {
        const key = m[1];
        const isCount = /\btn\(/.test(m[0]);
        if (isCount ? !(`${key}_other` in en) : !(key in en)) missing.add(`${path.basename(file)}: ${key}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
