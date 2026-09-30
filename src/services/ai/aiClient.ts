// The only code in the app that talks to Claude. It runs in the browser with
// the user's own Anthropic key (bring-your-own-key), so photos and links go
// from this device straight to Anthropic. A later paid mode would swap the
// transport for one that goes through our server; nothing else changes.
//
// The SDK is imported lazily, on the first AI action, so it never weighs on
// the app's first load.

import type { ContentBlockParam, Message, MessageCreateParamsNonStreaming, MessageParam, ToolUnion } from "@anthropic-ai/sdk/resources/messages";
import type { CollectionItem } from "../../state/collection";
import { aiError, describeApiError } from "./errors";
import type { PreparedImage } from "./image";
import { actualCost, type AiAction, type ModelId } from "./pricing";
import { LISTING_SCHEMA, PHOTO_SCHEMA, PRICE_SCHEMA, parseListingReport, parsePhotoReading, parsePriceSuggestion, type ListingReport, type PhotoReading, type PriceSuggestion } from "./schemas";
import { LISTING_SYSTEM, PHOTO_PROMPT, PHOTO_SYSTEM, VALUE_SYSTEM, listingPrompt, valuePrompt } from "./prompts";
import { recordSpend } from "./spendLog";
import { getLang, languageOf } from "../../i18n";

/** Sends one Messages API request. Swappable for tests (and, later, a server). */
export type Transport = (key: string, params: MessageCreateParamsNonStreaming) => Promise<Message>;

let sdkTransport: Transport | null = null;

async function defaultTransport(key: string, params: MessageCreateParamsNonStreaming): Promise<Message> {
  if (!sdkTransport) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const clients = new Map<string, InstanceType<typeof Anthropic>>();
    sdkTransport = (k, p) => {
      let c = clients.get(k);
      if (!c) {
        // The key is the user's own and stays on their device; this is the documented browser opt-in.
        c = new Anthropic({ apiKey: k, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 5 * 60 * 1000 });
        clients.set(k, c);
      }
      return c.messages.create(p);
    };
  }
  return sdkTransport(key, params);
}

let transport: Transport = defaultTransport;

/** For tests: replace the transport; returns a function that restores it. */
export function setTransport(t: Transport): () => void {
  const prev = transport;
  transport = t;
  return () => {
    transport = prev;
  };
}

export interface RunCost {
  usd: number;
  input: number;
  output: number;
  searches: number;
}

function effortFor(model: ModelId): MessageCreateParamsNonStreaming["output_config"] {
  // Haiku 4.5 does not take an effort setting.
  return model === "claude-haiku-4-5" ? undefined : { effort: "medium" };
}

function webTools(model: ModelId): ToolUnion[] {
  if (model === "claude-haiku-4-5")
    return [
      { type: "web_search_20250305", name: "web_search", max_uses: 5 },
      { type: "web_fetch_20250910", name: "web_fetch", max_uses: 5 },
    ];
  return [
    { type: "web_search_20260209", name: "web_search", max_uses: 5 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
  ];
}

async function send(key: string | null, action: AiAction | "test", params: MessageCreateParamsNonStreaming, cost: RunCost): Promise<Message> {
  if (!key) throw aiError("no-key");
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw aiError("offline");
  let res: Message;
  try {
    res = await transport(key, params);
  } catch (e) {
    throw describeApiError(e);
  }
  const model = params.model as ModelId;
  const usd = actualCost(res.usage, model);
  const searches = res.usage.server_tool_use?.web_search_requests ?? 0;
  cost.usd += usd;
  cost.input += res.usage.input_tokens;
  cost.output += res.usage.output_tokens;
  cost.searches += searches;
  recordSpend({ at: new Date().toISOString(), action, model, input: res.usage.input_tokens, output: res.usage.output_tokens, searches, usd });
  if (res.stop_reason === "refusal") throw aiError("refused", res.stop_details?.explanation ?? undefined);
  return res;
}

const newCost = (): RunCost => ({ usd: 0, input: 0, output: 0, searches: 0 });

/** A tiny request that proves the key works. Costs a fraction of a cent. */
export async function testKey(key: string, model: ModelId): Promise<RunCost> {
  const cost = newCost();
  await send(key, "test", { model, max_tokens: 16, messages: [{ role: "user", content: "Reply with: ok" }] }, cost);
  return cost;
}

function firstJsonText(res: Message): unknown {
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return null;
  try {
    return JSON.parse(text.text);
  } catch {
    return null;
  }
}

export async function identifyPhoto(key: string | null, model: ModelId, images: PreparedImage[]): Promise<{ reading: PhotoReading; cost: RunCost }> {
  const cost = newCost();
  const content: ContentBlockParam[] = [
    ...images.map((img): ContentBlockParam => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } })),
    { type: "text", text: PHOTO_PROMPT },
  ];
  const res = await send(
    key,
    "photo",
    {
      model,
      max_tokens: 4000,
      system: inReadersLanguage(PHOTO_SYSTEM),
      messages: [{ role: "user", content }],
      output_config: { ...effortFor(model), format: { type: "json_schema", schema: PHOTO_SCHEMA } },
    },
    cost
  );
  const reading = parsePhotoReading(firstJsonText(res));
  if (!reading) throw aiError("unreadable");
  return { reading, cost };
}

