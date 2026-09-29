# Collector Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collector tools to My Collection:
- sourced serial facts (offline)
- a bring-your-own-key Claude foundation with model choice and visible cost
- photo → draft item
- a listing check with a cited price suggestion
- valuations of owned items

**Architecture:**
- Pure logic lives in `src/state/serialFacts.ts` and `src/services/ai/*`.
- `src/services/ai/aiClient.ts` is the only module that calls Claude. It lazy-imports `@anthropic-ai/sdk` and runs in the browser with the user's key.
- UI lives in `src/components/collector/*`, mounted from `Collection.tsx`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, `@anthropic-ai/sdk` (new, lazy-loaded).

**Spec:** `docs/superpowers/specs/2026-09-29-collector-tools-design.md`

## Global Constraints

- Sourced `serialFacts` and AI `aiFindings` are stored separately and never merged; conflicts are shown.
- No investment scores, grades or predictions. Every price shown has a source URL.
- A price range is shown only with ≥ 3 comparables that have URLs; otherwise "not enough data".
- Sold and asking prices are labelled; no currency conversion.
- The key is kept in device storage only, and "Forget key" removes it.
- Photos are downscaled to ≤ 2576 px on the long edge and re-encoded through a canvas (strips EXIF) before upload.
- AI output is rendered as text only.
- Tests never call the real API.
- Models: `claude-haiku-4-5` ($1/$5), `claude-sonnet-5` ($2/$10, the default), `claude-opus-5-5` ($4/$20) per million tokens; web search costs $10 per 1,000. Prices are as of 2026-09-29.
- Web tools: `web_search_20260209` / `web_fetch_20260209` on Sonnet 5 and Opus 5.5; `web_search_20250305` / `web_fetch_20250910` on Haiku 4.5. Search `max_uses` is 5.
- Existing saved collections load unchanged.

## Review Focus

1. **Serial typed with spaces, dots or a "No." prefix** ("No. 919 251") should parse the same as "919251". Test in Task 1.
2. **A lens serial where published years overlap** (1992/1993) should give both years, not pick one. Test in Task 1.
3. **An AI response that omits fields or has wrong types** should give "couldn't read the result" with nothing saved. Test in Task 3.
4. **Comparables with no URL, or only 1–2 comparables** should give no range, only "not enough data". Test in Task 3.
5. **The monthly limit is reached mid-month** so the next run is refused before any call. Test in Task 2.

---

### Task 1: Serial facts (Slice 1, offline)

**Files:**
- Create: `src/state/serialFacts.ts`, `src/state/serialFacts.test.ts`
- Modify: `src/state/collection.ts` (optional fields + CSV columns), `src/state/collection.test.ts`, `src/components/Collection.tsx` (facts card under the serial field; facts on list rows), `src/styles.css`

**Interfaces:**
- Produces:
  ```ts
  interface SerialFacts { kind: "body" | "lens"; model?: string; variant?: string; year: string;
    batchFrom?: number; batchTo?: number; batchSize?: number; bodyId?: string; source: string; notes: string[] }
  type SerialLookup = { status: "found"; facts: SerialFacts } | { status: "unknown"; reason: string } | { status: "invalid" };
  lookupSerialFacts(kind: "body" | "lens", text: string): SerialLookup
  serialConflicts(facts: SerialFacts, claim: { model?: string; year?: string | number }): string[]
  rarityNote(facts: SerialFacts): string | null
  ```
- `CollectionItem` gains `serialFacts?`, `aiFindings?`, `valuations?`. The `AiFindings` and `Valuation` types are defined in `collection.ts`.

Steps:
- [ ] **Write tests:**
  - body `700001` → M3, 1954, batch 700,001–710,000, size 10,000, Leitz source
  - `"No. 919 251"` → M3 + the single-stroke note
  - M5 `1300000`
  - body `600000` → unknown
  - `"abc"` → invalid
  - lens `3000000` → a year
  - a 1992/1993 overlap serial → year `"1992/1993"`
  - lens gap and after-table → unknown
  - `serialConflicts`: M2 claim vs M3 facts → 1 conflict; M3 claim → none; year 1970 vs 1954 → 1 conflict
  - `rarityNote` for a black-paint batch mentions the variant and size
  - collection CSV header gains `serial_model,serial_year`
