// What a Claude run costs, in US dollars, from Anthropic's published list
// prices. One table, one "as of" date: when Anthropic changes prices, change
// the numbers here. Estimates are ranges from typical token counts per action;
// the actual cost is computed from the usage the API reports.

export type ModelId = "claude-haiku-4-5" | "claude-sonnet-5" | "claude-opus-5-5";
export type AiAction = "photo" | "listing" | "value";

export interface ModelPrice {
  id: ModelId;
  label: string;
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
  { id: "claude-haiku-4-5", label: "Haiku 4.5", inPerM: 1, outPerM: 5, note: "Cheapest. Lower image resolution, so weaker at small engravings." },
  { id: "claude-sonnet-5", label: "Sonnet 5", inPerM: 2, outPerM: 10, note: "Recommended. Reads engraved serials well at full resolution." },
  { id: "claude-opus-5-5", label: "Opus 5.5", inPerM: 4, outPerM: 20, note: "Strongest. Worth it for hard or high-value items." },
];

export const ACTION_LABEL: Record<AiAction, string> = {
  photo: "Identify from photos",
  listing: "Check a listing",
  value: "Suggest a value",
};

export function modelPrice(id: ModelId): ModelPrice {
  return MODELS.find((m) => m.id === id) ?? MODELS[1];
}

/** Typical token counts per action: [low, high]. Searches are web searches. */
const TYPICAL: Record<AiAction, { input: [number, number]; output: [number, number]; searches: [number, number] }> = {
  photo: { input: [3000, 10000], output: [600, 1500], searches: [0, 0] },
  listing: { input: [15000, 60000], output: [1500, 4000], searches: [2, 5] },
  value: { input: [10000, 40000], output: [1000, 3000], searches: [2, 5] },
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

export function formatEstimate(e: { low: number; high: number }): string {
  const a = formatUsd(e.low);
  const b = formatUsd(e.high);
  return a === b ? `about ${a}` : `${a}–${b}`;
}
