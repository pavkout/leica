import { t, tn } from "../../i18n";
// What a Claude run costs, in US dollars, from Anthropic's published list
// prices. One table, one "as of" date: when Anthropic changes prices, change
// the numbers here. Estimates are ranges from typical token counts per action;
// the actual cost is computed from the usage the API reports.

export type ModelId = "claude-haiku-4-5" | "claude-sonnet-5" | "claude-opus-5-5";
export type AiAction = "photo" | "listing" | "value" | "critique" | "review" | "condition";

export interface ModelPrice {
  id: ModelId;
  label: string;
  /** The choice in plain words, for people who don't know the model names. */
  plain: string;
  /** US dollars per million input / output tokens. */
  inPerM: number;
  outPerM: number;
  note: string;
}

export const PRICES_AS_OF = "2026-09-29";
export const PRICING_URL = "https://platform.claude.com/docs/en/about-claude/pricing";
export const WEB_SEARCH_PER_1000 = 10;
export const DEFAULT_MODEL: ModelId = "claude-sonnet-5";

export const MODELS: ModelPrice[] = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5", plain: "Cheapest", inPerM: 1, outPerM: 5, note: "Costs least. Can miss small engravings." },
  { id: "claude-sonnet-5", label: "Sonnet 5", plain: "Recommended", inPerM: 2, outPerM: 10, note: "Reads engraved serial numbers well. The best balance." },
  { id: "claude-opus-5-5", label: "Opus 5.5", plain: "Most careful", inPerM: 4, outPerM: 20, note: "Costs most. For rare or valuable pieces." },
];

export const ACTION_LABEL: Record<AiAction, string> = {
  photo: "Identify a photo",
  listing: "Check a listing",
  value: "Find the value",
  critique: "Photo feedback",
  review: "Roll review",
  condition: "Condition description",
};

export function modelPrice(id: ModelId): ModelPrice {
  return MODELS.find((m) => m.id === id) ?? MODELS[1];
}

/** Typical token counts per action: [low, high]. Searches are web searches. */
const TYPICAL: Record<AiAction, { input: [number, number]; output: [number, number]; searches: [number, number] }> = {
  photo: { input: [3000, 10000], output: [600, 1500], searches: [0, 0] },
  listing: { input: [15000, 60000], output: [1500, 4000], searches: [2, 5] },
  value: { input: [10000, 40000], output: [1000, 3000], searches: [2, 5] },
  critique: { input: [2500, 6000], output: [700, 1600], searches: [0, 0] },
  review: { input: [3000, 14000], output: [800, 2500], searches: [0, 0] },
  condition: { input: [6000, 14000], output: [700, 1800], searches: [0, 0] },
};

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

export function actualCost(usage: UsageLike, model: ModelId): number {
  const p = modelPrice(model);
  const input =
    usage.input_tokens * p.inPerM + (usage.cache_creation_input_tokens ?? 0) * p.inPerM * 1.25 + (usage.cache_read_input_tokens ?? 0) * p.inPerM * 0.1;
  const output = usage.output_tokens * p.outPerM;
  const searches = (usage.server_tool_use?.web_search_requests ?? 0) * (WEB_SEARCH_PER_1000 / 1000);
  return (input + output) / 1e6 + searches;
}

export function estimate(action: AiAction, model: ModelId): { low: number; high: number } {
  const t = TYPICAL[action];
  const at = (i: 0 | 1) =>
    actualCost({ input_tokens: t.input[i], output_tokens: t.output[i], server_tool_use: { web_search_requests: t.searches[i] } }, model);
  return { low: at(0), high: at(1) };
}

export function formatUsd(n: number): string {
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

const cents = (n: number) => tn("ai.cents", n);

/** Plain words for a cost: "less than 1 cent", "3 cents", "$1.20". */
export function friendlyUsd(n: number): string {
  if (n < 0.005) return t("ai.lessThanCent");
  if (n < 1) return cents(Math.round(n * 100));
  return `$${n.toFixed(2)}`;
}

/** Plain words for an estimate: "up to 2 cents", "1–4 cents", "$0.80–$1.20". */
export function friendlyEstimate(e: { low: number; high: number }): string {
  if (e.high >= 1) return `$${e.low.toFixed(2)}–$${e.high.toFixed(2)}`;
  const lo = Math.round(e.low * 100);
  const hi = Math.max(1, Math.round(e.high * 100));
  if (lo < 1) return t("ai.upTo", { cost: cents(hi) });
  if (lo === hi) return t("ai.about", { cost: cents(hi) });
  return t("ai.range", { lo, cost: cents(hi) });
}

export function formatEstimate(e: { low: number; high: number }): string {
  const a = formatUsd(e.low);
  const b = formatUsd(e.high);
  return a === b ? `about ${a}` : `${a}–${b}`;
}
