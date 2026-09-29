# Collector tools — design

Date: 2026-09-29 · Master Plan brief: #38 · Status: approved in conversation, awaiting written-spec review

## Intent

The user is a Leica collector. Today they research each item by asking a general chatbot: "What is this? How rare is it? What is it worth?" This feature brings that workflow into the app, built on the app's own sourced data.

Success means:
1. Adding an item to My Collection is fast (serial or photo), and every fact shows where it came from.
2. Given a public listing link, the app identifies the item, checks the serial for consistency, flags buyer risks, and suggests a fair price backed by cited comparables.
3. The same price engine can value items the user already owns.

## Decisions (user, 2026-09-29)

- **Cloud AI is acceptable.** It runs on Anthropic's Claude.
- **Public users bring their own Anthropic API key (BYOK).** A paid mode, where we hold the key and charge the user, is a separate later project. The design keeps a single adapter where it can be dropped in.
- **Users choose the model:** Haiku 4.5, Sonnet 5 (the default) or Opus 5.5. A pricing table explains the cost, every run shows a cost preview before it starts, and the actual cost afterwards.
- **Price suggestions apply to both listing links and owned items.** They are cited market context only, never investment scores or predictions.

## Architecture

- The whole feature runs client-side. The browser calls the Anthropic API directly with the user's key, and there is no server of ours.
- Listing pages and price research use Claude's server-side `web_fetch` and `web_search` tools. They run on Anthropic's side, which avoids browser CORS limits.
- Offline sourced data is the base layer and always wins. The serial tables (`src/data/bodySerials.ts`, `src/data/lensSerials.ts`) supply the facts. AI output is kept in separate fields, is labelled, and is cross-checked against those facts.
- `@anthropic-ai/sdk` is a new dependency. It is lazy-loaded only when an AI action runs, so the initial bundle does not change.

### Units

| Unit | Purpose | Depends on |
|---|---|---|
| `src/state/serialFacts.ts` | Pure logic: serial → `SerialFacts` (model, variant, year, batch range, batch size, source), plus conflict detection against a claimed model/year | serial data files |
| `src/services/ai/pricing.ts` | Pure logic: model price table with a "prices as of" date; `estimate(action, model)` and `actualCost(usage, model)` | — |
| `src/services/ai/aiSettings.ts` | The key (device only), default model, per-action overrides, monthly limit | `services/persistence` |
| `src/services/ai/spendLog.ts` | One row per run (date, action, model, tokens, USD); month total; limit check | `services/persistence` |
| `src/services/ai/aiClient.ts` | **The only file that calls Claude.** Lazy SDK import; `identifyPhoto`, `checkListing`, `valueItem`, `testKey`; typed results; errors mapped to plain-language messages | SDK, pricing, spendLog |
| `src/services/ai/schemas.ts` | JSON schemas and validators for each action's structured output | — |
| `src/services/ai/fakeClient.ts` | A recorded-response client for tests (never spends money) | — |
| UI | Additions to `Collection.tsx` plus new focused components: `AiSettings`, `PricingTable`, `PhotoIdentify`, `ListingCheck`, `ValuationPanel` | the above |

## Data model

`CollectionItem` gains optional fields. Existing saved collections load unchanged.

```ts
serialFacts?: {
  model: string; variant?: string; year: string;
  batchFrom: number; batchTo: number; batchSize: number;
  source: string;            // e.g. "Leitz serial list, March 1965"
};
aiFindings?: {
  model?: string; serial?: string; engravings?: string[];
  finish?: string; condition?: string;
  confidence: Record<string, "high" | "medium" | "low">;
  at: string; model_used: string; costUsd: number;
};
valuations?: Valuation[];    // newest first

interface Valuation {
  date: string; model_used: string; currency: string;
  low: number | null; high: number | null;   // null when there are fewer than 3 comparables
  comparables: { url: string; date?: string; price: number; currency: string;
                 kind: "sold" | "asking"; condition?: string; title: string }[];
  costUsd: number;
}
```

Rules:
- `serialFacts` comes only from the offline tables. `aiFindings` comes only from AI. The two are never merged.
- The item card labels them "From Leitz serial list" and "Read by AI".
- When they disagree (model, or year outside the batch), a ⚠ conflict shows until the user edits or dismisses it.
- Rarity wording is factual, e.g. "Batch of 500, black paint, 1958". The card also states that batch size is the number made, not the number surviving.

## Slices (one at a time; each gets tests, validation and a status update)

### Slice 1 — Serial auto-fill (offline, no AI)
- Typing a serial in the collection editor looks it up in the body or lens tables, according to the item's kind.
- It shows the facts, batch size and source, and offers to fill the name, the catalogue id and `serialFacts`.
- Unknown serials say "not in the sourced tables", with no guessing.
- Existing CSV export gains the columns `serial_model` and `serial_year`.

