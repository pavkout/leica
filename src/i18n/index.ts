// Translation: `t("key", { name })` returns the current language's text, or
// English when that language has no entry yet. Dictionaries other than
// English load on demand (their own chunks), and `useLang()` re-renders a
// component when the language changes.

import { useSyncExternalStore } from "react";
import { getString, setString } from "../services/persistence";
import en, { type Dict } from "./locales/en";
import { LANGUAGES, detectLang, isLang, languageOf, type Lang } from "./languages";

export { LANGUAGES, detectLang, languageOf, type Lang } from "./languages";
export type { Dict } from "./locales/en";

const STORAGE_KEY = "rangefinder-language";

const loaders: Record<Exclude<Lang, "en">, () => Promise<{ default: Dict }>> = {
  de: () => import("./locales/de"),
  fr: () => import("./locales/fr"),
  ja: () => import("./locales/ja"),
  zh: () => import("./locales/zh"),
  ko: () => import("./locales/ko"),
};

const dicts: Partial<Record<Lang, Dict>> = { en };
let current: Lang = "en";
const listeners = new Set<() => void>();

type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The current language's text for `key`, falling back to English, then to the key itself. */
export function t(key: string, vars?: Vars): string {
  const text = dicts[current]?.[key] ?? en[key] ?? key;
  return fill(text, vars);
}

/**
 * A counted phrase: looks up `key_one`, `key_few`, … `key_other` by the
 * language's plural rules, with `{n}` filled in.
 */
export function tn(key: string, n: number, vars?: Vars): string {
  const rule = new Intl.PluralRules(languageOf(current).tag).select(n);
  const pick = (dicts[current]?.[`${key}_${rule}`] ?? dicts[current]?.[`${key}_other`]) as string | undefined;
  const text = pick ?? en[`${key}_${n === 1 ? "one" : "other"}`] ?? en[`${key}_other`] ?? key;
  return fill(text, { n, ...vars });
}

/** Whether the current language (not the English fallback) has this key. */
export function translated(key: string): boolean {
  return current === "en" ? key in en : key in (dicts[current] ?? {});
}

export function getLang(): Lang {
  return current;
}

/**
 * The locale for Intl formatting: the browser's own when it's a variant of
 * the current language (en-GB dates for a British reader), else the language.
 */
export function langTag(): string {
  const nav = typeof navigator === "undefined" ? "" : navigator.language ?? "";
  if (nav.toLowerCase().split("-")[0] === current) return nav;
  return languageOf(current).tag;
}

function apply(lang: Lang) {
  current = lang;
  if (typeof document !== "undefined") document.documentElement.lang = languageOf(lang).tag;
  listeners.forEach((l) => l());
}

/** Loads the language's dictionary (if needed), switches to it and remembers the choice. */
export async function setLang(lang: Lang, remember = true): Promise<void> {
  if (remember) setString(STORAGE_KEY, lang);
  if (lang !== "en" && !dicts[lang]) {
    try {
      dicts[lang] = (await loaders[lang]()).default;
    } catch {
      // Offline without the chunk cached: stay in the language that's loaded.
      return;
    }
  }
  apply(lang);
}

/** The saved choice, else the browser's preference. */
export function initialLang(): Lang {
  const saved = getString(STORAGE_KEY);
  if (isLang(saved)) return saved;
  return detectLang(typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language]);
}

/** Call once before the first render, so the page doesn't flash English. */
export function initI18n(): Promise<void> {
  const lang = initialLang();
  return lang === "en" ? Promise.resolve(apply("en")) : setLang(lang, false);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The current language; the component re-renders when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** Test helper: install a dictionary without loading a chunk. */
export function __setDictForTest(lang: Lang, dict: Dict | undefined) {
  if (dict) dicts[lang] = dict;
  else delete dicts[lang];
  apply(lang);
}

export const LANGUAGE_IDS: Lang[] = LANGUAGES.map((l) => l.id);
