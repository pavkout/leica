// The user's own Anthropic key and model choices, kept on this device only.
// Nothing here is sent anywhere except the key, to Anthropic, with a request.

import { getString, removeItem, setString } from "../persistence";
import { DEFAULT_MODEL, MODELS, type AiAction, type ModelId } from "./pricing";

export interface AiSettings {
  key: string | null;
  model: ModelId;
  perAction: Partial<Record<AiAction, ModelId>>;
  /** US dollars per calendar month; null means no limit. */
  monthlyLimitUsd: number | null;
}

const KEY = "rangefinder-ai-settings";
const SECRET = "rangefinder-ai-key";

const isModel = (m: unknown): m is ModelId => MODELS.some((x) => x.id === m);

export function loadAiSettings(): AiSettings {
  let raw: Partial<AiSettings>;
  try {
    raw = JSON.parse(getString(KEY) ?? "{}") ?? {};
  } catch {
    raw = {};
  }
  const perAction: Partial<Record<AiAction, ModelId>> = {};
  for (const a of ["photo", "listing", "value"] as const) if (isModel(raw.perAction?.[a])) perAction[a] = raw.perAction![a];
  const limit = typeof raw.monthlyLimitUsd === "number" && raw.monthlyLimitUsd > 0 ? raw.monthlyLimitUsd : null;
  return { key: getString(SECRET) || null, model: isModel(raw.model) ? raw.model : DEFAULT_MODEL, perAction, monthlyLimitUsd: limit };
}

export function saveAiSettings(s: AiSettings): boolean {
  const ok = setString(KEY, JSON.stringify({ model: s.model, perAction: s.perAction, monthlyLimitUsd: s.monthlyLimitUsd }));
  if (s.key) return setString(SECRET, s.key.trim()) && ok;
  removeItem(SECRET);
  return ok;
}

export function forgetKey(): void {
  removeItem(SECRET);
}

export function modelFor(s: AiSettings, action: AiAction): ModelId {
  return s.perAction[action] ?? s.model;
}

/** Anthropic keys start "sk-ant-"; a light check to catch a pasted wrong thing. */
export function looksLikeKey(k: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim());
}

export function maskKey(k: string): string {
  const t = k.trim();
  return t.length > 12 ? `${t.slice(0, 7)}…${t.slice(-4)}` : "…";
}