- [ ] Run `npx vitest run src/state` and confirm they fail.
- [ ] Implement `serialFacts.ts` using `bodyBlock`, `bodyNotes`, `parseSerial`, `lensYear`, `BODY_SERIAL_SOURCES`, `LENS_SERIAL_SOURCES`.
- [ ] Update collection types and CSV.
- [ ] **UI:**
  - The editor shows a "From the serial lists" card: facts, rarity note, source link, "Use as name".
  - Save attaches `serialFacts` when the serial is found and clears it otherwise.
  - List rows show "M3 · 1958".
- [ ] Run tests, typecheck and lint, and confirm they pass.

### Task 2: AI foundation (Slice 2)

**Files:**
- Create:
  - `src/services/ai/pricing.ts` (+ test)
  - `src/services/ai/aiSettings.ts` (+ test)
  - `src/services/ai/spendLog.ts` (+ test)
  - `src/services/ai/errors.ts` (+ test)
  - `src/services/ai/aiClient.ts`
  - `src/components/collector/AiSettings.tsx`
- Modify: `package.json` (add `@anthropic-ai/sdk`), `Collection.tsx` (an "AI & pricing" button toggles the panel), `styles.css`

**Interfaces:**
- Produces:
  ```ts
  type ModelId = "claude-haiku-4-5" | "claude-sonnet-5" | "claude-opus-5-5";
  type AiAction = "photo" | "listing" | "value";
  MODELS: { id: ModelId; label: string; inPerM: number; outPerM: number; note: string }[]
  WEB_SEARCH_PER_1000 = 10; PRICES_AS_OF = "2026-09-29"
  estimate(action: AiAction, model: ModelId): { low: number; high: number }
  actualCost(usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null; server_tool_use?: { web_search_requests?: number } | null }, model: ModelId): number
  formatUsd(n: number): string
  // aiSettings
  interface AiSettings { key: string | null; model: ModelId; perAction: Partial<Record<AiAction, ModelId>>; monthlyLimitUsd: number | null }
  loadAiSettings(): AiSettings; saveAiSettings(s: AiSettings): boolean; forgetKey(): void; modelFor(s, action): ModelId
  // spendLog
  interface SpendRow { at: string; action: AiAction | "test"; model: ModelId; input: number; output: number; searches: number; usd: number }
  loadSpend(): SpendRow[]; recordSpend(row): void; monthTotal(rows, now: Date): number; wouldExceed(rows, limit: number | null, estimateHigh: number, now: Date): boolean
  // errors
  class AiError extends Error { kind: "no-key" | "bad-key" | "no-credit" | "rate-limit" | "offline" | "refused" | "unreadable" | "blocked" | "limit" | "other" }
  describeApiError(e: unknown): AiError
  // aiClient
  testKey(key: string, model: ModelId): Promise<{ ok: true; usd: number }>
  ```

Steps:
- [ ] **Write tests:**
  - `actualCost` for Sonnet 5: 1M in + 1M out = $12; searches add $0.01 each
  - `estimate` returns low < high for every action and model
  - `formatUsd` gives "$0.03" and "<$0.01"
  - settings round-trip; `forgetKey` clears only the key; `modelFor` uses the override, otherwise the default
  - spend `monthTotal` counts only the current month
  - `wouldExceed`: true when total + estimate > limit, false with no limit
  - `describeApiError`: status 401 → bad-key; 429 → rate-limit; 400 with "credit balance" → no-credit
- [ ] Implement; `npm i @anthropic-ai/sdk`.
- [ ] **`aiClient.ts`:**
  - `getClient(key)` does `await import("@anthropic-ai/sdk")`, then `new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })`.
  - `testKey` sends a 16-token "ok" message.
  - Every call records a spend row.
- [ ] **`AiSettings.tsx`:**
  - masked key field, Test key, Forget key, the device-only warning
  - model picker, per-action overrides, monthly limit
  - pricing table (models × actions, from `estimate`) with the as-of date and a pricing link
  - this month's total
