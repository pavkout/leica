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

const MESSAGES: Record<AiErrorKind, string> = {
  "no-key": "Add your Anthropic API key in AI & pricing to use this.",
  "bad-key": "Anthropic rejected the key. Check it in AI & pricing.",
  "no-credit": "Your Anthropic account is out of credit. Add credit in the Anthropic Console, then try again.",
  "rate-limit": "Anthropic asked us to slow down. Try again in a moment.",
  offline: "You're offline. The AI tools need a connection; everything else still works.",
  refused: "Claude declined this request.",
  unreadable: "Couldn't read Claude's answer. Nothing was saved; try again.",
  blocked: "That site can't be read automatically. Paste the listing text instead.",
  limit: "This would pass your monthly AI limit. Raise it in AI & pricing to continue.",
  busy: "Anthropic is busy right now. Try again in a minute.",
  other: "Something went wrong talking to Anthropic.",
};

export function aiError(kind: AiErrorKind, detail?: string, retryAfter?: number): AiError {
  return new AiError(kind, detail ? `${MESSAGES[kind]} (${detail})` : MESSAGES[kind], retryAfter);
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