### Slice 2 — AI foundation
- **Settings page ("AI & pricing"):**
  - key input, masked
  - **Test key**, which makes a minimal call
  - **Forget key**
  - the warning "Anyone using this browser can use your key"
  - the default model picker and per-action overrides
  - an optional monthly limit, with a confirmation prompt when a run would exceed it
- **Pricing table:** 3 models × 3 actions, each with an estimated cost; the "prices as of" date; a link to Anthropic's pricing page.
- **Spend log** with this month's total.
- **Error mapping:**
  - invalid key → "check it in AI settings"
  - no credit → add credit
  - 429 → retry after `retry-after`
  - offline → AI buttons disabled with a reason
  - `refusal` → said plainly
  - malformed output → "couldn't read the result", with no partial save

### Slice 3 — Photo → item
- **Input:** 1–4 photos, from the camera or an upload. The guidance suggests the whole item plus a close-up of the serial or top plate.
- **Preprocessing:** downscale to at most 2576 px on the long edge (the most detail the model can use), re-encode to JPEG, strip EXIF (no GPS leaves the device), then show the cost preview.
- **Structured output:**
  - `kind`, `maker`, `model`, `lensName`, `focalLength`, `aperture`
  - `serial`, `serialLegible: "yes" | "partial" | "no"`
  - `engravings[]`, `finish`, `visibleCondition` (notes, no grade)
  - per-field `confidence`, and `whatWouldHelp`
- **After the response:**
  1. A legible serial runs through `serialFacts`.
  2. The app pre-fills a **draft** item. Nothing is saved until the user confirms.
  3. The first photo becomes the item picture, using the existing small-JPEG path.
- **If the serial is not legible:** show `whatWouldHelp` and a "Retake close-up" action. The model is told never to guess digits.

### Slice 4 — Listing check
- **Input:** a URL, plus optional pasted text or screenshots.
- **Tools:** `web_fetch` (the listing) and `web_search` (comparables), with `max_uses` 5 for search.
- **Structured output:**
  - item identification
  - the seller-stated serial and asking price with its currency
  - `redFlags[]`, each with a reason
  - `comparables[]` (URL, date, price, currency, sold/asking, condition, title)
  - `range {low, high, currency} | null`
  - the asking price's position in the range
- **App-side checks:**
  - serial consistency via `serialFacts`
  - comparables without a URL are dropped
  - a range is shown only when there are 3 or more comparables with URLs; otherwise "not enough data"
  - sold and asking prices are labelled separately
  - no currency conversion
- **Red flags the prompt covers:**
  - the serial doesn't match the claimed model or year
  - a rare variant claimed on a common-batch serial
  - stock or reused photos
  - off-platform payment
  - a price far below the range
- **Blocked fetch:** "This site can't be read automatically — paste the listing text or screenshots." Everything else works the same.
- **Actions:** "Add to collection" creates a draft item.

### Slice 5 — Value my collection
- **"Suggest value" on an item:**
  - Uses the same comparables engine as Slice 4, seeded from the item's known facts, condition notes and photo.
  - Saves a `Valuation`.
  - Shows the value history; a valuation older than 12 months is marked stale.
- **"Value all":** shows the total estimate and asks for confirmation first, then runs sequentially with progress. It can be stopped, and a stop keeps the completed results.
- **Export:** CSV/print gets optional columns: latest range, date, number of sources.

## Honesty and privacy rules

- There are no investment scores, grades or predictions. Every price shown has a source link.
- AI-read facts are always labelled and never overwrite sourced facts.
- Photos and links go from the user's device straight to Anthropic, never to us. The AI settings page says this.
- The key is stored only on the device, and the user can delete it at any time.
- AI output text is rendered as text (never HTML), in line with the Master Plan's sanitisation rules.

## Testing

- **Unit:**
  - `serialFacts` (known batches, edges, unknown serials, conflicts)
  - `pricing.estimate` / `actualCost`
  - schema validation of good, partial and malformed AI output
  - the valuation "not enough data" rule
  - comparables without URLs dropped
  - spend log month totals and limit
  - old collection data loads unchanged
- **Integration:** UI flows against `fakeClient` with recorded responses. No test calls the real API.
- **Manual:** a smoke test with the user's key (one photo, one listing), run only with the user's OK because it costs cents.
- **Every slice:** typecheck, lint, tests, build, and a phone-width check.

## Out of scope (later projects)

- Paid mode (a server holding our key, Stripe, metering)
- On-device OCR fallback
- Price charts or alerts
- Watching listings over time
- Cross-device sync
- Condition grading