- [ ] Run tests, typecheck, lint and build, and confirm they pass. Confirm the SDK lands in a separate chunk.

### Task 3: Schemas, photo → item, listing check, valuations (Slices 3–5)

**Files:**
- Create:
  - `src/services/ai/schemas.ts` (+ test)
  - `src/services/ai/image.ts`
  - `src/services/ai/prompts.ts`
  - `src/components/collector/PhotoIdentify.tsx`, `ListingCheck.tsx`, `ValuationPanel.tsx`
- Modify: `aiClient.ts` (`identifyPhoto`, `checkListing`, `valueItem`), `Collection.tsx`, `styles.css`

**Interfaces:**
- Produces:
  ```ts
  interface PhotoReading { kind: "body" | "lens" | "accessory" | "unknown"; maker: string | null; model: string | null; lensName: string | null;
    serial: string | null; serialLegible: "yes" | "partial" | "no"; engravings: string[]; finish: string | null;
    visibleCondition: string | null; confidence: { model: Conf; serial: Conf }; whatWouldHelp: string | null }
  interface Comparable { url: string; title: string; price: number; currency: string; kind: "sold" | "asking"; date: string | null; condition: string | null }
  interface PriceSuggestion { comparables: Comparable[]; range: { low: number; high: number; currency: string } | null; note: string }
  interface ListingReport { title: string | null; kind: PhotoReading["kind"]; model: string | null; statedSerial: string | null;
    asking: { price: number; currency: string } | null; redFlags: { flag: string; why: string }[]; price: PriceSuggestion; fetched: boolean }
  parsePhotoReading(x: unknown): PhotoReading | null
  parseListingReport(x: unknown): ListingReport | null
  parsePriceSuggestion(x: unknown): PriceSuggestion | null
  settleRange(comps: Comparable[]): PriceSuggestion["range"]  // ≥3 same-currency comparables with http(s) URLs, else null
  askingPosition(asking, range): "below" | "within" | "above" | null
  prepareImage(file: File, maxEdge = 2576): Promise<{ base64: string; mediaType: "image/jpeg" }>
  identifyPhoto(key, model, files): Promise<{ reading: PhotoReading; usd: number }>
  checkListing(key, model, url, pasted?: string): Promise<{ report: ListingReport; usd: number }>
  valueItem(key, model, item: CollectionItem): Promise<{ price: PriceSuggestion; usd: number }>
  ```

Steps:
- [ ] **Write schema tests:**
  - A valid photo reading parses; missing `serialLegible` → null; a non-string serial → null.
  - `settleRange`: 3 comparables with URLs → min/max; 2 → null; comparables without URLs are dropped before counting; mixed currencies use the majority currency only.
  - `askingPosition`: below, within, above.
  - `parseListingReport` drops comparables that lack a URL and recomputes the range app-side (the model's own range is ignored).
- [ ] **Implement schemas and prompts:**
  - The model must never guess unreadable digits.
  - No scores or predictions.
  - Every comparable carries a URL.
  - The final answer comes via the `report` tool.
- [ ] **`aiClient` calls:**
  - Photo: `output_config.format` json_schema.
  - Listing and value: web search + web fetch, plus a strict `report` custom tool (`tool_choice` auto).
  - A `pause_turn` continuation loop, at most 4 rounds.
  - Refusal → `AiError("refused")`.
  - A missing or invalid report → `AiError("unreadable")`.
  - Spend is recorded for every round.
- [ ] **UI:**
  - `PhotoIdentify` shows the result card, runs serial facts and conflicts, then "Make a draft item", which opens the editor prefilled.
  - `ListingCheck` shows the report card, red flags, comparables with links and "Add to collection".
  - `ValuationPanel` sits in the editor: Suggest value, a history, and "stale" after 12 months.
  - "Value all" asks for confirmation with the estimate, runs sequentially, and can be stopped.
  - CSV gains `value_low,value_high,value_currency,value_date,value_sources`.
- [ ] Run tests, typecheck, lint and build, check at phone width, then update `PROJECT_STATUS.md`.