/**
 * The reader's language for the answer's own words (condition, warning
 * signs, tips). Names, engravings, serials and quoted listing text stay as
 * they are, so they can still be checked against the lists. English readers
 * get the system prompt unchanged.
 */
export function inReadersLanguage(system: string): string {
  const lang = getLang();
  if (lang === "en") return system;
  return `${system}\n\nWrite every free-text field meant for the user in ${languageOf(lang).english}. Keep model and lens names, engravings, serial numbers, prices, URLs and quoted listing text exactly as they are.`;
}

const MAX_ROUNDS = 5;

/**
 * Runs a research request with web search and fetch, until Claude calls the
 * `report` tool. Server tools can pause a long turn (`pause_turn`); the turn
 * is continued by sending the partial answer back. Every round is billed and
 * recorded.
 */
async function research(
  key: string | null,
  action: AiAction,
  model: ModelId,
  system: string,
  prompt: string,
  schema: object
): Promise<{ input: unknown; cost: RunCost }> {
  const cost = newCost();
  const tools: ToolUnion[] = [
    ...webTools(model),
    { name: "report", description: "Submit the final findings. Call exactly once, at the end.", strict: true, input_schema: schema as { type: "object" } },
  ];
  const messages: MessageParam[] = [{ role: "user", content: prompt }];
  let nudged = false;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await send(key, action, { model, max_tokens: 16000, system: inReadersLanguage(system), tools, tool_choice: { type: "auto" }, messages, output_config: effortFor(model) }, cost);
    const report = res.content.find((b) => b.type === "tool_use" && b.name === "report");
    if (report && report.type === "tool_use") return { input: report.input, cost };
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (!nudged && res.stop_reason === "end_turn") {
      nudged = true;
      messages.push({ role: "assistant", content: res.content }, { role: "user", content: "Now call the report tool with your findings." });
      continue;
    }
    break;
  }
  throw aiError("unreadable");
}

export async function checkListing(key: string | null, model: ModelId, url: string, pasted?: string): Promise<{ report: ListingReport; cost: RunCost }> {
  const { input, cost } = await research(key, "listing", model, LISTING_SYSTEM, listingPrompt(url, pasted), LISTING_SCHEMA);
  const report = parseListingReport(input);
  if (!report) throw aiError("unreadable");
  if (!report.fetched && !pasted?.trim()) throw aiError("blocked");
  return { report, cost };
}

export async function valueItem(key: string | null, model: ModelId, item: CollectionItem): Promise<{ price: PriceSuggestion; cost: RunCost }> {
  const { input, cost } = await research(key, "value", model, VALUE_SYSTEM, valuePrompt(item), PRICE_SCHEMA);
  const price = parsePriceSuggestion(input);
  if (!price) throw aiError("unreadable");
  return { price, cost };
}
