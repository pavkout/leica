import { t } from "../../i18n";
// Every way a Claude call can fail, said in plain language. The UI shows
// `message`; `kind` lets it offer the right next step.

export type AiErrorKind = "no-key" | "bad-key" | "no-credit" | "rate-limit" | "offline" | "refused" | "unreadable" | "blocked" | "limit" | "busy" | "other";

export class AiError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
    /** Seconds to wait, for rate limits. */
    public retryAfter?: number
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** English wording, for reference; the text shown comes from the dictionaries (ai.error.<kind>). */
export const MESSAGES: Record<AiErrorKind, string> = {
  "no-key": "The AI helper isn't turned on yet. Turn it on first.",
  "bad-key": "Your key didn't work. Check it on the AI helper page.",
  "no-credit": "Your Anthropic account has no credit left. Add credit at console.anthropic.com, then try again.",
  "rate-limit": "Too many requests at once. Wait a moment, then try again.",
  offline: "You're offline. Connect to the internet to use this. Everything else still works.",
  refused: "The AI declined this request.",
  unreadable: "The answer came back incomplete. Nothing was saved. Please try again.",
  blocked: "This website can't be read automatically. Copy the text of the listing and paste it in the box below.",
  limit: "This would go over your monthly spending limit. You can raise the limit on the AI helper page.",
  busy: "The AI service is busy. Try again in a minute.",
  other: "Something went wrong. Please try again.",
};

export function aiError(kind: AiErrorKind, detail?: string, retryAfter?: number): AiError {
  const text = t(`ai.error.${kind}`);
  return new AiError(kind, detail ? `${text} (${detail})` : text, retryAfter);
}

/** Maps an SDK/network error to an AiError without depending on the SDK's classes. */
export function describeApiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const err = e as { status?: number; message?: string; name?: string; headers?: { get?: (k: string) => string | null } | Record<string, string> };
  const status = typeof err?.status === "number" ? err.status : undefined;
  const msg = String(err?.message ?? "");
  if (status === 401 || status === 403) return aiError("bad-key");
  if (status === 429) {
    const h = err.headers;
    const raw = h && typeof (h as { get?: unknown }).get === "function" ? (h as { get: (k: string) => string | null }).get("retry-after") : (h as Record<string, string> | undefined)?.["retry-after"];
    const secs = raw ? Number(raw) : undefined;
    return aiError("rate-limit", undefined, Number.isFinite(secs) ? secs : undefined);
  }
  if (status === 400 && /credit balance/i.test(msg)) return aiError("no-credit");
  if (status === 529 || (status !== undefined && status >= 500)) return aiError("busy");
  if (status === undefined && (/connection|network|fetch/i.test(msg) || /Connection/.test(err?.name ?? ""))) return aiError("offline");
  return aiError("other", status ? `HTTP ${status}` : msg.slice(0, 120) || undefined);
}
