// The languages the app speaks. English is the source; every other language
// is a partial dictionary that falls back to English key by key, so a page
// that isn't translated yet still reads (in English) rather than breaking.

export type Lang = "en" | "de" | "fr" | "ja" | "zh" | "ko";

export interface Language {
  id: Lang;
  /** The language's name in itself, as shown in the picker. */
  native: string;
  /** The name in English, for screen readers and the picker's second line. */
  english: string;
  /** BCP 47 tag for `<html lang>` and Intl. */
  tag: string;
}

export const LANGUAGES: Language[] = [
  { id: "en", native: "English", english: "English", tag: "en" },
  { id: "de", native: "Deutsch", english: "German", tag: "de" },
  { id: "fr", native: "Français", english: "French", tag: "fr" },
  { id: "ja", native: "日本語", english: "Japanese", tag: "ja" },
  { id: "zh", native: "简体中文", english: "Chinese (Simplified)", tag: "zh-Hans" },
  { id: "ko", native: "한국어", english: "Korean", tag: "ko" },
];

export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && LANGUAGES.some((l) => l.id === x);
}

export function languageOf(id: Lang): Language {
  return LANGUAGES.find((l) => l.id === id)!;
}

/**
 * The first of the browser's preferred languages the app speaks, by primary
 * subtag ("de-AT" → de, "zh-CN" → zh). Traditional Chinese (zh-TW, zh-HK,
 * zh-Hant) isn't offered, so it falls through to the next preference rather
 * than being shown Simplified characters.
 */
export function detectLang(preferences: readonly string[] | undefined): Lang {
  for (const raw of preferences ?? []) {
    const tag = raw.toLowerCase();
    const primary = tag.split("-")[0];
    if (primary === "zh" && /-(tw|hk|mo|hant)\b/.test(tag)) continue;
    if (isLang(primary)) return primary;
  }
  return "en";
}
